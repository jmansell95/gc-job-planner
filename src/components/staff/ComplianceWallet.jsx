import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { formatComplianceDate, complianceDaysUntil } from '@/utils/complianceDate';
import { ShieldCheck, FileText, AlertTriangle, CheckCircle2, XCircle, CreditCard, Calendar, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';

function getComplianceStatus(item) {
  if (item.status_override === 'missing') return { color: 'red', label: 'Missing', Icon: XCircle, bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100', cardRing: 'ring-red-200' };
  if (item.status_override === 'not_required') return { color: 'slate', label: 'Not Required', Icon: CheckCircle2, bg: 'bg-slate-50', text: 'text-slate-400', ring: 'ring-slate-100', cardRing: 'ring-slate-200' };
  if (!item.expiry_date) return { color: 'slate', label: 'No Expiry', Icon: FileText, bg: 'bg-slate-50', text: 'text-slate-400', ring: 'ring-slate-100', cardRing: 'ring-slate-200' };
  const days = complianceDaysUntil(item.expiry_date);
  if (days === null) return { color: 'slate', label: 'No Expiry', Icon: FileText, bg: 'bg-slate-50', text: 'text-slate-400', ring: 'ring-slate-100', cardRing: 'ring-slate-200' };
  if (days < 0) return { color: 'red', label: 'Expired', Icon: XCircle, bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100', cardRing: 'ring-red-200' };
  if (days <= 30) return { color: 'amber', label: `${days}d left`, Icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100', cardRing: 'ring-amber-200' };
  return { color: 'green', label: 'Valid', Icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100', cardRing: 'ring-emerald-200' };
}

const isImage = (url) => url && (url.match(/\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i));

export default function ComplianceWallet({ staffId, staffName }) {
  const [expandedId, setExpandedId] = useState(null);

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['staff-compliance', staffId],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
    enabled: !!staffId
  });

  const myItems = allItems.filter(i => i.reference_id === staffId || (staffName && i.reference_name === staffName));
  const expiringCount = myItems.filter(i => {
    if (!i.expiry_date) return false;
    const days = complianceDaysUntil(i.expiry_date);
    return days !== null && days <= 30;
  }).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">My Compliance</h2>
            <p className="text-xs text-slate-500">{myItems.length} item{myItems.length !== 1 ? 's' : ''}{expiringCount > 0 && <span className="text-amber-600 font-medium"> · {expiringCount} expiring soon</span>}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : myItems.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No compliance items" message="Your certificates, CSCS cards and qualifications will appear here once your manager uploads them." />
      ) : (
        <div className="space-y-2.5">
          {myItems.map(item => {
            const st = getComplianceStatus(item);
            const isCard = item.qualification_type === 'cscs_card' || item.qualification_type === 'cpcs_card' || item.qualification_type === 'npors_card' || item.qualification_type === 'driver_license';
            const expanded = expandedId === item.id;
            const hasBack = !!item.back_document_url;
            return (
              <div key={item.id} className={`rounded-xl ring-1 ${st.bg} ${st.cardRing} overflow-hidden`}>
                <button onClick={() => setExpandedId(expanded ? null : item.id)}
                  className="w-full text-left flex items-center gap-3 p-3 hover:bg-white/40 transition">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${st.bg}`}>
                    {isCard ? <CreditCard className={`w-5 h-5 ${st.text}`} /> : <st.Icon className={`w-5 h-5 ${st.text}`} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                    </div>
                    {item.expiry_date && (
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Expires {formatComplianceDate(item.expiry_date)}
                      </p>
                    )}
                    {item.card_number && (
                      <p className="text-xs text-slate-500 mt-0.5">Card #: {item.card_number}</p>
                    )}
                  </div>
                  {(item.document_url || hasBack || item.notes) && (
                    <div className="flex-shrink-0">
                      {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  )}
                </button>

                {expanded && (item.document_url || hasBack || item.notes || item.issue_date) && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-200/50">
                    {item.issue_date && (
                      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Issued: {formatComplianceDate(item.issue_date)}
                      </p>
                    )}

                    {(item.document_url || hasBack) && (
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {item.document_url && (
                          <a href={item.document_url} target="_blank" rel="noopener noreferrer"
                            className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white">
                            {isImage(item.document_url) ? (
                              <img src={item.document_url} alt="Front of card" className="w-full h-32 object-cover" />
                            ) : (
                              <div className="h-32 flex flex-col items-center justify-center gap-1">
                                <FileText className="w-8 h-8 text-slate-300" />
                                <span className="text-[10px] text-slate-400">Front</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                              <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
                            </div>
                            <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-0.5">Front</span>
                          </a>
                        )}
                        {hasBack && (
                          <a href={item.back_document_url} target="_blank" rel="noopener noreferrer"
                            className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white">
                            {isImage(item.back_document_url) ? (
                              <img src={item.back_document_url} alt="Back of card" className="w-full h-32 object-cover" />
                            ) : (
                              <div className="h-32 flex flex-col items-center justify-center gap-1">
                                <FileText className="w-8 h-8 text-slate-300" />
                                <span className="text-[10px] text-slate-400">Back</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                              <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
                            </div>
                            <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-0.5">Back</span>
                          </a>
                        )}
                      </div>
                    )}

                    {item.notes && (
                      <p className="text-xs text-slate-500 leading-relaxed">{item.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}