import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PoundSterling, AlertTriangle, Loader2, ArrowRight, UserX } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { useNavigate } from 'react-router-dom';

// Normalise text for matching: lowercase, strip punctuation, collapse spaces.
function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Light stemmer to collapse "driller"↔"drilling", "groundworker"↔"groundworks".
function stem(t) {
  let s = t;
  for (const suf of ['ing', 'ed', 'er', 'es', 's']) {
    if (s.length > suf.length + 2 && s.endsWith(suf)) {
      const st = s.slice(0, -suf.length);
      if (st.length >= 3) return st;
    }
  }
  return s;
}

function tokens(s) {
  return norm(s).split(' ').filter(t => t.length >= 3).map(stem).filter(t => t.length >= 3);
}

// Check if a staff member's job title matches a labour rate card description.
// Returns true if a reasonable match is found.
function matchesRateCard(jobTitle, rateDescriptions) {
  if (!jobTitle) return false;
  const titleTokens = new Set(tokens(jobTitle));
  if (titleTokens.size === 0) return false;
  for (const desc of rateDescriptions) {
    const descTokens = new Set(tokens(desc));
    if (descTokens.size === 0) continue;
    let hits = 0;
    for (const t of titleTokens) {
      if (descTokens.has(t)) hits++;
    }
    // If most of the title's words appear in the rate description, it's a match.
    if (hits >= 1 && hits / titleTokens.size >= 0.5) return true;
  }
  return false;
}

export default function MissingRatesWidget() {
  const navigate = useNavigate();
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [staff, rateItems] = await Promise.all([
          base44.entities.Staff.list('-created_date', 500),
          base44.entities.RateCardItem.filter({ category: 'labour', is_active: true }, '-sort_order', 500),
        ]);

        // Build a set of staff IDs that have a personal rate card entry.
        const staffWithPersonalRate = new Set(
          rateItems.filter(r => r.staff_id).map(r => r.staff_id)
        );

        // Build a list of labour rate card descriptions for job-title matching.
        const labourDescriptions = rateItems
          .filter(r => !r.staff_id && r.price != null)
          .map(r => r.description);

        // Find active staff with no personal rate and no job-title match.
        const missingStaff = staff
          .filter(s => s.is_active !== false)
          .filter(s => {
            if (staffWithPersonalRate.has(s.id)) return false;
            if (matchesRateCard(s.job_title, labourDescriptions)) return false;
            return true;
          })
          .map(s => ({
            id: s.id,
            name: s.name,
            job_title: s.job_title || 'No job title set',
            team_id: s.team_id,
          }));

        setMissing(missingStaff);
      } catch (e) {
        console.error('MissingRatesWidget error:', e);
      }
      setLoading(false);
    })();
  }, []);

  const count = missing.length;

  return (
    <WidgetShell
      icon={PoundSterling}
      title="Missing Day Rates"
      subtitle={count === 0 ? 'All crew have rate card entries' : `${count} crew member${count === 1 ? '' : 's'} with no day rate`}
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
        </div>
      ) : count === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
            <PoundSterling className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-slate-700">All crew priced</p>
          <p className="text-xs text-slate-400 mt-0.5">Every active staff member matches a labour rate card entry.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              These crew members have no matching labour rate card entry. Their labour costs show as £0 in job financials.
            </p>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {missing.map(s => (
              <div key={s.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-100">
                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <UserX className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">{s.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{s.job_title}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/admin?tab=settings&section=rate-cards')}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition"
          >
            <PoundSterling className="w-4 h-4" /> Fix in Rate Cards <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </WidgetShell>
  );
}