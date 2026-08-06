import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { resolveRoleLandingPage } from '@/utils/access';
import Logo from '@/components/Logo';

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
        const landing = resolveRoleLandingPage(profile, user.role === 'admin');
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
    <div className="flex flex-col items-center justify-center min-h-screen page-bg-vibrant">
      <div className="mb-6 animate-float">
        <Logo variant="full" height={48} />
      </div>
      <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      <p className="text-sm text-slate-500 mt-4 font-medium">Loading your workspace…</p>
    </div>
  );
}