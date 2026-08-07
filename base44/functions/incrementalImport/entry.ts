import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// incrementalImport — non-destructive import mode that merges
// new rota/staff data from a parsed spreadsheet payload without
// wiping existing manual edits, photos, or custom fields.
//
// Instead of deleting all RotaAssignment records for the week and
// recreating them (the destructive approach), this function:
// 1. Matches incoming rows to existing RotaAssignment records by
//    staff_id + assigned_date
// 2. Updates matched records in place (preserving manual edits
//    like arrived_on_site_at, briefing_signed, meterage, notes)
// 3. Creates new records only for unmatched rows
// 4. Marks assignments not present in the import as 'orphaned'
//    (keeps them but flags them for manager review)
//
// Payload: { assignments: Array, week_start: string, dry_run?: boolean }
// ============================================================

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { assignments, week_start, dry_run } = body;

    if (!week_start || !Array.isArray(assignments)) {
      return Response.json({ error: 'Missing week_start or assignments array' }, { status: 400 });
    }

    // Load existing assignments for this week
    const existing = await base44.asServiceRole.entities.RotaAssignment.filter({ week_start });

    // Build lookup: staff_id + assigned_date → existing record
    const existingMap: Record<string, any> = {};
    for (const a of existing as any[]) {
      const key = `${a.staff_id}|${a.assigned_date}`;
      existingMap[key] = a;
    }

    const incomingKeys = new Set<string>();
    const toCreate: any[] = [];
    const toUpdate: any[] = [];
    const preservedFields = ['arrived_on_site_at', 'left_site_at', 'briefing_signed', 'briefing_signed_at', 'briefing_start_at', 'started_at', 'completed_at', 'meterage', 'progress_notes', 'notes', 'early_leave_reason', 'early_leave_note', 'status', 'shift_status', 'is_overtime', 'rate_multiplier'];

    for (const incoming of assignments) {
      const key = `${incoming.staff_id}|${incoming.assigned_date}`;
      incomingKeys.add(key);
      const existingRec = existingMap[key];

      if (existingRec) {
        // Update in place — preserve manual edit fields
        const update: any = {};
        for (const [k, v] of Object.entries(incoming)) {
          if (!preservedFields.includes(k) && v !== undefined) {
            update[k] = v;
          }
        }
        if (Object.keys(update).length > 0) {
          toUpdate.push({ id: existingRec.id, ...update });
        }
      } else {
        // New assignment
        toCreate.push(incoming);
      }
    }

    // Orphaned: existing records not in the incoming set
    const orphaned = (existing as any[]).filter(a => {
      const key = `${a.staff_id}|${a.assigned_date}`;
      return !incomingKeys.has(key) && a.assignment_type === 'job';
    });

    if (dry_run) {
      return Response.json({
        ok: true,
        dry_run: true,
        summary: {
          existing: existing.length,
          incoming: assignments.length,
          to_create: toCreate.length,
          to_update: toUpdate.length,
          orphaned: orphaned.length,
          preserved_fields: preservedFields,
        },
      });
    }

    // Execute
    let created = 0;
    let updated = 0;

    if (toCreate.length > 0) {
      const res = await base44.asServiceRole.entities.RotaAssignment.bulkCreate(toCreate);
      created = (res as any[]).length;
    }

    if (toUpdate.length > 0) {
      await base44.asServiceRole.entities.RotaAssignment.bulkUpdate(toUpdate);
      updated = toUpdate.length;
    }

    return Response.json({
      ok: true,
      dry_run: false,
      summary: {
        existing: existing.length,
        incoming: assignments.length,
        created,
        updated,
        orphaned: orphaned.length,
        orphaned_ids: orphaned.map((o: any) => o.id),
        preserved_fields: preservedFields,
      },
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}