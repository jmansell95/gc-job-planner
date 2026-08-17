// useFeatureAccess — resolves the effective access level for a given feature
// key, factoring in the active division's lockdown manifest.
//
// Resolution order (most specific wins):
//   1. Platform admin → always 'write', everything visible
//   2. DivisionAccessManifest.hidden_elements / disabled_elements → 'none' / 'disabled'
//   3. DivisionAccessManifest.feature_access[moduleKey] → override
//   4. PermissionGroup base permissions → 'none' / 'read' / 'write'
//
// Returns: { level: 'none'|'read'|'write', isHidden, isDisabled, isMasked }

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { resolveModuleLevel, normalizePermissions } from '@/utils/permissions';

export function useFeatureAccess(featureKey, moduleKey) {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === 'admin';
  const { activeDivisionId } = useDivision();

  // Fetch the current user's staff profile (with permission group) if not already cached
  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile-access'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; },
    enabled: !!user,
  });

  // Fetch all manifests for the active division (small dataset — one per group per division)
  const { data: manifests = [] } = useQuery({
    queryKey: ['division-access-manifests', activeDivisionId],
    queryFn: async () => {
      if (!activeDivisionId) return [];
      return await base44.entities.DivisionAccessManifest.filter({ division_id: activeDivisionId });
    },
    enabled: !!activeDivisionId,
  });

  return useMemo(() => {
    // Platform admins bypass everything
    if (isPlatformAdmin) {
      return { level: 'write', isHidden: false, isDisabled: false, isMasked: false, isOverridden: false };
    }

    // Resolve the user's permission group id
    const groupId = profile?.permission_group_id || profile?.team?.permission_group_id;
    if (!groupId) {
      return { level: 'none', isHidden: true, isDisabled: false, isMasked: false, isOverridden: false };
    }

    // Find the manifest for this group in this division
    const manifest = manifests.find(m => m.permission_group_id === groupId);

    // Check hidden / disabled element lists first (most specific)
    if (manifest?.hidden_elements?.includes(featureKey)) {
      return { level: 'none', isHidden: true, isDisabled: false, isMasked: false, isOverridden: true };
    }
    if (manifest?.disabled_elements?.includes(featureKey)) {
      return { level: 'read', isHidden: false, isDisabled: true, isMasked: false, isOverridden: true };
    }

    // Check feature_access override for the module
    let level;
    if (moduleKey && manifest?.feature_access && manifest.feature_access[moduleKey]) {
      level = manifest.feature_access[moduleKey];
    } else {
      // Fall back to the group's base permission
      level = resolveModuleLevel(profile, isPlatformAdmin, moduleKey || featureKey);
    }

    // Check data masking
    let isMasked = false;
    if (manifest?.data_masking) {
      const maskKey = moduleKey === 'billing' ? 'financials' : featureKey;
      const maskSetting = manifest.data_masking[maskKey];
      if (maskSetting === 'hidden' || maskSetting === 'blurred') isMasked = true;
    }

    return {
      level,
      isHidden: level === 'none',
      isDisabled: false,
      isMasked,
      isOverridden: !!manifest,
    };
  }, [isPlatformAdmin, profile, manifests, featureKey, moduleKey]);
}

// Convenience hook for checking a specific module's access level
export function useModuleAccess(moduleKey) {
  return useFeatureAccess(moduleKey, moduleKey);
}