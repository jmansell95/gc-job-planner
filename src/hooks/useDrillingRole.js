import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useDrillingRole — determines whether the current staff member is the lead
 * driller (crew supervisor) or a second man on their drilling crew, and pulls
 * the lead driller's name automatically for second men.
 *
 * Returns:
 *   { isLeadDriller, leadDrillerName, isLoading }
 *
 * - isLeadDriller = true when the staff member IS the DrillingCrew supervisor,
 *   OR when they have no drilling crew (admins / supervisors without a crew
 *   assignment) — these users can still manually enter data.
 * - isLeadDriller = false when the staff member belongs to a crew but is NOT
 *   the supervisor (a second man). leadDrillerName holds the supervisor's name
 *   so the UI can tell them who to speak with about corrections.
 */
export function useDrillingRole(staffId) {
  const { data, isLoading } = useQuery({
    queryKey: ['drilling-role', staffId],
    queryFn: async () => {
      if (!staffId) return { isLeadDriller: true, leadDrillerName: null };

      let staff;
      try {
        staff = await base44.entities.Staff.get(staffId);
      } catch (e) {
        return { isLeadDriller: true, leadDrillerName: null };
      }
      if (!staff) return { isLeadDriller: true, leadDrillerName: null };

      // No drilling crew assigned → treat as lead (admin / unassigned supervisor)
      if (!staff.drilling_crew_id) {
        return { isLeadDriller: true, leadDrillerName: staff.name };
      }

      let crew;
      try {
        crew = await base44.entities.DrillingCrew.get(staff.drilling_crew_id);
      } catch (e) {
        return { isLeadDriller: true, leadDrillerName: staff.name };
      }
      if (!crew) return { isLeadDriller: true, leadDrillerName: staff.name };

      // Staff IS the crew supervisor → lead driller
      if (crew.supervisor_id === staffId) {
        return { isLeadDriller: true, leadDrillerName: staff.name };
      }

      // Second man — fetch the supervisor's name
      let leadDrillerName = 'your lead driller';
      try {
        const supervisor = await base44.entities.Staff.get(crew.supervisor_id);
        if (supervisor?.name) leadDrillerName = supervisor.name;
      } catch (e) { /* keep default */ }

      return { isLeadDriller: false, leadDrillerName };
    },
    enabled: !!staffId,
  });

  return { ...(data || { isLeadDriller: true, leadDrillerName: null }), isLoading };
}