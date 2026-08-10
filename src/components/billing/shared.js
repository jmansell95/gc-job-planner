// Shared constants and helpers for billing rule components

export const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ruleTypeConfig = {
  delivery: { label: 'Delivery', icon: 'Truck', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  task: { label: 'Task', icon: 'ClipboardList', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  consumable: { label: 'Consumable', icon: 'Package', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  site_visit: { label: 'Site Visit', icon: 'MapPin', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export const chargeMethodConfig = {
  flat_fee: { label: 'Flat Fee', fields: ['flat_fee'] },
  per_mile: { label: 'Per Mile', fields: ['per_mile_rate'] },
  per_hour: { label: 'Per Hour', fields: ['per_hour_rate'] },
  per_unit: { label: 'Per Unit', fields: ['per_unit_rate', 'unit_label'] },
  flat_plus_mileage: { label: 'Flat + Mileage', fields: ['flat_fee', 'per_mile_rate'] },
  flat_plus_time: { label: 'Flat + Time', fields: ['flat_fee', 'per_hour_rate'] },
  flat_plus_mileage_plus_time: { label: 'Flat + Mileage + Time', fields: ['flat_fee', 'per_mile_rate', 'per_hour_rate'] },
};

export const blankForm = () => ({
  rule_type: 'delivery',
  name: '',
  description: '',
  charge_method: 'flat_fee',
  rate_card_item_id: '',
  flat_fee: '',
  per_mile_rate: '',
  per_hour_rate: '',
  per_unit_rate: '',
  unit_label: 'each',
  is_chargeable: true,
  is_active: true,
  category: '',
  sort_order: 0,
});

export const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';