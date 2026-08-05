// Shared WhatsApp Business API message sender.
// Used by notification functions to send crew alerts via WhatsApp.
//
// Config is stored in AppSetting keyed 'whatsapp_config' (saved by admins
// in Settings → WhatsApp Sync). Returns { ok, message_id } on success.

export async function sendWhatsAppMessage(base44, to, text) {
  const config = await base44.asServiceRole.entities.AppSetting.filter({ key: 'whatsapp_config' }, '-created_date', 1);
  const cfg = config?.[0]?.value || {};

  const apiUrl = (cfg.api_url || 'https://graph.facebook.com/v18.0').replace(/\/$/, '');
  const phoneNumberId = cfg.phone_number_id;
  const apiToken = cfg.api_token;

  if (!phoneNumberId || !apiToken) {
    return { ok: false, error: 'WhatsApp not configured — enter phone number ID and API token in Settings.' };
  }

  // Normalise the recipient number: strip spaces, dashes, leading 0 (replace with +44)
  let normalized = (to || '').replace(/[\s\-()]/g, '');
  if (normalized.startsWith('0')) normalized = '44' + normalized.slice(1);
  if (!normalized.startsWith('+') && !normalized.startsWith('44')) normalized = '+' + normalized;
  if (normalized.startsWith('44') && !normalized.startsWith('+44')) normalized = '+' + normalized;

  const url = `${apiUrl}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: normalized.replace(/^\+/, ''),
    type: 'text',
    text: { body: text },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { ok: false, error: data?.error?.message || `WhatsApp API error (${res.status})` };
  }

  const messageId = data?.messages?.[0]?.id;
  return { ok: true, message_id: messageId };
}

// Send a WhatsApp message to multiple staff members. Returns per-recipient results.
export async function sendWhatsAppToStaff(base44, staffList, text) {
  const results = [];
  for (const s of staffList) {
    if (!s.phone) {
      results.push({ staff_id: s.id, name: s.name, ok: false, error: 'No phone number on staff record' });
      continue;
    }
    const r = await sendWhatsAppMessage(base44, s.phone, text);
    results.push({ staff_id: s.id, name: s.name, ...r });
  }
  return results;
}