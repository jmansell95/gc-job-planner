import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { canAccessRoute, resolveRoleLandingPage } from '@/utils/access';

// Route-level guard that enforces the site-wide lockdown.
// Drivers see deliveries only, field staff see schedule + profile only,
// office staff see admin. Anyone hitting a route they can't access is
// redirected to their own landing page.
export default function RouteGuard({ children }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();
  const { data: profile, isPending } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMyStaffProfile');
      return res.data;
    },
    enabled: !!isAuthenticated && !isLoadingAuth,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoadingAuth || isPending) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const isPlatformAdmin = user?.role === 'admin';

  // Profile failed to load and we can't determine access — show a retry
  // screen instead of redirecting (which would loop).
  if (!profile && !isPlatformAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 px-6">
        <div className="text-center max-w-sm">
          <p className="text-slate-700 font-semibold">Could not load your profile</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">Check your connection and try again.</p>
          <button onClick={() => window.location.reload()} type="button"
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!canAccessRoute(profile, isPlatformAdmin, location.pathname)) {
    const landing = resolveRoleLandingPage(profile, isPlatformAdmin);
    return <Navigate to={landing} replace />;
  }

  return children;
}