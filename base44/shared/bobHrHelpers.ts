// Shared Bob HR (Hibob) helpers used by syncBobAbsences, pushAbsenceToBob, and bobWebhook.

// Bob HR time-off type → our Absence reason
const REASON_MAP: Record<string, string> = {
  holiday: 'holiday',
  annual_leave: 'holiday',
  vacation: 'holiday',
  sick: 'sick',
  sick_leave: 'sick',
  sickness: 'sick',
  personal: 'personal',
  compassionate: 'personal',
  training: 'training',
  study: 'training',
};

export function mapReason(bobType: string): string {
  const key = (bobType || '').toLowerCase().replace(/\s+/g, '_');
  return REASON_MAP[key] || 'other';
}

export function isApprovedStatus(bobStatus: string): boolean {
  const s = (bobStatus || '').toLowerCase();
  return ['approved', 'confirmed', 'accepted'].includes(s);
}

export function isCancelledStatus(bobStatus: string): boolean {
  const s = (bobStatus || '').toLowerCase();
  return ['cancelled', 'rejected', 'canceled'].includes(s);
}

// Build Basic Auth headers for Bob HR API
export function bobAuthHeaders(username: string, apiToken: string) {
  const creds = btoa(`${username}:${apiToken}`);
  return {
    Authorization: `Basic ${creds}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Push a single absence to Bob HR as a new time-off request.
 * Pure HTTP call — returns { ok, bobId, error }.
 */
export async function pushSingleAbsenceToBob(
  apiUrl: string,
  headers: Record<string, string>,
  absence: any,
  staffMember: any,
): Promise<{ ok: boolean; bobId: string; error?: string }> {
  if (!staffMember || !staffMember.email) {
    return { ok: false, bobId: '', error: 'Staff member has no email — cannot push to Bob HR' };
  }
  try {
    const payload = {
      employeeId: staffMember.email,
      startDate: absence.start_date,
      endDate: absence.end_date,
      type: absence.reason,
      reason: absence.notes || '',
    };
    const res = await fetch(`${apiUrl}/timeoff/requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, bobId: '', error: `${res.status}: ${detail.slice(0, 150)}` };
    }
    const data = await res.json().catch(() => ({}));
    const bobId = String(data.id || data.requestId || data.request_id || '');
    return { ok: true, bobId };
  } catch (e) {
    return { ok: false, bobId: '', error: e.message };
  }
}