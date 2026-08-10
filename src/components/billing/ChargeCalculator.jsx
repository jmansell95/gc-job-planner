import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import { fmt } from './shared';
import { chargeMethodConfig } from './shared';

const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

/**
 * Charge Calculator — a live preview tool that lets managers test what a
 * billing rule charges for given inputs (miles, hours, units). Shows
 * whether the rate came from a linked rate card item or a manual entry.
 */
export default function ChargeCalculator({ rules, rateCardItems }) {
  const [testRuleId, setTestRuleId] = useState('');
  const [testMiles, setTestMiles] = useState('10');
  const [testHours, setTestHours] = useState('2');
  const [testUnits, setTestUnits] = useState('1');
  const [result, setResult] = useState(null);

  const testRule = rules.find(r => r.id === testRuleId);
  const linkedRateCard = testRule?.rate_card_item_id ? rateCardItems?.find(r => r.id === testRule.rate_card_item_id) : null;

  const calculate = () => {
    if (!testRule) return;
    const rate = linkedRateCard?.price ?? 0;
    const flatFee = linkedRateCard ? rate : (testRule.flat_fee || 0);
    const mileRate = linkedRateCard ? rate : (testRule.per_mile_rate || 0);
    const hourRate = linkedRateCard ? rate : (testRule.per_hour_rate || 0);
    const unitRate = linkedRateCard ? rate : (testRule.per_unit_rate || 0);
    const miles = Number(testMiles) || 0;
    const hours = Number(testHours) || 0;
    const units = Number(testUnits) || 1;
    let amount = 0;
    const parts = [];
    switch (testRule.charge_method) {
      case 'flat_fee': amount = flatFee; parts.push(`Flat ${fmt(flatFee)}`); break;
      case 'per_mile': amount = mileRate * miles; parts.push(`${miles}mi × ${fmt(mileRate)}`); break;
      case 'per_hour': amount = hourRate * hours; parts.push(`${hours}h × ${fmt(hourRate)}`); break;
      case 'per_unit': amount = unitRate * units; parts.push(`${units} × ${fmt(unitRate)}`); break;
      case 'flat_plus_mileage': amount = flatFee + mileRate * miles; parts.push(`Flat ${fmt(flatFee)}`, `${miles}mi × ${fmt(mileRate)}`); break;
      case 'flat_plus_time': amount = flatFee + hourRate * hours; parts.push(`Flat ${fmt(flatFee)}`, `${hours}h × ${fmt(hourRate)}`); break;
      case 'flat_plus_mileage_plus_time': amount = flatFee + mileRate * miles + hourRate * hours; parts.push(`Flat ${fmt(flatFee)}`, `${miles}mi × ${fmt(mileRate)}`, `${hours}h × ${fmt(hourRate)}`); break;
    }
    setResult({ amount: Math.round(amount * 100) / 100, parts, source: linkedRateCard ? 'Rate Card' : 'Manual' });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-slate-600" />
        <p className="text-sm font-bold text-slate-800">Charge Calculator</p>
        <span className="text-[10px] text-slate-400">Preview what a rule charges</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <select value={testRuleId} onChange={e => { setTestRuleId(e.target.value); setResult(null); }} className={inputCls}>
            <option value="">Select a rule to test…</option>
            {rules.filter(r => r.is_chargeable).map(r => (
              <option key={r.id} value={r.id}>{r.name} ({chargeMethodConfig[r.charge_method]?.label})</option>
            ))}
          </select>
        </div>
        {testRule && chargeMethodConfig[testRule.charge_method]?.fields.includes('per_mile_rate') && (
          <div>
            <label className="block text-[11px] text-slate-500 mb-0.5">Miles</label>
            <input type="number" min="0" step="1" value={testMiles} onChange={e => setTestMiles(e.target.value)} className={inputCls} />
          </div>
        )}
        {testRule && chargeMethodConfig[testRule.charge_method]?.fields.includes('per_hour_rate') && (
          <div>
            <label className="block text-[11px] text-slate-500 mb-0.5">Hours</label>
            <input type="number" min="0" step="0.5" value={testHours} onChange={e => setTestHours(e.target.value)} className={inputCls} />
          </div>
        )}
        {testRule && chargeMethodConfig[testRule.charge_method]?.fields.includes('per_unit_rate') && (
          <div>
            <label className="block text-[11px] text-slate-500 mb-0.5">Units</label>
            <input type="number" min="0" step="1" value={testUnits} onChange={e => setTestUnits(e.target.value)} className={inputCls} />
          </div>
        )}
      </div>
      {testRule && (
        <button onClick={calculate} className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition">
          Calculate Charge
        </button>
      )}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">{result.parts.join(' + ')}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">{result.source}</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{fmt(result.amount)}</p>
        </div>
      )}
    </div>
  );
}