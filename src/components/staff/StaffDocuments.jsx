import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FileText, CreditCard, ExternalLink, FolderOpen, IdCard, Award, Car, ShieldCheck, Loader2 } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const isImageUrl = (url) => url && url.match(/\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i);

const cardIcon = (qualType) => {
  switch (qualType) {
    case 'cscs_card':
    case 'cpcs_card':
    case 'npors_card':
      return IdCard;
    case 'driver_license':
      return Car;
    case 'first_aid_cert':
      return ShieldCheck;
    default:
      return Award;
  }
};

/** Resolves a URL to a viewable link — public URLs pass through, private URIs get a signed link on demand. */
function SignedLink({ url, children, className = '', ...rest }) {
  const [href, setHref] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) return;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      setHref(url);
      return;
    }
    setLoading(true);
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: url })
      .then(res => setHref(res?.signed_url || null))
      .catch(() => setHref(null))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-slate-400 ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin" /> Resolving…
      </span>
    );
  }

  if (!href) {
    return <span className={`text-xs text-slate-300 ${className}`}>Unavailable</span>;
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...rest}>
      {children}
    </a>
  );
}

/** Renders a document thumbnail — image preview or file icon — wrapped in a signed link. */
function DocThumb({ url, label }) {
  const [signedSrc, setSignedSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const isImg = isImageUrl(url);

  useEffect(() => {
    if (!url) return;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      setSignedSrc(url);
      return;
    }
    setLoading(true);
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: url })
      .then(res => setSignedSrc(res?.signed_url || null))
      .catch(() => setSignedSrc(null))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) {
    return <div className="h-36 bg-slate-100 animate-pulse rounded-lg flex items-center justify-center"><Loader2 className="w-5 h-5 text-slate-300 animate-spin" /></div>;
  }

  if (!signedSrc) {
    return (
      <div className="h-36 flex flex-col items-center justify-center gap-1 border border-slate-200 rounded-lg bg-slate-50">
        <FileText className="w-8 h-8 text-slate-300" />
        <span className="text-[10px] text-slate-400">{label}</span>
      </div>
    );
  }

  if (isImg) {
    return (
      <a href={signedSrc} target="_blank" rel="noopener noreferrer"
        className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white block">
        <img src={signedSrc} alt={label} className="w-full h-36 object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
          <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
        </div>
        <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-0.5">{label}</span>
      </a>
    );
  }

  return (
    <a href={signedSrc} target="_blank" rel="noopener noreferrer"
      className="h-36 flex flex-col items-center justify-center gap-1.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition">
      <FileText className="w-8 h-8 text-slate-400" />
      <span className="text-[10px] text-slate-500 font-medium">{label}</span>
      <span className="text-[10px] text-emerald-600 inline-flex items-center gap-0.5"><ExternalLink className="w-2.5 h-2.5" /> View</span>
    </a>
  );
}

export default function StaffDocuments({ staffId, staffName }) {
  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['staff-documents', staffId],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
    enabled: !!staffId
  });

  const myItems = allItems
    .filter(i => i.reference_id === staffId || (staffName && i.reference_name === staffName))
    .filter(i => i.document_url || i.back_document_url);

  // Group documents by type for tabbed organisation
  const cardTypes = ['cscs_card', 'cpcs_card', 'npors_card'];
  const cards = myItems.filter(i => cardTypes.includes(i.qualification_type));
  const licenses = myItems.filter(i => i.qualification_type === 'driver_license' || i.qualification_type === 'dbs_certificate' || i.qualification_type === 'forklift');
  const certificates = myItems.filter(i => !cardTypes.includes(i.qualification_type) && !['driver_license', 'dbs_certificate', 'forklift'].includes(i.qualification_type));
  const tabs = [
    { key: 'cards', label: 'Cards', icon: IdCard, items: cards },
    { key: 'licenses', label: 'Licenses', icon: Car, items: licenses },
    { key: 'certificates', label: 'Certificates', icon: Award, items: certificates },
  ].filter(t => t.items.length > 0);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
        <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      </div>
    );
  }

  const renderDoc = (item) => {
    const Icon = cardIcon(item.qualification_type);
    const hasBack = !!item.back_document_url;
    return (
      <div key={item.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50/40">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 border border-slate-200">
            <Icon className="w-4 h-4 text-slate-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
            {item.card_number && <p className="text-xs text-slate-500">Ref: {item.card_number}</p>}
          </div>
        </div>
        <div className={`grid gap-2 ${hasBack ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <DocThumb url={item.document_url} label="Front" />
          {hasBack && <DocThumb url={item.back_document_url} label="Back" />}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
          <FolderOpen className="w-4 h-4 text-sky-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">My Documents</h2>
          <p className="text-xs text-slate-500">{myItems.length} document{myItems.length !== 1 ? 's' : ''} on file</p>
        </div>
      </div>

      {myItems.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No documents on file" message="Your CSCS card, certificates and other credentials will appear here once your manager uploads them." />
      ) : tabs.length === 1 ? (
        <div className="space-y-4">
          {tabs[0].items.map(renderDoc)}
        </div>
      ) : (
        <Tabs defaultValue={tabs[0].key}>
          <TabsList className="w-full">
            {tabs.map(t => (
              <TabsTrigger key={t.key} value={t.key} className="flex-1 gap-1.5">
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                <span className="text-[10px] font-bold text-slate-400">({t.items.length})</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map(t => (
            <TabsContent key={t.key} value={t.key}>
              <div className="space-y-4">
                {t.items.map(renderDoc)}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}