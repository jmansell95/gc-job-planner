import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { X, PoundSterling, Loader2, Check } from 'lucide-react';

/**
 * Modal for setting personal day rates on multiple staff members at once.
 * Creates a RateCardItem (category: labour, staff_id: <id>) for each staff
 * member with the entered rate. Fixes the £0 labour cost issue.
 */
export default function BulkRateEntryModal({ staff, onClose }) {
  const { toast } = useToast();
  const [rates, setRates] = useState(() => {
    const obj = {};
    staff.forEach(s => { obj[s.id] = ''; });
    return obj;
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(0);

  const handleSave = async () => {
    const toCreate = staff
      .filter(s => rates[s.id] && !isNaN(parseFloat(rates[s.id])))
      .map(s => ({
        category: 'labour',
        subcategory: 'Personal Day Rate',
        description: `${s.name} — Day Rate`,
        price: parseFloat(rates[s.id]),
        cost_price: parseFloat(rates[s.id]) * 0.7,
        unit: 'day',
        men: 1,
        staff_id: s.id,
        is_active: true,
      }));

    if (toCreate.length === 0) {
      toast({ title: 'No rates entered', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Create in batches of 20
      for (let i = 0; i < toCreate.length; i += 20) {
        const batch = toCreate.slice(i, i + 20);
        await base44.entities.RateCardItem.bulkCreate(batch);
        setDone(Math.min(i + 20, toCreate.length));
      }
      toast({ title: `${toCreate.length} day rates saved`, description: 'Labour costs will now calculate correctly.' });
      onClose();
    } catch (err) {
      toast({ title: 'Failed to save rates', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filledCount = Object.values(rates).filter(v => v && !isNaN(parseFloat(v))).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
              <PoundSterling className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Set Day Rates</h2>
              <p className="text-xs text-slate-500">{staff.length} crew {staff.length === 1 ? 'member' : 'members'} need a rate</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{s.name}</p>
                <p className="text-xs text-slate-500">{s.job_title || s.worker_type || 'Staff'}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-sm text-slate-400">£</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={rates[s.id]}
                  onChange={e => setRates(prev => ({ ...prev, [s.id]: e.target.value }))}
                  className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <span className="text-xs text-slate-400 w-8">/day</span>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {filledCount} of {staff.length} filled
            {done > 0 && <span className="text-emerald-600 ml-1.5">· {done} saved</span>}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || filledCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Rates'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}