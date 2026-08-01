import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import AdminNav from '@/components/AdminNav';

// Maps standalone routes to the closest AdminNav section so the
// sidebar highlights the right item when on a non-dashboard page.
const ROUTE_SECTION_MAP = {
  '/staff-schedule': 'scheduling',
  '/staff-profile': 'scheduling',
  '/subcontractor': 'scheduling',
  '/deliveries': 'logistics',
  '/admin/logistics': 'logistics',
  '/pat-testing': 'fleet',
  '/help': 'overview',
  '/presentation-pack': 'overview',
};

/**
 * Shared layout that gives every authenticated page the admin sidebar
 * (desktop) and the fixed mobile header with hamburger drawer (mobile).
 * Pages that already render their own AdminNav (AdminDashboard, RigHub,
 * Vehicles) are NOT wrapped by this layout — they manage their own nav.
 */
export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeSection = ROUTE_SECTION_MAP[location.pathname] || '';

  const setActiveSection = (s) => {
    navigate('/admin', { state: { section: s } });
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100/80">
      <AdminNav activeSection={activeSection} setActiveSection={setActiveSection} />
      <main
        className="flex-1 overflow-auto pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pt-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="px-4 pb-4 md:px-6 md:pb-6 lg:pt-6 w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}