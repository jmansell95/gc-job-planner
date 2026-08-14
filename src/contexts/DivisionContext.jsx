import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const DivisionContext = createContext(null);
const STORAGE_KEY = 'gc-active-division';

/**
 * DivisionProvider — the multi-division context that powers the whole platform.
 *
 * - Loads every Division record.
 * - Resolves the current user's division (from their Staff profile or User record).
 * - Enterprise admins (platform role 'admin' or is_enterprise_admin) can switch
 *   between divisions and view the Enterprise Overview (no division selected).
 * - Regular users are locked to their own division.
 * - Persists the selected division in localStorage so it survives refreshes.
 */
export function DivisionProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const isPlatformAdmin = user?.role === 'admin';
  const isEnterpriseAdmin = isPlatformAdmin || user?.is_enterprise_admin === true;

  const { data: divisions = [], isLoading: divisionsLoading } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
    enabled: !!isAuthenticated,
  });

  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile-division'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; },
    enabled: !!isAuthenticated,
  });

  const myDivisionId = profile?.division_id || user?.division_id || null;

  const [activeDivisionId, setActiveDivisionIdState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
  });

  const activeDivision = useMemo(
    () => divisions.find(d => d.id === activeDivisionId) || null,
    [divisions, activeDivisionId]
  );

  // Lock regular (non-enterprise) users to their own division.
  useEffect(() => {
    if (divisionsLoading || !isAuthenticated) return;
    if (!isEnterpriseAdmin && myDivisionId && activeDivisionId !== myDivisionId) {
      setActiveDivisionIdState(myDivisionId);
      try { localStorage.setItem(STORAGE_KEY, myDivisionId); } catch {}
    }
  }, [divisionsLoading, isAuthenticated, isEnterpriseAdmin, myDivisionId, activeDivisionId]);

  const setActiveDivision = (id) => {
    setActiveDivisionIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id || ''); } catch {}
  };

  const isHubEnabled = (hubId) => {
    if (!activeDivision) return true; // Enterprise overview = all hubs
    const hubs = activeDivision.enabled_hubs || [];
    if (hubs.length === 0) return true; // Not configured = show all
    return hubs.includes(hubId);
  };

  const value = {
    divisions,
    activeDivision,
    activeDivisionId,
    setActiveDivision,
    isEnterpriseAdmin,
    myDivisionId,
    isLoading: divisionsLoading,
    isHubEnabled,
  };

  return <DivisionContext.Provider value={value}>{children}</DivisionContext.Provider>;
}

export function useDivision() {
  const ctx = useContext(DivisionContext);
  if (!ctx) {
    return {
      divisions: [], activeDivision: null, activeDivisionId: null,
      setActiveDivision: () => {}, isEnterpriseAdmin: false, myDivisionId: null,
      isLoading: true, isHubEnabled: () => true,
    };
  }
  return ctx;
}