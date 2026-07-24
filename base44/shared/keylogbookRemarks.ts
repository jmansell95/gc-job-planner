// ============================================================
// Shared KeyLogBook remarks pipeline
// ============================================================
// Used by BOTH:
//   • receiveKeyLogBookData (webhook)  — parses the JSON `remarks` field
//   • importAGS (manual upload)        — parses *_REM / REMARKS / DIARY text
//
// Driller remarks use the format:
//   "7:30_8:45 = Start briefing... 8:45_9:00 = Mobilised rig... 9:00_9:45 = Offload..."
// Each activity becomes its own InvestigationLog (source='keylogbook_remarks',
// manager_review_status='pending') so the manager can review/edit/approve it
// to auto-generate the timesheet.

export interface ParsedActivity {
  start_time: string;
  end_time: string;
  duration_minutes: number;
  raw_description: string;
}

// Parse "HH:MM" into minutes from midnight
export function timeToMins(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Parse raw driller remarks into individual time-stamped activities.
// Format: "7:30_8:45 = Start briefing... 8:45_9:00 = Mobilised rig... 9:00_9:45 = Offload..."
// Each activity: HH:MM_HH:MM = description (until next HH:MM_HH:MM= or end)
export function parseRemarks(rawText: string): ParsedActivity[] {
  if (!rawText || !rawText.trim()) return [];
  // Regex: capture (start_time)_(end_time) = (description until next pattern or end)
  const pattern = /(\d{1,2}:\d{2})\s*[_-]\s*(\d{1,2}:\d{2})\s*=\s*([^]*?)(?=\s*\d{1,2}:\d{2}\s*[_-]\s*\d{1,2}:\d{2}\s*=|$)/g;
  const activities: ParsedActivity[] = [];
  let match;
  while ((match = pattern.exec(rawText)) !== null) {
    const startTime = match[1].trim();
    const endTime = match[2].trim();
    let description = match[3].trim().replace(/\.+$/, '').trim();
    if (!description) continue;
    const startMins = timeToMins(startTime);
    const endMins = timeToMins(endTime);
    let duration = 0;
    if (startMins != null && endMins != null && endMins > startMins) {
      duration = endMins - startMins;
    }
    activities.push({ start_time: startTime, end_time: endTime, duration_minutes: duration, raw_description: description });
  }
  return activities;
}

// AI enrichment — professionalise raw driller remarks into report-ready English.
// Processes all activities in one LLM call for efficiency. Never blocks the caller
// (falls back to raw descriptions on any error).
export async function professionaliseActivities(base44: any, activities: ParsedActivity[]): Promise<string[]> {
  if (activities.length === 0) return [];
  const input = activities.map((a, i) => `${i + 1}. [${a.start_time}–${a.end_time}] ${a.raw_description}`).join('\n');
  try {
    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a geotechnical field log editor. Clean up the following raw driller remarks from a cable percussion or rotary borehole shift. For each numbered activity, fix spelling, grammar, and capitalisation. Convert informal shorthand into professional, report-ready English while preserving ALL technical accuracy (depths, strata, groundwater, obstructions, equipment names, times). Do NOT add information that isn't in the original. Keep "Standby" and "Lunch" as valid activities. Return ONLY the cleaned activities, one per line, numbered exactly as input (format: "N. [HH:MM–HH:MM] Cleaned description").\n\nRaw activities:\n${input}`,
    });
    const text = typeof res === 'string' ? res.trim() : String((res as any)?.text || (res as any)?.response || '').trim();
    if (!text) return activities.map(a => a.raw_description);
    // Parse numbered lines back out
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const cleaned: string[] = [];
    for (const line of lines) {
      const m = line.match(/^\d+\.\s*\[?\d{1,2}:\d{2}[–-]\d{1,2}:\d{2}\]?\s*(.*)$/);
      if (m) cleaned.push(m[1].trim());
      else cleaned.push(line.replace(/^\d+\.\s*/, '').trim());
    }
    // Fallback: if count mismatch, use raw descriptions
    if (cleaned.length !== activities.length) return activities.map(a => a.raw_description);
    return cleaned;
  } catch (e) {
    return activities.map(a => a.raw_description);
  }
}

// Does a text block look like time-stamped driller remarks? Used to decide
// whether a free-text REM/NOTE field should be parsed as daily activities
// (rather than treated as a one-off strata/sample description).
export function hasTimePattern(text: string): boolean {
  return /\d{1,2}:\d{2}\s*[_-]\s*\d{1,2}:\d{2}\s*=/.test(text || '');
}