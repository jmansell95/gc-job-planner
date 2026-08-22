import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// resolveLogPricing — hybrid keyword → rate card matcher
// ============================================================
// Consults the KeywordRateMapping dictionary first (exact,
// case-insensitive, division-scoped), then falls back to fuzzy
// description matching against RateCardItem descriptions.
//
// Returns a confidence score + suggested rate card item.
// High-confidence (≥0.8) matches auto-price; low-confidence
// land in the Pricing Review queue.
//
// Invoked from stampBillingCharge (on log create) and from the
// review queue confirm action (which teaches the dictionary).

const HIGH_CONFIDENCE_THRESHOLD = 0.8;

function normalize(s: string): string {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// Simple token-overlap fuzzy score (0–1)
function fuzzyScore(keyword: string, description: string): number {
  const k = normalize(keyword);
  const d = normalize(description);
  if (!k || !d) return 0;
  if (d.includes(k)) return 0.9;
  const kTokens = k.split(' ').filter(Boolean);
  const dTokens = new Set(d.split(' ').filter(Boolean));
  if (kTokens.length === 0) return 0;
  const hits = kTokens.filter(t => dTokens.has(t)).length;
  return Math.min(0.85, hits / kTokens.length);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { description, division_id, log_id, confirm_mapping } = body;

    if (!description) {
      return Response.json({ ok: false, error: 'description required' }, { status: 400 });
    }

    const desc = normalize(description);

    // ── Confirm mode: billing team confirms a match, teaching the dictionary ──
    if (confirm_mapping && log_id) {
      const { rate_card_item_id, keyword, category } = body;
      if (!rate_card_item_id || !keyword) {
        return Response.json({ ok: false, error: 'rate_card_item_id and keyword required to confirm' }, { status: 400 });
      }
      // Upsert the dictionary entry
      const existing = await base44.asServiceRole.entities.KeywordRateMapping.filter({ keyword: normalize(keyword) });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.KeywordRateMapping.update(existing[0].id, {
          rate_card_item_id,
          category: category || existing[0].category,
          confidence_score: 1.0,
          is_confirmed: true,
          created_by: body.confirmed_by || 'system',
        });
      } else {
        await base44.asServiceRole.entities.KeywordRateMapping.create({
          keyword: normalize(keyword),
          rate_card_item_id,
          category: category || 'drilling',
          confidence_score: 1.0,
          is_confirmed: true,
          division_id: division_id || undefined,
          created_by: body.confirmed_by || 'system',
        });
      }
      // Mark the log as reviewed
      await base44.asServiceRole.entities.InvestigationLog.update(log_id, {
        pricing_review_status: 'reviewed',
        pricing_reviewed_at: new Date().toISOString(),
        pricing_reviewed_by: body.confirmed_by || 'billing',
      });
      return Response.json({ ok: true, confirmed: true, keyword: normalize(keyword) });
    }

    // ── Match mode: find the best rate card item for this description ──

    // 1. Dictionary lookup (exact, case-insensitive, division-scoped)
    const dictEntries = await base44.asServiceRole.entities.KeywordRateMapping.list('confidence_score', 500);
    // Prefer division-specific + confirmed entries
    const scoped = dictEntries.filter(e =>
      (e.is_confirmed !== false) &&
      (e.division_id === division_id || !e.division_id)
    );

    let bestDictMatch = null;
    for (const entry of scoped) {
      const kw = normalize(entry.keyword);
      if (desc === kw || desc.includes(kw)) {
        if (!bestDictMatch || entry.confidence_score >= bestDictMatch.confidence_score) {
          bestDictMatch = entry;
        }
      }
    }

    if (bestDictMatch) {
      const confidence = Math.max(HIGH_CONFIDENCE_THRESHOLD, Number(bestDictMatch.confidence_score) || 0.8);
      // Increment match count
      try {
        await base44.asServiceRole.entities.KeywordRateMapping.update(bestDictMatch.id, {
          match_count: (Number(bestDictMatch.match_count) || 0) + 1,
          last_matched_at: new Date().toISOString(),
        });
      } catch (_) { /* non-fatal */ }

      // Fetch the rate card item for the price
      const rci = await base44.asServiceRole.entities.RateCardItem.get(bestDictMatch.rate_card_item_id);
      return Response.json({
        ok: true,
        matched: true,
        rate_card_item_id: bestDictMatch.rate_card_item_id,
        unit_price: rci?.price || rci?.cost_price || 0,
        unit: rci?.unit || 'sum',
        category: bestDictMatch.category,
        confidence,
        source: 'dictionary',
        auto_price: confidence >= HIGH_CONFIDENCE_THRESHOLD,
      });
    }

    // 2. Fuzzy fallback — match against RateCardItem descriptions
    const rateCardItems = await base44.asServiceRole.entities.RateCardItem.filter({ is_active: true });
    let bestFuzzy = null;
    let bestScore = 0;
    for (const rci of rateCardItems) {
      const score = fuzzyScore(description, rci.description);
      if (score > bestScore) {
        bestScore = score;
        bestFuzzy = rci;
      }
    }

    if (bestFuzzy && bestScore >= 0.5) {
      return Response.json({
        ok: true,
        matched: true,
        rate_card_item_id: bestFuzzy.id,
        unit_price: bestFuzzy.price || bestFuzzy.cost_price || 0,
        unit: bestFuzzy.unit || 'sum',
        category: bestFuzzy.category || 'drilling',
        confidence: bestScore,
        source: 'fuzzy',
        auto_price: bestScore >= HIGH_CONFIDENCE_THRESHOLD,
        suggested_rate_card_item_id: bestFuzzy.id,
      });
    }

    // 3. No match — pending review
    return Response.json({
      ok: true,
      matched: false,
      confidence: 0,
      source: 'none',
      auto_price: false,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}