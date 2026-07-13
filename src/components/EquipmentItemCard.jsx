import React from 'react';
import { Edit2, Trash2, FileCheck, Package } from 'lucide-react';
import { format } from 'date-fns';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function EquipmentItemCard({ item: c, linkedItems = [], assetMap = {}, suppliers = [], contractors = [], isJobMode, categoryConfig, locationBadge, complianceConfig, onEdit, onDelete, onOffHire }) {
  const net = (Number(c.unit_cost) || 0) * (Number(c.quantity) || 1);
  const cfg = categoryConfig[c.category] || categoryConfig.hired_equipment;
  const CatIcon = cfg.icon;
  const supplier = suppliers.find(s => s.id === c.supplier_id);
  const contractor = contractors.find(ct => ct.id === c.contractor_id);
  const isContractorItem = c.category === 'contractor_supplied';
  const loc = c.current_location || 'yard';
  const locBadge = locationBadge[loc];
  const asset = c.site_asset_id ? assetMap[c.site_asset_id] : null;
  const cb = asset ? (complianceConfig[asset.compliance_status] || complianceConfig.unknown) : null;
  const ComplianceIcon = cb?.icon;

  return (
    <div className={`border rounded-lg p-3 transition ${linkedItems.length > 0 ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <CatIcon className={`w-4 h-4 ${cfg.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900 truncate">{c.description}</p>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{cfg.label}</span>
            {cb && ComplianceIcon && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${cb.badge}`}><ComplianceIcon className="w-2.5 h-2.5" /> {cb.label}</span>}
            {c.po_number && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium font-mono inline-flex items-center gap-1"><Package className="w-2.5 h-2.5" />{c.po_number}</span>}
            {c.reference_number && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium font-mono">Ref: {c.reference_number}</span>}
            {c.vat_exempt && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">VAT exempt</span>}
            {isJobMode && locBadge && loc !== 'yard' && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${locBadge.cls}`}>{locBadge.label}</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isContractorItem ? (
              <>
                {contractor && `${contractor.name}`}
                {` · ${c.quantity} ${c.unit_label}${c.quantity > 1 ? 's' : ''}`}
                {` · Supplied by contractor`}
              </>
            ) : (
              <>
                {c.start_date && c.end_date ? `${format(new Date(c.start_date + 'T00:00:00'), 'dd MMM')} → ${format(new Date(c.end_date + 'T00:00:00'), 'dd MMM')}` : ''}
                {supplier && ` · ${supplier.name}`}
                {` · ${c.quantity} ${c.unit_label}${c.quantity > 1 ? 's' : ''}`}
                {` · ${fmt(Number(c.unit_cost) || 0)}/${c.unit_label}`}
              </>
            )}
          </p>
          {isJobMode && c.category === 'hired_equipment' && (
            <button onClick={() => onOffHire(c)} className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 font-medium bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition">
              <FileCheck className="w-3.5 h-3.5" /> Return Item
            </button>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {isContractorItem ? (
            <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide">Contractor</p>
          ) : (
            <>
              <p className="text-sm font-bold text-emerald-700">{fmt(net)}</p>
              <p className="text-[10px] text-slate-400">revenue</p>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={() => onEdit(c)} className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(c.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {linkedItems.length > 0 && (
        <div className="ml-12 mt-2 space-y-1 border-l-2 border-blue-200 pl-3">
          {linkedItems.map(li => {
            const lnet = (Number(li.unit_cost) || 0) * (Number(li.quantity) || 1);
            const lcfg = categoryConfig[li.category] || categoryConfig.hired_equipment;
            const LIcon = lcfg.icon;
            const lasset = li.site_asset_id ? assetMap[li.site_asset_id] : null;
            const lcb = lasset ? (complianceConfig[lasset.compliance_status] || complianceConfig.unknown) : null;
            const LCompIcon = lcb?.icon;
            return (
              <div key={li.id} className="flex items-center gap-2 py-0.5">
                <LIcon className={`w-3 h-3 ${lcfg.text} flex-shrink-0`} />
                <span className="text-xs font-medium text-slate-700 truncate">{li.description}</span>
                {lcb && LCompIcon && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${lcb.badge}`}><LCompIcon className="w-2 h-2" /> {lcb.label}</span>}
                {li.reference_number && <span className="text-[9px] text-slate-400 font-mono">{li.reference_number}</span>}
                <span className="text-xs text-slate-400 ml-auto flex-shrink-0">{fmt(lnet)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}