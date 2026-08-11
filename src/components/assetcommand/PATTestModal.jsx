import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  X, Plug, Loader2, CheckCircle2, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { playConfirm } from '@/utils/scanFeedback';

const APPLIANCE_CLASSES = [
  { value: 'class_I', label: 'Class I (earthed)' },
  { value: 'class_II', label: 'Class II (double-insulated)' },
  { value: 'class_III', label: 'Class III (SELV)' },
  { value: 'extension_lead', label: 'Extension Lead / IEC' },
];

/**
 * PAT Test Modal — portable appliance testing form for portable_appliance assets.
 * Captures visual check, earth continuity, insulation resistance, load/leakage
 * current, and lead polarity. Auto-evaluates pass/fail and sets the next test
 * due date (1 year). Creates a ServiceRecord and updates the SiteAsset compliance.
 * Pushes the status change to Asset Panda.
 */
export default function PATTestModal({ asset, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    appliance_class: 'class_I',
    visual_pass: true,
    earth_continuity: '',
    insulation_resistance: '',
    load_current: '',
    leakage_current: '',
    lead_polarity: 'n/a',
    tester_serial: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isClassI = form.appliance_class === 'class_I';
  const isLead = form.appliance_class === 'extension_lead';

  // Auto-evaluate pass/fail
  const evalResult = () => {
    if (!form.visual_pass) return 'fail';
    if (isClassI) {
      const ec = parseFloat(form.earth_continuity);
      if (isNaN(ec) || ec >= 0.1) return 'fail';
      const ir = parseFloat(form.insulation_resistance);
      if (!isNaN(ir) && ir < 1.0) return 'fail';
    }
    if (!isClassI && form.insulation_resistance) {
      const ir = parseFloat(form.insulation_resistance);
      if (!isNaN(ir) && ir < 2.0) return 'fail';
    }
    if (form.leakage_current) {
      const lc = parseFloat(form.leakage_current);
      if (!isNaN(lc) && lc > 3.5) return 'fail';
    }
    if (isLead && form.lead_polarity === 'fail') return 'fail';
    return 'pass';
  };

  const result = evalResult();

  const handleSave = async () => {
    if (!asset) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const nextDue = new Date();
      nextDue.setFullYear(nextDue.getFullYear() + 1);
      const nextDueStr = nextDue.toISOString().slice(0, 10);

      const record = await base44.entities.ServiceRecord.create({
        site_asset_id: asset.id,
        record_type: 'pat_inspection',
        date: today,
        result,
        notes: form.notes || `PAT test — ${result.toUpperCase()}`,
        pat_appliance_class: form.appliance_class,
        pat_visual_pass: form.visual_pass,
        pat_earth_continuity: isClassI ? parseFloat(form.earth_continuity) || null : null,
        pat_insulation_resistance: parseFloat(form.insulation_resistance) || null,
        pat_load_current: parseFloat(form.load_current) || null,
        pat_leakage_current: parseFloat(form.leakage_current) || null,
        pat_lead_polarity: isLead ? form.lead_polarity : 'n/a',
        pat_tester_serial: form.tester_serial || '',
        resulting_expiry_date: result === 'pass' ? nextDueStr : null,
      });

      // Update asset compliance
      const complianceStatus = result === 'pass' ? 'compliant' : 'expired';
      await base44.entities.SiteAsset.update(asset.id, {
        compliance_status: complianceStatus,
        compliance_expiry_date: result === 'pass' ? nextDueStr : null,
        compliance_last_checked: new Date().toISOString(),
        last_service_date: today,
        maintenance_status: result === 'pass' ? 'ok' : 'overdue',
        service_notes: `PAT test ${result}: ${form.notes || ''}`,
      });

      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['service-records'] });

      // Push to Asset Panda (best-effort)
      try {
        await base44.functions.invoke('pushAssetUpdateToPanda', { asset_id: asset.id, action: 'update' });
      } catch (pushErr) {
        console.warn('Asset Panda push failed (non-blocking):', pushErr);
      }

      playConfirm();
      setSaved(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      console.error('PAT test save error:', err);
      toast({ title: 'Error', description: 'Could not save the PAT test.', variant: 'destructive' });
    }
    setSaving(false);
  };

  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Plug className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">PAT Test</h3>
              <p className="text-[11px] text-slate-400 truncate">{asset.name}</p>
            </div>
          </div>
          <button onClick={() => !saving && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>

        {saved ? (
          <div className="p-8 text-center">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${result === 'pass' ? 'bg-emerald-100' : 'bg-red-100'}`}>
              {result === 'pass' ? <CheckCircle2 className="w-7 h-7 text-emerald-600" /> : <AlertTriangle className="w-7 h-7 text-red-600" />}
            </div>
            <p className="font-bold text-slate-900 mb-1">PAT Test {result === 'pass' ? 'Passed' : 'Failed'}</p>
            <p className="text-sm text-slate-500">{result === 'pass' ? 'Next test due in 1 year. Syncing to Asset Panda.' : 'Asset marked as expired. Syncing to Asset Panda.'}</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Result preview */}
            <div className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 border ${result === 'pass' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              {result === 'pass' ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
              <span className={`text-sm font-bold ${result === 'pass' ? 'text-emerald-700' : 'text-red-700'}`}>Result: {result === 'pass' ? 'PASS' : 'FAIL'}</span>
            </div>

            {/* Appliance class */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Appliance Class</label>
              <select value={form.appliance_class} onChange={e => setForm(p => ({ ...p, appliance_class: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base focus:outline-none focus:border-purple-600 bg-white">
                {APPLIANCE_CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {/* Visual check */}
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3.5 py-3">
              <span className="text-sm font-medium text-slate-700">Visual inspection passed?</span>
              <div className="flex gap-1">
                <button onClick={() => setForm(p => ({ ...p, visual_pass: true }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${form.visual_pass ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>Pass</button>
                <button onClick={() => setForm(p => ({ ...p, visual_pass: false }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${!form.visual_pass ? 'bg-red-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>Fail</button>
              </div>
            </div>

            {/* Earth continuity (Class I only) */}
            {isClassI && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Earth Continuity (Ω) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" value={form.earth_continuity} onChange={e => setForm(p => ({ ...p, earth_continuity: e.target.value }))}
                  placeholder="e.g. 0.05 — pass if < 0.1Ω"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base focus:outline-none focus:border-purple-600" />
              </div>
            )}

            {/* Insulation resistance */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Insulation Resistance (MΩ)</label>
              <input type="number" step="0.01" value={form.insulation_resistance} onChange={e => setForm(p => ({ ...p, insulation_resistance: e.target.value }))}
                placeholder={isClassI ? 'e.g. 2.5 — pass if > 1.0 MΩ' : 'e.g. 5.0 — pass if > 2.0 MΩ'}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base focus:outline-none focus:border-purple-600" />
            </div>

            {/* Load / leakage current */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Load (mA)</label>
                <input type="number" step="0.01" value={form.load_current} onChange={e => setForm(p => ({ ...p, load_current: e.target.value }))}
                  placeholder="e.g. 0.5"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base focus:outline-none focus:border-purple-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Leakage (mA)</label>
                <input type="number" step="0.01" value={form.leakage_current} onChange={e => setForm(p => ({ ...p, leakage_current: e.target.value }))}
                  placeholder="pass if < 3.5"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base focus:outline-none focus:border-purple-600" />
              </div>
            </div>

            {/* Lead polarity (leads only) */}
            {isLead && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Lead Polarity</label>
                <select value={form.lead_polarity} onChange={e => setForm(p => ({ ...p, lead_polarity: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base focus:outline-none focus:border-purple-600 bg-white">
                  <option value="n/a">N/A</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </div>
            )}

            {/* Tester serial */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">PAT Tester Serial</label>
              <input type="text" value={form.tester_serial} onChange={e => setForm(p => ({ ...p, tester_serial: e.target.value }))}
                placeholder="KEWPAT serial number"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base font-mono focus:outline-none focus:border-purple-600" />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                placeholder="Observations, defects…"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-base focus:outline-none focus:border-purple-600 resize-none" />
            </div>
          </div>
        )}

        {!saved && (
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
            <button onClick={handleSave} disabled={saving || (isClassI && !form.earth_continuity)}
              className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 active:scale-95">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <Plug className="w-4 h-4" />} Save PAT Test
            </button>
            <button onClick={() => !saving && onClose()} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}