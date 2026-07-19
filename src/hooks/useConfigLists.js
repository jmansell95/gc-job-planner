import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// ---------------------------------------------------------------------------
// Default options — used as a fallback until an admin visits Settings →
// Dropdown Manager and customises them. These mirror the original hard-coded
// constants so every existing form keeps working out of the box. Once a
// ConfigList record exists for a key, the database value wins.
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG_LISTS = {
  qualifications: {
    label: 'Qualifications & Training',
    category: 'Crews',
    is_system: true,
    options: [
      { value: 'cscs_card', label: 'CSCS Card', critical: true },
      { value: 'cpcs_card', label: 'CPCS Card' },
      { value: 'npors_card', label: 'NPORS Card' },
      { value: 'first_aid_cert', label: 'First Aid Certificate' },
      { value: 'driver_license', label: 'Driver License' },
      { value: 'dbs_certificate', label: 'DBS Certificate' },
      { value: 'forklift', label: 'Forklift Training' },
      { value: 'sts_triple', label: 'STS Triple (STS)' },
      { value: 'confined_space', label: 'Confined Space' },
      { value: 'asbestos_awareness', label: 'Asbestos Awareness' },
      { value: 'manual_handling', label: 'Manual Handling' },
      { value: 'working_at_height', label: 'Working at Height' },
      { value: 'other', label: 'Other' },
    ],
  },
  asset_types: {
    label: 'Asset Types',
    category: 'Crews',
    is_system: true,
    options: [
      { value: 'rig', label: 'Rigs' },
      { value: 'machinery', label: 'Machinery' },
      { value: 'trailer', label: 'Trailers' },
      { value: 'vehicle', label: 'Vehicles' },
      { value: 'lifting', label: 'Lifting Gear' },
    ],
  },
  revenue_streams: {
    label: 'Revenue Streams',
    category: 'Finance',
    is_system: true,
    options: [
      { value: 'none', label: 'Per asset/task only', description: 'Revenue tracked from equipment, deliveries & logged tasks — no crew-level billing.' },
      { value: 'drilling_meterage', label: 'Drilling Meterage (£/m)', description: 'Crew billed per metre drilled on drilling jobs.' },
      { value: 'groundworks_unit', label: 'Groundworks Unit (£/pit)', description: 'Crew billed per trial pit, charger or unit installed.' },
      { value: 'coring_unit', label: 'Coring Unit (£/core run)', description: 'Crew billed per core run or metre cored.' },
      { value: 'trial_pit_unit', label: 'Trial Pit Unit (£/pit)', description: 'Crew billed per trial pit excavated.' },
      { value: 'day_rate', label: 'Daily Crew Rate', description: 'Fixed daily rate for the whole crew on a job.' },
      { value: 'flat_fee', label: 'Flat Project Fee', description: "Single agreed fee for the whole crew's work on the job." },
    ],
  },
  team_job_types: {
    label: 'Crew Job Types',
    category: 'Crews',
    is_system: true,
    options: [
      { value: 'groundworks', label: 'Groundworks' },
      { value: 'coring', label: 'Coring (under Groundworks)' },
      { value: 'trial_pit', label: 'Trial Pit (under Groundworks)' },
      { value: 'cp_drilling', label: 'CP Drilling' },
      { value: 'rotary_drilling', label: 'Rotary Drilling' },
      { value: 'enabling_works', label: 'Enabling Works' },
      { value: 'depot', label: 'Depot' },
    ],
  },
};

// Fetch all ConfigList records from the database and merge with defaults.
// Database records always override defaults once they exist.
export function useConfigLists() {
  const queryClient = useQueryClient();
  const { data: dbLists = [], isLoading } = useQuery({
    queryKey: ['config-lists'],
    queryFn: () => base44.entities.ConfigList.list(),
  });

  // Merge: start from defaults, override with DB records that share the same key.
  const merged = {};
  for (const [key, def] of Object.entries(DEFAULT_CONFIG_LISTS)) {
    const dbMatch = dbLists.find(l => l.key === key);
    merged[key] = dbMatch || { key, ...def };
  }
  // Also include any extra DB-only lists (admin-created custom lists).
  for (const list of dbLists) {
    if (!merged[list.key]) merged[list.key] = list;
  }

  // Return a helper to grab options for a given key as {value,label} pairs.
  const getOptions = (key) => merged[key]?.options || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['config-lists'] });

  return { lists: Object.values(merged), getList: (key) => merged[key], getOptions, isLoading, invalidate };
}