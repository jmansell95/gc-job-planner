// Shared Bob HR (Hibob) helpers used by syncBobAbsences and bobWebhook.

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