import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Coins, Plus, Trash2, Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

// Multi-Currency Support — lets admins define supported currencies with
// exchange rates against GBP (the base currency). Jobs and invoices can
// then be billed in a foreign currency with automatic GBP conversion for
// internal reporting. Stored in AppSetting under key 'currency_config'.

const DEFAULT_CURRENCIES = [
  { code: 'GBP', symbol: '£', name: 'British Pound', rate: 1.0, is_base: true },
  { code: 'EUR', symbol: '€', name: 'Euro', rate: 1.17, is_base: false },
  { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1.27, is_base: false },
];

export default function CurrencySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currencies, setCurrencies] = useState(DEFAULT_CURRENCIES);
  const [newCurrency, setNewCurrency] = useState({ code: '', symbol: '', name: '', rate: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load config from AppSetting
  const { refetch } = useQuery({
    queryKey: ['currency-config'],
    queryFn: async () => {
      const res = await base44.entities.AppSetting.filter({ key: 'currency_config' });
      const records = res.data || res || [];
      return records[0] || null;
    },
    onSuccess: (data) => {
      if (data?.value?.currencies) {
        setCurrencies(data.value.currencies);
      }
      setLoading(false);
    },
  });

  const saveConfig = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.AppSetting.filter({ key: 'currency_config' });
      const records = (existing.data || existing || []);
      const payload = { key: 'currency_config', label: 'Currency Configuration', value: { currencies, base_currency: 'GBP' } };
      if (records[0]) {
        await base44.entities.AppSetting.update(records[0].id, payload);
      } else {
        await base44.entities.AppSetting.create(payload);
      }
      toast({ title: '✓ Currency settings saved' });
      queryClient.invalidateQueries({ queryKey: ['currency-config'] });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateRate = (code, rate) => {
    setCurrencies(currencies.map(c => c.code === code ? { ...c, rate: parseFloat(rate) || 0 } : c));
  };

  const addCurrency = () => {
    if (!newCurrency.code || !newCurrency.symbol || !newCurrency.rate) {
      toast({ title: 'Fill in all fields', variant: 'destructive' });
      return;
    }
    if (currencies.find(c => c.code === newCurrency.code.toUpperCase())) {
      toast({ title: 'Currency code already exists', variant: 'destructive' });
      return;
    }
    setCurrencies([...currencies, {
      code: newCurrency.code.toUpperCase(),
      symbol: newCurrency.symbol,
      name: newCurrency.name || newCurrency.code.toUpperCase(),
      rate: parseFloat(newCurrency.rate) || 0,
      is_base: false,
    }]);
    setNewCurrency({ code: '', symbol: '', name: '', rate: '' });
  };

  const removeCurrency = (code) => {
    setCurrencies(currencies.filter(c => c.code !== code || c.is_base));
  };

  if (loading) return <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>;

  return (
    <div>
      <SettingsSectionHeader
        icon={Coins}
        title="Multi-Currency Support"
        description="Define supported currencies and exchange rates against GBP. Jobs and invoices can be billed in foreign currencies with automatic GBP conversion."
        actions={
          <Button onClick={saveConfig} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800 text-white">
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        }
      />

      <div className="insight-card rounded-2xl p-5">
        {/* Base currency info */}
        <div className="flex items-center gap-3 mb-4 p-3.5 bg-emerald-50 rounded-xl">
          <div className="w-10 h-10 rounded-lg stat-gradient-emerald flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Base Currency: GBP (£)</p>
            <p className="text-xs text-slate-500">All internal reporting uses GBP. Other currencies convert at the rates below.</p>
          </div>
        </div>

        {/* Currency table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Code</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Symbol</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Rate (vs £1)</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Base</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {currencies.map(c => (
                <tr key={c.code} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-bold text-slate-700">{c.code}</td>
                  <td className="py-2.5 px-3 text-slate-600">{c.symbol}</td>
                  <td className="py-2.5 px-3 text-slate-600">{c.name}</td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.0001"
                      value={c.rate}
                      onChange={e => updateRate(c.code, e.target.value)}
                      disabled={c.is_base}
                      className="w-24 px-2 py-1 text-right border border-slate-200 rounded text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {c.is_base && <Check className="w-4 h-4 text-emerald-600 mx-auto" />}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {!c.is_base && (
                      <button onClick={() => removeCurrency(c.code)} className="p-1 rounded hover:bg-rose-50 transition">
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add new currency */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-600 mb-2">Add New Currency</p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Code</label>
              <input type="text" value={newCurrency.code} onChange={e => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase().slice(0, 3) })}
                placeholder="AUD" className="w-16 px-2 py-1.5 border border-slate-300 rounded text-sm uppercase" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Symbol</label>
              <input type="text" value={newCurrency.symbol} onChange={e => setNewCurrency({ ...newCurrency, symbol: e.target.value.slice(0, 3) })}
                placeholder="$" className="w-16 px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Name</label>
              <input type="text" value={newCurrency.name} onChange={e => setNewCurrency({ ...newCurrency, name: e.target.value })}
                placeholder="Australian Dollar" className="w-40 px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Rate vs £1</label>
              <input type="number" step="0.0001" value={newCurrency.rate} onChange={e => setNewCurrency({ ...newCurrency, rate: e.target.value })}
                placeholder="1.92" className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <Button onClick={addCurrency} variant="outline" className="gap-1">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          Exchange rates are used to convert foreign-currency job billing and supplier invoices to GBP for internal reporting.
          Update rates manually as needed — future versions may auto-sync live FX rates.
        </p>
      </div>
    </div>
  );
}