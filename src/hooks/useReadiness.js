import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FEATURE_REGISTRY } from '@/utils/featureRegistry';

const SETTING_KEY = 'feature_readiness';
const QUERY_KEY = ['app-setting', SETTING_KEY];

// Readiness states
export const STATE_ACTIVE = 'active';
export const STATE_COMING_SOON = 'coming_soon';
export const STATE_LOCKED = 'locked';

/**
 * useReadiness — reads the feature_readiness AppSetting and provides:
 *   states        — { [featureId]: 'active' | 'coming_soon' | 'locked' }
 *   getState(id)  — resolved state for a feature (falls back to registry default)
 *   isReady(id)  — true when the feature is 'active'
 *   isComingSoon(id) — true when the feature is 'coming_soon'
 *   isLocked(id)  — true when the feature is 'locked'
 *   setState(id, state) — persists a new state for a feature
 *   setAll(states) — bulk replace the entire readiness map
 *   isLoading     — true while the setting is being fetched
 */
export function useReadiness() {
  const queryClient = useQueryClient();

  const { data: rawStates = {}, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const list = await base44.entities.AppSetting.filter({ key: SETTING_KEY });
      return list?.[0]?.value || {};
    },
  });

  // Merge stored states over registry defaults
  const states = {};
  for (const [id, feature] of Object.entries(FEATURE_REGISTRY)) {
    states[id] = rawStates[id] || feature.defaultState;
  }

  const getState = (id) => states[id] || STATE_ACTIVE;

  const isReady = (id) => getState(id) === STATE_ACTIVE;
  const isComingSoon = (id) => getState(id) === STATE_COMING_SOON;
  const isLocked = (id) => getState(id) === STATE_LOCKED;

  const persist = async (newStates) => {
    const list = await base44.entities.AppSetting.filter({ key: SETTING_KEY });
    const existing = list?.[0];
    if (existing) {
      await base44.entities.AppSetting.update(existing.id, { value: newStates });
    } else {
      await base44.entities.AppSetting.create({ key: SETTING_KEY, value: newStates });
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  };

  const setState = async (id, state) => {
    const newStates = { ...rawStates, [id]: state };
    await persist(newStates);
  };

  const setAll = async (newStates) => {
    await persist(newStates);
  };

  return {
    states,
    getState,
    isReady,
    isComingSoon,
    isLocked,
    setState,
    setAll,
    isLoading,
  };
}