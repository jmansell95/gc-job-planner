import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

// Route-level breadcrumb trail. Each entry before the last exposes a `to`
// (clickable back link); the last entry is the current page (non-link).
const ROUTE_MAP = {
  '/admin': [{ label: 'Admin Dashboard' }],
  '/staff-schedule': [{ label: 'My Schedule' }],
  '/staff-profile': [{ label: 'My Schedule', to: '/staff-schedule' }, { label: 'My Profile' }],
  '/subcontractor': [{ label: 'Subcontractor' }],
  '/deliveries': [{ label: 'Deliveries' }],
  '/help': [{ label: 'Help Guide' }],
  '/presentation-pack': [{ label: 'Presentation Pack' }],
  '/rig-hub': [{ label: 'Admin', to: '/admin' }, { label: 'Fleet Hub' }],
  '/pat-testing': [{ label: 'Fleet Hub', to: '/rig-hub' }, { label: 'PAT Testing' }],
};

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const trail = ROUTE_MAP[pathname];
  if (!trail) return null;

  return (
    <nav aria-label="Breadcrumb" className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1.5 py-2 text-sm overflow-hidden">
        <Link to="/" className="flex items-center gap-1 text-slate-500 hover:text-[#2E5A1A] transition font-medium flex-shrink-0">
          <Home className="w-3.5 h-3.5" /><span className="hidden sm:inline">Home</span>
        </Link>
        {trail.map((item, i) => {
          const isLast = i === trail.length - 1;
          return (
            <React.Fragment key={i}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              {item.to && !isLast ? (
                <Link to={item.to} className="text-slate-500 hover:text-[#2E5A1A] transition font-medium truncate">{item.label}</Link>
              ) : (
                <span className={`truncate ${isLast ? 'text-[#2E5A1A] font-semibold' : 'text-slate-500 font-medium'}`}>{item.label}</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}