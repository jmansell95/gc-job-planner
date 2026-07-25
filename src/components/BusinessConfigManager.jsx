import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Scale, Save, Loader2, Clock, Route } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const DEFAULTS = { required_daily_on_site_minutes: 540, travel_deductible_minutes: 90 };

const fmtHM = (mins) => {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return `${r}m`;
};

export default function BusinessConfigManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: config, isLoading } = useQuery({
    queryKey: ['business-config'],
    queryFn: async () => {
      const list = await base44.entities.BusinessConfig.filter({ key: 'global' });
      return list[0] || null;
    },
  });

  const [requiredMins, setRequiredMins] = useState(DEFAULTS.required_daily_on_site_minutes);
  const [travelMins, setTravelMins] = useState(DEFAULTS.travel_deductible_minutes);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState(null);

  useEffect(() => {
    if (config) {
      setConfigId(config.id || null);
      setRequiredMins(Number(config.required_daily_on_site_minutes) || DEFAULTS.required_daily_on_site_minutes);
      setTravelMins(Number(config.travel_deductible_minutes) || DEFAULTS.travel_deductible_minutes);
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { key: 'global', required_daily_on_site_minutes: Number(requiredMins), travel_deductible_minutes: Number(travelMins) };
      if (configId) {
        await base44.entities.BusinessConfig.update(configId, payload);
      } else {
        const created = await base44.entities.BusinessConfig.create(payload);
        setConfigId(created.id);
      }
      queryClient.invalidateQueries({ queryKey: ['business-config'] });
      toast({ title: 'Business rules saved', description: 'Timesheet engine will use the new values from the next submission.' });
    } catch (e) {
      toast({ title: 'Could not save', description: e.message || 'Please try again', variant: 'destructive' });
    }
    setSaving(false);
  };

  const dirty = (Number(requiredMins) !== (Number(config?.required_daily_on_site_minutes) || DEFAULTS.required_daily_on_site_minutes)) ||
                (Number(travelMins) !== (Number(config?.travel_deductible_minutes) || DEFAULTS.travel_deductible_minutes));

  return (
    <div>
      <SettingsSectionHeader
        icon={Scale}
        title="Business Rules"
        description="Core working rules that drive the timesheet & payroll engine"
        actions={
          <button onClick={handleSave} disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#245215] disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save rules
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Required daily on-site hours */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Required daily on-site hours</h3>
              <p className="text-xs text-slate-500 mt-0.5">Crew must log this much on-site work before an early-leave reason is required.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="number" min={0} step={15} value={requiredMins}
              onChange={(e) => setRequiredMins(e.target.value)}
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:border-[#2E5A1A]" />
            <span className="text-sm text-slate-500">minutes</span>
            <span className="ml-auto text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">{fmtHM(requiredMins)}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">Default 540 min (9h). Under this with no early-leave reason, submission is blocked.</p>
        </div>

        {/* Travel deductible */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
              <Route className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Travel deductible per leg</h3>
              <p className="text-xs text-slate-500 mt-0.5">Travel time deducted from each leg (to-site & from-site) before it becomes payable.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="number" min={0} step={15} value={travelMins}
              onChange={(e) => setTravelMins(e.target.value)}
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:border-[#2E5A1A]" />
            <span className="text-sm text-slate-500">minutes</span>
            <span className="ml-auto text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">{fmtHM(travelMins)}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">Default 90 min (1.5h) per leg. Depot teams are exempt — they get full travel time paid.</p>
        </div>
      </div>

      <div className="mt-4 bg-[#2E5A1A]/5 border border-[#2E5A1A]/15 rounded-xl p-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold text-[#2E5A1A]">How this works:</span> these rules are read live by the timesheet engine every time a crew member submits their daily summary. Change a value here and it applies to every future submission — no code changes needed. Existing approved/merged timesheets are not recalculated.
        </p>
      </div>
    </div>
  );
}