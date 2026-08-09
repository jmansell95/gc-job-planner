import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import AdminNav from '@/components/AdminNav';
import MobileBottomNav from '@/components/MobileBottomNav';
import Breadcrumbs from '@/components/Breadcrumbs';
import { STANDALONE_ROUTES, ROUTE_TO_SECTION } from '@/utils/standaloneRoutes';

// Maps standalone routes to the closest AdminNav section so the
// sidebar highlights the right item when on a non-dashboard page.
const ROUTE_SECTION_MAP = {
  '/staff-schedule': 'scheduling',
  '/staff-profile': 'scheduling',
  '/subcontractor': 'scheduling',
  '/deliveries': 'logistics',
  '/admin/logistics': 'logistics',
  '/pat-testing': 'assets',
  '/safety': 'compliance',
  '/help': 'overview',
  '/presentation-pack': 'overview',
  '/keylogbook-docs': 'overview',
  '/roadmap': 'overview',
  ...ROUTE_TO_SECTION,
};

/**
 * Shared layout that gives every authenticated page the admin sidebar
 * (desktop) and the fixed mobile header with hamburger drawer (mobile).
 * AdminDashboard manages its own AdminNav; all other admin pages use this
 * layout via the router.
 */
export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeSection = ROUTE_SECTION_MAP[location.pathname] || '';

  const setActiveSection = (s) => {
    // Standalone pages get a direct route push — no blank-flash round-trip
    // through the AdminDashboard section state.
    if (STANDALONE_ROUTES[s]) {
      navigate(STANDALONE_ROUTES[s]);
    } else {
      navigate('/admin', { state: { section: s } });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-bg-vibrant">
      <AdminNav activeSection={activeSection} setActiveSection={setActiveSection} />
      <main
        className="flex-1 overflow-auto pt-[calc(3.5rem+env(safe-area-inset-top)-25px)] lg:pt-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="px-4 pb-24 md:px-6 lg:pb-6 lg:pt-6 w-full">
          <Breadcrumbs />
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}