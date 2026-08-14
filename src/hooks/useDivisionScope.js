import { useDivision } from '@/contexts/DivisionContext';

/**
 * useDivisionScope — returns a Mongo filter object for the active division.
 *
 * Returns `{ division_id: activeDivisionId }` when a division is selected,
 * or `{}` when in the Enterprise Overview (no division selected = see all).
 *
 * Usage:
 *   const scope = useDivisionScope();
 *   const { data } = useQuery({ queryFn: () => base44.entities.Job.filter({ ...scope, status: 'in_progress' }) });
 *
 * For list() calls (no filter), use useDivisionFilter() to filter client-side instead.
 */
export function useDivisionScope() {
  const { activeDivisionId } = useDivision();
  if (!activeDivisionId) return {};
  return { division_id: activeDivisionId };
}

/**
 * useDivisionFilter — returns a function that filters an already-fetched list
 * to the active division. Records with no division_id (un-migrated / shared pool)
 * are always included so nothing disappears during the transition.
 *
 * Usage:
 *   const inDivision = useDivisionFilter();
 *   const scopedJobs = inDivision(jobs);
 */
export function useDivisionFilter() {
  const { activeDivisionId } = useDivision();
  return (items) => {
    if (!activeDivisionId) return items;
    if (!Array.isArray(items)) return items;
    return items.filter(i => !i.division_id || i.division_id === activeDivisionId);
  };
}