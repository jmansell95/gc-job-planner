import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { ShieldCheck, FileText, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';

function getComplianceStatus(item) {
  if (item.status_override === 'missing') return { color: 'red', label: 'Missing', Icon: XCircle, bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100' };
  if (item.status_override === 'not_required') return { color: 'slate', label: 'Not Required', Icon: CheckCircle2, bg: 'bg-slate-50', text: 'text-slate-400', ring: 'ring-slate-100' };
  if (!item.expiry_date) return { color: 'slate', label: 'No Expiry', Icon: FileText, bg: 'bg-slate-50', text: 'text-slate-400', ring: 'ring-slate-100' };
  const days = differenceInDays(new Date(item.expiry_date + 'T00:00:00'), new Date());
  if (days < 0) return { color: 'red', label: 'Expired', Icon: XCircle, bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100' };
  if (days <= 30) return { color: 'amber', label: `Expires in ${days}d`, Icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' };
  return { color: 'green', label: 'Valid', Icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' };
}

export default function ComplianceWallet({ staffId, staffName }) {
  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['staff-compliance', staffId],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
    enabled: !!staffId
  });

  const myItems = allItems.filter(i => i.reference_id === staffId || (staffName && i.reference_name === staffName));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">My Compliance</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : myItems.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No compliance items" message="Your certificates and licenses will appear here once uploaded." />
      ) : (
        <div className="space-y-2">
          {myItems.map(item => {
            const st = getComplianceStatus(item);
            return (
              <div key={item.id} className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${st.bg} ${st.ring}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${st.bg}`}>
                  <st.Icon className={`w-4 h-4 ${st.text}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
                  {item.expiry_date && (
                    <p className="text-xs text-slate-500">Expires {format(new Date(item.expiry_date + 'T00:00:00'), 'dd MMM yyyy')}</p>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text} flex-shrink-0`}>{st.label}</span>
                {item.document_url && (
                  <a href={item.document_url} target="_blank" rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}