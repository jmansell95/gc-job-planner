import React, { useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

export default function EquipmentListEditor({ items, setItems }) {
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('1');

  const addItem = (e) => {
    e.preventDefault();
    if (!desc.trim()) return;
    setItems([...items, { description: desc.trim(), quantity: parseInt(qty) || 1 }]);
    setDesc('');
    setQty('1');
  };

  const removeItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2.5">
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
              <Package className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-sm text-slate-700 flex-1 truncate">{item.description}</span>
              <span className="text-xs text-slate-400 font-medium">×{item.quantity}</span>
              <button type="button" onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={addItem} className="flex items-center gap-2">
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="e.g. Excavator, Transformer, 50m Heras fencing"
          className={inputCls}
        />
        <input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-16 px-2 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm text-center"
        />
        <button type="submit" disabled={!desc.trim()} className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition text-sm font-medium disabled:opacity-40 flex items-center gap-1 flex-shrink-0">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>
      {items.length === 0 && (
        <p className="text-xs text-slate-400">List the equipment needed — items start at depot and are tracked through to site and back.</p>
      )}
    </div>
  );
}