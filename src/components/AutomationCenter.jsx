import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Zap, Clock, ToggleLeft, ToggleRight, Mail } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { format } from 'date-fns';

const emailAlertMap = {
  vehicle_maintenance: 'vehicle_maintenance',
  assignment_notification: 'assignment_notification',
};

export default function AutomationCenter() {
  const queryClient = useQueryClient();
  const [toggling, setToggling] = useState(null);

  const { data: controls = [], isLoading } = useQuery({
    queryKey: ['automation-controls'],
    queryFn: () => base44.entities.AutomationControl.list()
  });
  const { data: emailAlerts = [] } = useQuery({
    queryKey: ['email-alert-settings-all'],
    queryFn: () => base44.entities.EmailAlertSetting.list()
  });

  const getEnabled = (c) => {
    if (c.managed_via === 'email_alert') {
      const key = emailAlertMap[c.automation_key];
      const cfg = emailAlerts.find(e => e.alert_key === key);
      return cfg ? cfg.enabled !== false : true;
    }
    return c.enabled !== false;
  };

  const handleToggle = async (c) => {
    setToggling(c.automation_key);
    try {
      const newVal = !getEnabled(c);
      if (c.managed_via === 'email_alert') {
        const key = emailAlertMap[c.automation_key];
        const existing = emailAlerts.find(e => e.alert_key === key);
        if (existing) {
          await base44.entities.EmailAlertSetting.update(existing.id, { enabled: newVal });
        } else {
          await base44.entities.EmailAlertSetting.create({ alert_key: key, enabled: newVal });
        }
        queryClient.invalidateQueries({ queryKey: ['email-alert-settings-all'] });
      } else {
        await base44.entities.AutomationControl.update(c.id, { enabled: newVal });
        queryClient.invalidateQueries({ queryKey: ['automation-controls'] });
      }
    } catch (e) {
      console.error('Toggle error', e);
    }
    setToggling(null);
  };

  const sorted = [...controls].sort((a, b) => {
    if (a.category === b.category) return 0;
    return a.category === 'scheduled' ? -1 : 1;
  });
  const activeCount = sorted.filter(getEnabled).length;

  return (
    <div>
      <PageHeader title="Automations" icon={Zap} />
      <p className="text-sm text-slate-500 mb-2 max-w-2xl">
        Automated workflows run in the background — on a schedule or when data changes — so you never have to send reminders or chase updates manually.
      </p>
      <p className="text-xs text-slate-400 mb-6">{activeCount} of {sorted.length} automations active</p>

      {isLoading ? (
        <div className="text-sm text-slate-400">Loading automations…</div>
      ) : sorted.length === 0 ? (
        <div className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl p-8 text-center">
          Automations are being set up. Check back shortly.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map(c => {
            const isOn = getEnabled(c);
            return (
              <div key={c.id} className={`rounded-xl border p-4 transition ${isOn ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isOn ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                      {c.category === 'scheduled' ? <Clock className="w-4 h-4 text-white" /> : <Zap className="w-4 h-4 text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">{c.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>
                    </div>
                  </div>
                  <button onClick={() => handleToggle(c)} disabled={toggling === c.automation_key}
                    className="flex items-center gap-1.5 text-xs font-medium px-1 py-1 rounded-lg transition flex-shrink-0 disabled:opacity-50">
                    {isOn ? <ToggleRight className="w-8 h-8 text-emerald-600" /> : <ToggleLeft className="w-8 h-8 text-slate-300" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.category === 'scheduled' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {c.category === 'scheduled' ? 'Scheduled' : 'Event-driven'}
                  </span>
                  <span className="text-[10px] text-slate-500 inline-flex items-center gap-1">
                    {c.category === 'scheduled' ? <Clock className="w-3 h-3" /> : <Zap className="w-3 h-3" />} {c.trigger_label}
                  </span>
                  {c.managed_via === 'email_alert' && (
                    <span className="text-[10px] text-slate-400 inline-flex items-center gap-1"><Mail className="w-3 h-3" /> via Email Alerts</span>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className={`inline-flex items-center gap-1.5 font-medium ${isOn ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                    {isOn ? 'Active' : 'Paused'}
                  </span>
                  {c.managed_via === 'automation_control' && c.last_run_at ? (
                    <span className="text-slate-400">Last run: {format(new Date(c.last_run_at), 'dd MMM, HH:mm')}</span>
                  ) : c.managed_via === 'automation_control' ? (
                    <span className="text-slate-400">Not run yet</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}