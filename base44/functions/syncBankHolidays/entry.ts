import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const regions = ['england-and-wales', 'scotland', 'northern-ireland'];
    const currentYear = new Date().getFullYear();

    // Fetch the single gov.uk bank holidays document once — it contains all
    // regions and all years in one response.
    const res = await fetch('https://www.gov.uk/bank-holidays.json', {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      return Response.json({ error: `Failed to fetch gov.uk data (${res.status})` }, { status: 502 });
    }
    const data = await res.json();

    // Fetch existing holidays to avoid duplicates
    const existing = await base44.asServiceRole.entities.BankHoliday.list('-created_date', 500);
    const existingKeys = new Set(existing.map(h => `${h.holiday_date}|${h.region}`));

    const toCreate = [];
    let skipped = 0;
    for (const region of regions) {
      const division = data[region];
      if (!division || !division.events) continue;
      for (const event of division.events) {
        const dateStr = event.date; // ISO YYYY-MM-DD
        const year = new Date(dateStr + 'T00:00:00').getFullYear();
        // Only sync current and next year so we don't backfill ancient history
        if (year < currentYear) continue;
        const key = `${dateStr}|${region}`;
        if (existingKeys.has(key)) { skipped++; continue; }
        existingKeys.add(key);
        toCreate.push({
          name: event.title,
          holiday_date: dateStr,
          region,
          year,
          source: 'gov.uk',
        });
      }
    }

    if (toCreate.length > 0) {
      await base44.asServiceRole.entities.BankHoliday.bulkCreate(toCreate);
    }

    return Response.json({
      success: true,
      added: toCreate.length,
      skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});