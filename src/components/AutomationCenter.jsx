import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Zap, Clock, ToggleLeft, ToggleRight, Mail, Plus, Edit2, Trash2, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const emailAlertMap = {
  vehicle_maintenance: 'vehicle_maintenance',
  compliance_expiry: 'compliance_expiry',
  assignment_notification: 'assignment_notification',
};

const emptyForm = {
  automation_key: '',
  label: '',
  description: '',
  category: 'entity',
  trigger_label: '',
  managed_via: 'automation_control',
  enabled: true,
};

export default function AutomationCenter() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [toggling, setToggling] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

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
      toast({ title: 'Could not toggle', description: e?.message, variant: 'destructive' });
    }
    setToggling(null);
  };

  const openAdd = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (c) => {
    setFormData({
      automation_key: c.automation_key || '',
      label: c.label || '',
      description: c.description || '',
      category: c.category || 'entity',
      trigger_label: c.trigger_label || '',
      managed_via: c.managed_via || 'automation_control',
      enabled: c.enabled !== false,
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!formData.label.trim() || !formData.automation_key.trim()) {
      toast({ title: 'Label and key are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        automation_key: formData.automation_key.trim().replace(/\s+/g, '_').toLowerCase(),
        label: formData.label.trim(),
        description: formData.description.trim(),
        category: formData.category,
        trigger_label: formData.trigger_label.trim(),
        managed_via: formData.managed_via,
        enabled: formData.enabled,
      };
      if (editingId) {
        await base44.entities.AutomationControl.update(editingId, payload);
        toast({ title: 'Automation updated' });
      } else {
        await base44.entities.AutomationControl.create(payload);
        toast({ title: 'Automation added' });
      }
      queryClient.invalidateQueries({ queryKey: ['automation-controls'] });
      setShowForm(false);
      setEditingId(null);
      setFormData(emptyForm);
    } catch (err) {
      toast({ title: 'Could not save', description: err?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (c) => {
    if (!confirm(`Delete "${c.label}"? This removes it from the automation dashboard.`)) return;
    setDeleting(c.id);
    try {
      await base44.entities.AutomationControl.delete(c.id);
      queryClient.invalidateQueries({ queryKey: ['automation-controls'] });
      toast({ title: 'Automation removed' });
    } catch (err) {
      toast({ title: 'Could not delete', description: err?.message, variant: 'destructive' });
    }
    setDeleting(null);
  };

  const sorted = [...controls].sort((a, b) => {
    if (a.category === b.category) return 0;
    return a.category === 'scheduled' ? -1 : 1;
  });
  const activeCount = sorted.filter(getEnabled).length;

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <PageHeader title="Automations" icon={Zap} />
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium flex-shrink-0">
          <Plus className="w-4 h-4" /> Add Automation
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-2 max-w-2xl">
        Automated workflows run in the background — on a schedule or when data changes — so you never have to send reminders or chase updates manually.
      </p>
      <p className="text-xs text-slate-400 mb-6">{activeCount} of {sorted.length} automations active</p>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-xl p-5 border border-emerald-200 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">{editingId ? 'Edit Automation' : 'New Automation'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Label *</label>
              <input value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="e.g. Weekly Cost Report" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Key *</label>
              <input value={formData.automation_key} onChange={e => setFormData({ ...formData, automation_key: e.target.value })} placeholder="e.g. weekly_cost_report" className={inputCls} disabled={!!editingId} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="What this automation does" rows={2} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className={inputCls}>
                <option value="scheduled">Scheduled</option>
                <option value="entity">Event-driven</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Trigger Label</label>
              <input value={formData.trigger_label} onChange={e => setFormData({ ...formData, trigger_label: e.target.value })} placeholder="e.g. Mondays · 08:00 or On new invoice" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Managed Via</label>
              <select value={formData.managed_via} onChange={e => setFormData({ ...formData, managed_via: e.target.value })} className={inputCls}>
                <option value="automation_control">Automation Control</option>
                <option value="email_alert">Email Alert Setting</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" checked={formData.enabled} onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-sm text-slate-600">Enabled</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Add'} Automation
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-sm text-slate-400">Loading automations…</div>
      ) : sorted.length === 0 ? (
        <div className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl p-8 text-center">No automations yet. Add your first one above.</div>
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
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`inline-flex items-center gap-1.5 font-medium ${isOn ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                      {isOn ? 'Active' : 'Paused'}
                    </span>
                    {c.managed_via === 'automation_control' && c.last_run_at && (
                      <span className="text-slate-400">Last run: {format(new Date(c.last_run_at), 'dd MMM, HH:mm')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(c)} disabled={deleting === c.id} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}