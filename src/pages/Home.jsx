import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { resolveLandingPage } from '@/utils/teamAccess';

export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || !user) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        const profile = res.data;
        if (cancelled) return;
        const landing = resolveLandingPage(profile?.team, profile?.is_admin || user.role === 'admin');
        navigate(landing, { replace: true });
      } catch (err) {
        if (cancelled) return;
        // Fallback to role-based redirect if profile fetch fails
        navigate(user.role === 'admin' ? '/admin' : '/staff-schedule', { replace: true });
      }
    })();

    return () => { cancelled = true; };
  }, [navigate, user, isAuthenticated, isLoadingAuth]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-green-600 rounded-full animate-spin"></div>
      <p className="text-sm text-slate-400 mt-4">Loading your workspace…</p>
    </div>
  );
}