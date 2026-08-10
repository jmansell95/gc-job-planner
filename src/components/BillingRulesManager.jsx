import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote, Plus, Trash2, Edit2, Check, Truck, ClipboardList, Package,
  MapPin, Search, PoundSterling, Route, Clock, ToggleRight, ToggleLeft,
  Link2, FileText, TrendingUp,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/StateViews';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import RateCardLinkSelector from '@/components/billing/RateCardLinkSelector';
import ChargeCalculator from '@/components/billing/ChargeCalculator';
import {
  fmt, ruleTypeConfig, chargeMethodConfig, blankForm, inputCls,
} from '@/components/billing/shared';

function ChargePreview({ form, linkedRateCard }) {
  const method = chargeMethodConfig[form.charge_method];
  if (!method) return null;
  const rate = linkedRateCard?.price;
  const parts = [];
  if (method.fields.includes('flat_fee')) parts.push(`Flat ${fmt(rate ?? form.flat_fee)}`);
  if (method.fields.includes('per_mile_rate')) parts.push(`${fmt(rate ?? form.per_mile_rate)}/mi`);
  if (method.fields.includes('per_hour_rate')) parts.push(`${fmt(rate ?? form.per_hour_rate)}/h`);
  if (method.fields.includes('per_unit_rate')) parts.push(`${fmt(rate ?? form.per_unit_rate)}/${form.unit_label || 'unit'}`);
  if (parts.length === 0) return null;
  return (
    <div className={`border rounded-lg px-3 py-2 text-xs font-medium ${linkedRateCard ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
      {linkedRateCard ? (
        <span className="flex items-center gap-1.5">
          <Link2 className="w-3 h-3" /> Rate Card: {linkedRateCard.description?.substring(0, 40)} — {method.label}: {parts.join(' + ')}
        </span>
      ) : (
        <span>{method.label}: {parts.join(' + ')}</span>
      )}
    </div>
  );
}

function RuleForm({ form, setForm, onSubmit, onCancel, saving, rateCardItems }) {
  const methodFields = chargeMethodConfig[form.charge_method]?.fields || [];
  const linkedRateCard = rateCardItems?.find(r => r.id === form.rate_card_item_id);
  const isLinked = !!linkedRateCard;

  return (
    <form onSubmit={onSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Rule Type *</label>
          <select value={form.rule_type} onChange={e => setForm({ ...form, rule_type: e.target.value })} className={inputCls}>
            {Object.entries(ruleTypeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Charge Method *</label>
          <select value={form.charge_method} onChange={e => setForm({ ...blankForm(), rule_type: form.rule_type, name: form.name, description: form.description, is_chargeable: form.is_chargeable, is_active: form.is_active, category: form.category, sort_order: form.sort_order, charge_method: e.target.value })} className={inputCls}>
            {Object.entries(chargeMethodConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {form.rule_type === 'task' ? 'Task Name * (must match what staff enter)' : 'Name *'}
        </label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
          placeholder={form.rule_type === 'task' ? 'e.g. Setting up the rig' : form.rule_type === 'consumable' ? 'e.g. Cable Ties (bag)' : 'e.g. Standard Site Delivery'}
          className={inputCls} />
        {form.rule_type === 'task' && <p className="text-[11px] text-slate-400 mt-1">When staff log this exact task name, the system auto-applies this charge.</p>}
      </div>

      {/* Rate Card Link — the key new feature */}
      <RateCardLinkSelector form={form} setForm={setForm} rateCardItems={rateCardItems} />

      {/* Manual rate fields — shown only when NOT linked to a rate card */}
      {!isLinked && (
        <>
          {form.rule_type === 'consumable' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Per Unit Rate (£) *</label>
                <input type="number" min="0" step="0.01" value={form.per_unit_rate} onChange={e => setForm({ ...form, per_unit_rate: e.target.value })} required placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Unit Label</label>
                <input value={form.unit_label} onChange={e => setForm({ ...form, unit_label: e.target.value })} placeholder="bag, can, each" className={inputCls} />
              </div>
            </div>
          )}
          {methodFields.includes('flat_fee') && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Flat Fee (£)</label>
              <input type="number" min="0" step="0.01" value={form.flat_fee} onChange={e => setForm({ ...form, flat_fee: e.target.value })} placeholder="0.00" className={inputCls} />
            </div>
          )}
          {methodFields.includes('per_mile_rate') && (
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Route className="w-3 h-3" /> Per Mile Rate (£)</label>
              <input type="number" min="0" step="0.01" value={form.per_mile_rate} onChange={e => setForm({ ...form, per_mile_rate: e.target.value })} placeholder="0.00" className={inputCls} />
            </div>
          )}
          {methodFields.includes('per_hour_rate') && (
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Clock className="w-3 h-3" /> Per Hour Rate (£)</label>
              <input type="number" min="0" step="0.01" value={form.per_hour_rate} onChange={e => setForm({ ...form, per_hour_rate: e.target.value })} placeholder="0.00" className={inputCls} />
            </div>
          )}
        </>
      )}

      <ChargePreview form={form} linkedRateCard={isLinked ? linkedRateCard : null} />
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
        <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Internal notes about this rule" className={inputCls} />
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <button type="button" onClick={() => setForm({ ...form, is_chargeable: !form.is_chargeable })}
          className="flex items-center gap-1.5 text-sm">
          {form.is_chargeable ? <ToggleRight className="w-6 h-6 text-emerald-600" /> : <ToggleLeft className="w-6 h-6 text-slate-300" />}
          <span className={form.is_chargeable ? 'text-slate-700 font-medium' : 'text-slate-400'}>Chargeable</span>
        </button>
        <button type="button" onClick={() => setForm({ ...form, is_active: !form.is_active })}
          className="flex items-center gap-1.5 text-sm">
          {form.is_active ? <ToggleRight className="w-6 h-6 text-emerald-600" /> : <ToggleLeft className="w-6 h-6 text-slate-300" />}
          <span className={form.is_active ? 'text-slate-700 font-medium' : 'text-slate-400'}>Active</span>
        </button>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-semibold hover:bg-emerald-800 transition disabled:opacity-50">
          {saving ? 'Saving…' : <><Check className="w-4 h-4" /> Save Rule</>}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-300 transition">Cancel</button>
      </div>
    </form>
  );
}

export default function BillingRulesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['billing-rules'],
    queryFn: () => base44.entities.BillingRule.list('-sort_order', 200),
  });

  const { data: rateCardItems = [] } = useQuery({
    queryKey: ['rate-card-items-for-linking'],
    queryFn: () => base44.entities.RateCardItem.filter({ is_active: true }, '-sort_order', 500),
  });

  const filtered = rules.filter(r => {
    if (filter !== 'all' && r.rule_type !== filter) return false;
    if (search && !r.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: rules.length,
    delivery: rules.filter(r => r.rule_type === 'delivery').length,
    task: rules.filter(r => r.rule_type === 'task').length,
    consumable: rules.filter(r => r.rule_type === 'consumable').length,
    site_visit: rules.filter(r => r.rule_type === 'site_visit').length,
  };
  const linkedCount = rules.filter(r => !!r.rate_card_item_id).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const linkedItem = form.rate_card_item_id ? rateCardItems.find(r => r.id === form.rate_card_item_id) : null;
      const payload = {
        rule_type: form.rule_type,
        name: form.name.trim(),
        description: form.description || '',
        charge_method: form.charge_method,
        rate_card_item_id: form.rate_card_item_id || '',
        rate_card_item_description: linkedItem?.description || '',
        flat_fee: form.flat_fee === '' ? 0 : parseFloat(form.flat_fee),
        per_mile_rate: form.per_mile_rate === '' ? 0 : parseFloat(form.per_mile_rate),
        per_hour_rate: form.per_hour_rate === '' ? 0 : parseFloat(form.per_hour_rate),
        per_unit_rate: form.per_unit_rate === '' ? 0 : parseFloat(form.per_unit_rate),
        unit_label: form.unit_label || 'each',
        is_chargeable: !!form.is_chargeable,
        is_active: !!form.is_active,
        category: form.category || '',
        sort_order: Number(form.sort_order) || 0,
      };
      if (editingId) {
        await base44.entities.BillingRule.update(editingId, payload);
        toast({ title: 'Rule updated' });
      } else {
        await base44.entities.BillingRule.create(payload);
        toast({ title: 'Rule created' });
      }
      queryClient.invalidateQueries({ queryKey: ['billing-rules'] });
      setShowForm(false); setEditingId(null); setForm(blankForm());
    } catch (err) {
      toast({ title: 'Error saving rule', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleEdit = (r) => {
    setEditingId(r.id);
    setForm({
      rule_type: r.rule_type || 'delivery',
      name: r.name || '',
      description: r.description || '',
      charge_method: r.charge_method || 'flat_fee',
      rate_card_item_id: r.rate_card_item_id || '',
      flat_fee: r.flat_fee != null ? String(r.flat_fee) : '',
      per_mile_rate: r.per_mile_rate != null ? String(r.per_mile_rate) : '',
      per_hour_rate: r.per_hour_rate != null ? String(r.per_hour_rate) : '',
      per_unit_rate: r.per_unit_rate != null ? String(r.per_unit_rate) : '',
      unit_label: r.unit_label || 'each',
      is_chargeable: r.is_chargeable !== false,
      is_active: r.is_active !== false,
      category: r.category || '',
      sort_order: r.sort_order || 0,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this billing rule? Existing charges keep their amounts.')) return;
    try {
      await base44.entities.BillingRule.delete(id);
      queryClient.invalidateQueries({ queryKey: ['billing-rules'] });
      toast({ title: 'Rule deleted' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const toggleActive = async (r) => {
    await base44.entities.BillingRule.update(r.id, { is_active: !r.is_active });
    queryClient.invalidateQueries({ queryKey: ['billing-rules'] });
  };

  const rateLabel = (r) => {
    const linkedItem = r.rate_card_item_id ? rateCardItems.find(rc => rc.id === r.rate_card_item_id) : null;
    const rate = linkedItem?.price;
    const parts = [];
    if (r.charge_method === 'flat_fee' || r.charge_method.includes('flat_plus')) parts.push(fmt(rate ?? r.flat_fee) + ' flat');
    if (r.charge_method === 'per_mile' || r.charge_method.includes('mileage')) parts.push(fmt(rate ?? r.per_mile_rate) + '/mi');
    if (r.charge_method === 'per_hour' || r.charge_method.includes('time')) parts.push(fmt(rate ?? r.per_hour_rate) + '/h');
    if (r.charge_method === 'per_unit') parts.push(fmt(rate ?? r.per_unit_rate) + '/' + (r.unit_label || 'unit'));
    return parts.length ? parts.join(' + ') : 'Not set';
  };

  return (
    <div>
      <SettingsSectionHeader icon={Banknote} title="Billing Rules" description="Pricing rules for deliveries, tasks and consumables — link to rate card items for dynamic pricing" />

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Object.entries(ruleTypeConfig).map(([k, cfg]) => {
          const Icon = cfg.icon === 'Truck' ? Truck : cfg.icon === 'ClipboardList' ? ClipboardList : cfg.icon === 'Package' ? Package : MapPin;
          return (
            <div key={k} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-slate-400" />
                <p className="text-xs text-slate-500 font-medium">{cfg.label} Rules</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">{counts[k] || 0}</p>
            </div>
          );
        })}
      </div>

      {/* Rate card linked banner */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-4 mb-5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <Link2 className="w-4 h-4 text-white" />
        </div>
        <div className="text-sm text-slate-700 flex-1">
          <p className="font-semibold text-slate-900 mb-0.5">Rate Card Integration</p>
          <p className="text-xs text-slate-600">
            {linkedCount > 0
              ? `${linkedCount} rule${linkedCount === 1 ? '' : 's'} linked to the Master Price List — rates update automatically when the rate card changes.`
              : 'Link any billing rule to a Rate Card item for dynamic pricing. The rate card becomes the single source of truth — update it once and all linked rules update automatically.'}
          </p>
        </div>
        {linkedCount > 0 && (
          <div className="flex items-center gap-1 text-indigo-700 bg-indigo-100 px-2.5 py-1.5 rounded-lg text-xs font-bold">
            <TrendingUp className="w-3.5 h-3.5" /> {linkedCount} Linked
          </div>
        )}
      </div>

      {/* How it works banner */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-4 mb-5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center flex-shrink-0">
          <PoundSterling className="w-4 h-4 text-white" />
        </div>
        <div className="text-sm text-slate-700">
          <p className="font-semibold text-slate-900 mb-0.5">How client billing works</p>
          <p className="text-xs text-slate-600">Create pricing rules for deliveries (flat + per-mile + per-hour), daily tasks (matched by name), and consumables. Link a rule to a Rate Card item for dynamic pricing. When staff log activity, charges are calculated automatically and added to the job's client total.</p>
        </div>
      </div>

      {/* Filter + search + add */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto no-scrollbar">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>All ({counts.all})</button>
          {Object.entries(ruleTypeConfig).map(([k, cfg]) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${filter === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{cfg.label} ({counts[k] || 0})</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rules…" className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white" />
        </div>
        {!showForm && (
          <button onClick={() => { setForm(blankForm()); setEditingId(null); setShowForm(true); }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 text-sm font-semibold transition active:scale-95">
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Rules list — takes 2 cols on desktop */}
        <div className="lg:col-span-2 space-y-2">
          {/* Form */}
          {showForm && (
            <RuleForm form={form} setForm={setForm} onSubmit={handleSubmit} onCancel={() => { setShowForm(false); setEditingId(null); setForm(blankForm()); }} saving={saving} rateCardItems={rateCardItems} />
          )}

          {/* Rules list */}
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center">
              <Banknote className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">{showForm ? 'Save your first rule above.' : 'No billing rules yet. Add one to start charging clients.'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(r => {
                const cfg = ruleTypeConfig[r.rule_type] || ruleTypeConfig.delivery;
                const Icon = cfg.icon === 'Truck' ? Truck : cfg.icon === 'ClipboardList' ? ClipboardList : cfg.icon === 'Package' ? Package : MapPin;
                const isLinked = !!r.rate_card_item_id;
                const linkedItem = isLinked ? rateCardItems.find(rc => rc.id === r.rate_card_item_id) : null;
                return (
                  <div key={r.id} className={`bg-white rounded-xl border p-3.5 flex items-start gap-3 transition ${r.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 text-sm truncate">{r.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${cfg.badge}`}>{cfg.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">{chargeMethodConfig[r.charge_method]?.label || r.charge_method}</span>
                        {isLinked && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-0.5">
                            <Link2 className="w-2.5 h-2.5" /> Rate Card
                          </span>
                        )}
                        {!r.is_chargeable && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">Non-chargeable</span>}
                        {!r.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-50 text-red-600">Inactive</span>}
                      </div>
                      <p className="text-sm font-bold text-emerald-700 mt-1">{rateLabel(r)}</p>
                      {isLinked && linkedItem && (
                        <p className="text-[11px] text-indigo-600 mt-0.5 flex items-center gap-1 truncate">
                          <FileText className="w-2.5 h-2.5 flex-shrink-0" /> {linkedItem.description}
                        </p>
                      )}
                      {r.description && !isLinked && <p className="text-xs text-slate-400 mt-0.5 truncate">{r.description}</p>}
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => handleEdit(r)} className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => toggleActive(r)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition" title={r.is_active ? 'Deactivate' : 'Activate'}>
                        {r.is_active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-slate-300" />}
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar — charge calculator */}
        <div className="lg:col-span-1">
          <ChargeCalculator rules={rules} rateCardItems={rateCardItems} />
        </div>
      </div>
    </div>
  );
}