// Shared helper for reading/writing AppSetting config records.
// Used by all third-party integration functions (Stripe, WhatsApp, Xero/Sage, Met Office)
// to avoid duplicating the filter-then-update pattern in every function.

export async function getAppSetting(base44, key) {
  const recs = await base44.asServiceRole.entities.AppSetting.filter({ key }, '-created_date', 1);
  return recs?.[0] || null;
}

export async function getAppSettingValue(base44, key, defaultValue = {}) {
  const rec = await getAppSetting(base44, key);
  return rec?.value || defaultValue;
}

export async function updateAppSettingValue(base44, key, label, value) {
  const rec = await getAppSetting(base44, key);
  if (rec) {
    await base44.asServiceRole.entities.AppSetting.update(rec.id, { value });
  } else {
    await base44.asServiceRole.entities.AppSetting.create({ key, label, value });
  }
}