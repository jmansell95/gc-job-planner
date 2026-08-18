import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  buildScopedFilter,
  GLOBAL_ENTITIES,
} from '../../shared/divisionScope.ts';

// ---------------------------------------------------------------------------
// getDivisionScopedData — the server-side division isolation read layer.
// ---------------------------------------------------------------------------
// Called by every hub via the useScopedEntity() hook. Returns records scoped
// to the active division, enforced server-side with asServiceRole so it cannot
// be bypassed by a forgotten client-side filter or by admin RLS exemptions.
//
// Payload:
//   entity      — entity name (e.g. 'Job', 'RotaAssignment', 'Invoice')
//   division_id — active division ID from DivisionContext. null/empty =
//                 Enterprise Overview mode (cross-division, admins only).
//   filter      — optional Mongo filter to merge with the scope
//   sort        — optional sort spec
//   limit       — optional limit
//
// Authorization (defence-in-depth on top of the server-side scope):
//   - Super admin: may read any division, or the Enterprise Overview.
//   - Director: may read only divisions in managed_division_ids, or Overview.
//   - Standard user: may read ONLY their own division (locked, cannot request
//     another division's data even by calling this endpoint directly).
//   - Global entities: returned unfiltered (shared resources, no division).
//   - RLS remains as a secondary layer for standard users.
// ---------------------------------------------------------------------------
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { entity, division_id, filter, sort, limit } = body || {};

    if (!entity) {
      return Response.json({ error: 'entity is required' }, { status: 400 });
    }

    // Dynamic entity access — every entity is a property on the SDK client.
    const entityClient = base44.asServiceRole.entities[entity];
    if (!entityClient || typeof entityClient.filter !== 'function') {
      return Response.json({ error: `Unknown entity: ${entity}` }, { status: 400 });
    }

    const isGlobal = GLOBAL_ENTITIES.has(entity);
    const hasDivision = !!division_id;

    // Resolve the caller's division access profile.
    const isSuperAdmin = user.role === 'admin';
    const isDirector = user.role === 'director';
    const isEntAdmin =
      isSuperAdmin || isDirector || user.is_enterprise_admin === true;
    const userDivisionId =
      user.data?.division_id || user.division_id || null;
    const managedDivisionIds =
      user.data?.managed_division_ids || user.managed_division_ids || [];

    // Authorization for scoped (non-global) entities.
    if (!isGlobal) {
      if (hasDivision) {
        // Caller requested a specific division — verify they may access it.
        if (!isSuperAdmin) {
          let allowed = false;
          if (isDirector) {
            allowed = managedDivisionIds.includes(division_id);
          } else {
            // Standard user: must be their own division. If the user object
            // doesn't carry division_id, fall back to their Staff record.
            let myDiv = userDivisionId;
            if (!myDiv) {
              try {
                const staff = await base44.asServiceRole.entities.Staff.filter(
                  { user_id: user.id },
                  null,
                  1
                );
                myDiv = staff[0]?.division_id || null;
              } catch {
                myDiv = null;
              }
            }
            allowed = !!myDiv && division_id === myDiv;
          }
          if (!allowed) {
            return Response.json(
              { error: 'Forbidden — division not permitted' },
              { status: 403 }
            );
          }
        }
      } else {
        // Enterprise Overview (no division) — enterprise admins only.
        if (!isEntAdmin) {
          return Response.json(
            { error: 'Forbidden — no division selected' },
            { status: 403 }
          );
        }
      }
    }

    // Global entities are never division-scoped.
    if (isGlobal) {
      const items = await entityClient.filter(filter || {}, sort, limit);
      return Response.json({ data: items });
    }

    // Enterprise Overview for scoped entities (admins/directors): unfiltered.
    if (!hasDivision) {
      const items = await entityClient.filter(filter || {}, sort, limit);
      return Response.json({ data: items });
    }

    // Scoped entity with an active division — enforce isolation server-side.
    const jobCache = new Map();
    const scopedFilter = await buildScopedFilter(
      base44,
      entity,
      division_id,
      filter,
      jobCache
    );
    const items = await entityClient.filter(scopedFilter, sort, limit);
    return Response.json({ data: items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}