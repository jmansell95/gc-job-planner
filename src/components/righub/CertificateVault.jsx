import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, ExternalLink, ShieldCheck, ShieldAlert, ShieldX, Lock, Download, FolderDown } from 'lucide-react';
import { safeFormat } from '@/utils/format';
import { COMPLIANCE_META, daysUntil } from '@/utils/rigRollup';

/**
 * Aggregated certificate vault — pulls every ServiceRecord that has an
 * uploaded certificate for the rig itself AND all its linked equipment,
 * so the whole rig system's statutory documents are visible in one place.
 */
export default function CertificateVault({ assetIds = [], assetNames = {} }) {
  const [downloading, setDownloading] = useState(false);
  const idSet = new Set(assetIds);

  const openAll = () => {
    certs.slice(0, 15).forEach((c, i) => setTimeout(() => window.open(c.certificate_url, '_blank'), i * 200));
  };
  const downloadOne = async (url, name) => {
    setDownloading(true);
    try {
      const res = await fetch(url); const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = objUrl; a.download = name || 'certificate';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(objUrl);
    } catch { window.open(url, '_blank'); }
    setDownloading(false);
  };

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['cert-vault', assetIds.join('|')],
    queryFn: () => base44.entities.ServiceRecord.list('-date', 500),
    enabled: assetIds.length > 0,
  });

  const certs = records
    .filter(r => idSet.has(r.site_asset_id) && r.certificate_url)
    .map(r => ({ ...r, _assetName: assetNames[r.site_asset_id] || 'Asset' }));

  const expiredCount = certs.filter(c => {
    const d = daysUntil(c.resulting_expiry_date);
    return d !== null && d < 0;
  }).length;
  const expiringCount = certs.filter(c => {
    const d = daysUntil(c.resulting_expiry_date);
    return d !== null && d >= 0 && d <= 30;
  }).length;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-white border-slate-200">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800">Certificate Vault</p>
          <p className="text-[10px] text-slate-400">
            {certs.length} certificate{certs.length !== 1 ? 's' : ''} on file
            {expiredCount > 0 && <span className="text-red-600 font-medium"> · {expiredCount} expired</span>}
            {expiringCount > 0 && <span className="text-amber-600 font-medium"> · {expiringCount} expiring</span>}
          </p>
        </div>
        {certs.length > 0 && (
          <button onClick={openAll} title="Open all certificates"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-semibold transition">
            <FolderDown className="w-3 h-3" /> Open All
          </button>
        )}
      </div>

      <div className="p-4">
        {isLoading ? (
          <p className="text-xs text-slate-400 italic">Loading certificates…</p>
        ) : certs.length === 0 ? (
          <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">No certificates uploaded yet. Log a service record with a certificate to populate the vault.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {certs.map(c => {
              const d = daysUntil(c.resulting_expiry_date);
              const tone = d === null ? 'unknown' : d < 0 ? 'expired' : d <= 30 ? 'expiring' : 'compliant';
              const meta = COMPLIANCE_META[tone];
              const StatusIcon = tone === 'expired' ? ShieldX : tone === 'expiring' ? ShieldAlert : tone === 'compliant' ? ShieldCheck : FileText;
              return (
                <div key={c.id} className="flex items-center gap-2.5 bg-white rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${meta.tone} flex-shrink-0`}>
                    <StatusIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{c._assetName}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {c.certificate_name || 'Certificate'} · {safeFormat(c.date, 'dd MMM yyyy')}
                    </p>
                    {c.resulting_expiry_date && (
                      <p className={`text-[10px] font-medium ${tone === 'expired' ? 'text-red-600' : tone === 'expiring' ? 'text-amber-600' : 'text-slate-400'}`}>
                        Expires {safeFormat(c.resulting_expiry_date, 'dd MMM yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-1 flex-shrink-0">
                    <a href={c.certificate_url} target="_blank" rel="noreferrer" title="View"
                      className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button onClick={() => downloadOne(c.certificate_url, c.certificate_name || `${c._assetName}-certificate`)} disabled={downloading} title="Download"
                      className="p-1.5 text-slate-500 hover:text-[#2E5A1A] hover:bg-[#2E5A1A]/10 rounded-lg transition disabled:opacity-50">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}