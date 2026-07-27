import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, ExternalLink, ShieldCheck, ShieldAlert, ShieldX, Lock } from 'lucide-react';
import { safeFormat } from '@/utils/format';
import { COMPLIANCE_META, daysUntil } from '@/utils/rigRollup';

/**
 * Aggregated certificate vault — pulls every ServiceRecord that has an
 * uploaded certificate for the rig itself AND all its linked equipment,
 * so the whole rig system's statutory documents are visible in one place.
 */
export default function CertificateVault({ assetIds = [], assetNames = {} }) {
  const idSet = new Set(assetIds);

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
                  <a href={c.certificate_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#1c4a12] transition flex-shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" /> View
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}