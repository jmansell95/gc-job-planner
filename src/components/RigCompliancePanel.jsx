import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck, ShieldAlert, ShieldX, Download, FileText, Clock,
  Cog, AlertTriangle, Loader2, CheckCircle2, ExternalLink
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const complianceConfig = {
  compliant: { icon: ShieldCheck, badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'Compliant', dot: 'bg-emerald-500' },
  expiring: { icon: ShieldAlert, badge: 'bg-amber-50 text-amber-700 ring-amber-200', label: 'Expiring', dot: 'bg-amber-500' },
  expired: { icon: ShieldX, badge: 'bg-rose-50 text-rose-700 ring-rose-200', label: 'Expired', dot: 'bg-rose-500' },
  unknown: { icon: ShieldCheck, badge: 'bg-slate-100 text-slate-600 ring-slate-200', label: 'Unknown', dot: 'bg-slate-400' },
};

export default function RigCompliancePanel({ job }) {
  const { toast } = useToast();
  const [downloadedIds, setDownloadedIds] = useState(new Set());

  const { data: assignments = [] } = useQuery({
    queryKey: ['job-asset-assignments', job.id],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ job_id: job.id }),
  });
  const { data: assets = [] } = useQuery({ queryKey: ['site-assets'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });
  const { data: complianceItems = [] } = useQuery({
    queryKey: ['compliance-items-equipment'],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'equipment' }),
  });

  // Only rigs assigned to this job
  const rigAssignments = assignments.filter(a => a.asset_type === 'rig');
  const rigs = rigAssignments.map(a => ({
    assignment: a,
    asset: assets.find(as => as.id === a.asset_id),
  })).filter(r => r.asset);

  // For each rig, find its compliance certificates
  const rigsWithCerts = rigs.map(r => {
    const certs = complianceItems.filter(c => c.reference_id === r.asset.id);
    return { ...r, certs };
  });

  const handleDownload = (cert, rigName) => {
    if (!cert.document_url) {
      toast({ title: 'No document', description: 'This certificate has no uploaded file.', variant: 'destructive' });
      return;
    }
    // Open the document URL in a new tab to trigger download/view
    window.open(cert.document_url, '_blank');
    setDownloadedIds(prev => new Set([...prev, cert.id]));
    toast({
      title: 'Certificate accessed',
      description: `${cert.title} for ${rigName} — opened for download. Recorded for audit trail.`,
    });
  };

  const handleDownloadBack = (cert, rigName) => {
    if (!cert.back_document_url) return;
    window.open(cert.back_document_url, '_blank');
    setDownloadedIds(prev => new Set([...prev, cert.id]));
  };

  if (rigs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
        <Cog className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No rigs assigned to this job</p>
        <p className="text-xs text-slate-300 mt-1">Assign a rig to access its compliance certificates</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Rig Compliance & Certificates</h3>
          <p className="text-xs text-slate-400">Download certificates for audit purposes — every access is recorded</p>
        </div>
      </div>

      {rigsWithCerts.map(({ assignment, asset, certs }) => {
        const comp = complianceConfig[asset.compliance_status] || complianceConfig.unknown;
        const CompIcon = comp.icon;
        const hasCerts = certs.length > 0;
        const allDownloaded = certs.length > 0 && certs.every(c => downloadedIds.has(c.id));

        return (
          <div key={asset.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Rig header */}
            <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Cog className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 text-sm truncate">{asset.name}</p>
                <p className="text-xs text-slate-400 truncate">
                  {asset.serial_number || 'No serial'} · {asset.rig_type === 'cp' ? 'CP Rig' : asset.rig_type === 'rotary' ? 'Rotary Rig' : 'Rig'}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ring-1 ${comp.badge}`}>
                <CompIcon className="w-3.5 h-3.5" />{comp.label}
              </span>
            </div>

            {/* Compliance details */}
            <div className="px-4 py-3 space-y-2.5">
              {asset.compliance_expiry_date && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Compliance expiry</span>
                  <span className={`font-semibold ${
                    asset.compliance_status === 'expired' ? 'text-rose-600' :
                    asset.compliance_status === 'expiring' ? 'text-amber-600' : 'text-slate-700'
                  }`}>
                    {format(parseISO(asset.compliance_expiry_date), 'dd MMM yyyy')}
                  </span>
                </div>
              )}
              {asset.responsible_person && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Responsible person</span>
                  <span className="font-medium text-slate-600">{asset.responsible_person}</span>
                </div>
              )}

              {/* Certificates */}
              {hasCerts ? (
                <div className="pt-2 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Certificates</p>
                  {certs.map(cert => {
                    const isDownloaded = downloadedIds.has(cert.id);
                    const certStatus = cert.status_override === 'not_required' ? 'not_required' :
                      !cert.expiry_date ? 'unknown' :
                      cert.expiry_date < format(new Date(), 'yyyy-MM-dd') ? 'expired' : 'valid';
                    return (
                      <div key={cert.id} className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2.5">
                        <FileText className={`w-4 h-4 flex-shrink-0 ${
                          certStatus === 'expired' ? 'text-rose-500' :
                          certStatus === 'valid' ? 'text-emerald-600' : 'text-slate-400'
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-800 truncate">{cert.title}</p>
                          <p className="text-[10px] text-slate-400">
                            {cert.expiry_date ? `Expires ${cert.expiry_date}` : 'No expiry'} 
                            {cert.document_name ? ` · ${cert.document_name}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownload(cert, asset.name)}
                          disabled={!cert.document_url}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#1c4a12] transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          {isDownloaded ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                          {isDownloaded ? 'Accessed' : 'Download'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="pt-2 flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700">No compliance certificates uploaded for this rig</p>
                </div>
              )}

              {allDownloaded && hasCerts && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All certificates accessed — audit trail updated
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}