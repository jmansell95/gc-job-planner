import React, { useState } from 'react';
import { X, Layers, Plus, Loader2, Check, Package } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Match a rig catalogue item to its RateCardItem (Our Rate Card).
const findRigRateCardItem = (rig, rateCardItems = []) => {
  if (rig.rate_card_item_id) {
    const linked = rateCardItems.find(r => r.id === rig.rate_card_item_id);
    if (linked) return linked;
  }
  const numMatch = (rig.description || '').match(/(\d{2,4})/);
  if (!numMatch) return null;
  const num = numMatch[1];
  return rateCardItems.find(r =>
    r.category === 'labour' &&
    (r.subcategory === 'Rotary Crews' || r.subcategory === 'Cable Percussive Crews') &&
    (r.description || '').includes(num) &&
    !/additional|3rd|enabling/i.test(r.description || '')
  );
};

export default function RigGearPickerModal({ rigs = [], catalogueItems = [], rateCardItems = [], onAdd, onClose, adding = false }) {
  const [selectedRig, setSelectedRig] = useState(null);

  const handleAdd = () => {
    if (!selectedRig) return;
    onAdd(selectedRig);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => !adding && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-700" />
            <h3 className="font-bold text-slate-900">Add Rig & Gear</h3>
          </div>
          <button onClick={() => !adding && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-500">Select a rig to add it and all its linked gear to the job. The day rate is pulled automatically from Our Rate Card — gear items are included at no extra cost.</p>
          {rigs.map(rig => {
            const gear = (rig.linked_catalogue_ids || []).map(id => catalogueItems.find(c => c.id === id)).filter(Boolean);
            const isSelected = selectedRig === rig.id;
            const rateCardItem = findRigRateCardItem(rig, rateCardItems);
            const dayRate = rateCardItem ? (Number(rateCardItem.price) || 0) : (Number(rig.default_unit_cost) || 0);
            const unit = rateCardItem?.unit || rig.default_unit_label || 'day';
            return (
              <button key={rig.id} onClick={() => setSelectedRig(isSelected ? null : rig.id)}
                className={`w-full text-left p-3 rounded-xl border-2 transition ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Layers className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-700' : 'text-slate-400'}`} />
                  <p className="text-sm font-bold text-slate-900 flex-1 truncate">{rig.description}</p>
                  {rig.reference_number && <span className="text-[10px] text-slate-400 font-normal truncate">{rig.reference_number}</span>}
                  {rateCardItem && <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full flex-shrink-0">Rate Card</span>}
                  {isSelected && <Check className="w-4 h-4 text-blue-700 flex-shrink-0" />}
                </div>
                <div className="ml-6 space-y-0.5">
                  {gear.length === 0 ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 italic">
                      <Package className="w-3 h-3 text-slate-300 flex-shrink-0" />
                      <span>No linked gear yet — add links in GC Compliance Manager and sync</span>
                    </div>
                  ) : (
                    gear.map(g => (
                      <div key={g.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Package className="w-3 h-3 text-slate-300 flex-shrink-0" />
                        <span className="truncate">{g.description}</span>
                        {g.reference_number && <span className="text-slate-400 flex-shrink-0">({g.reference_number})</span>}
                        <span className="text-slate-400 ml-auto flex-shrink-0">included</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="ml-6 mt-1.5 flex items-center gap-2 text-xs">
                  <span className="text-slate-400">{gear.length} gear item{gear.length !== 1 ? 's' : ''} included</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-semibold text-blue-700">{fmt(dayRate)} / {unit}</span>
                  {rateCardItem && <span className="text-slate-400 truncate">({rateCardItem.description})</span>}
                </div>
              </button>
            );
          })}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
          <button onClick={handleAdd} disabled={!selectedRig || adding}
            className="flex-1 py-2.5 bg-blue-700 text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : <><Plus className="w-4 h-4" /> Add to Job</>}
          </button>
          <button onClick={() => !adding && onClose()} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}