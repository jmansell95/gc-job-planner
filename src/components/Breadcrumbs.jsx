import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

// Route-level labels for known paths. The last entry is always the current
// page (non-link). Paths not listed here fall back to auto-generation from
// the URL segments (capitalised, hyphens → spaces).
const ROUTE_MAP = {
  '/': [{ label: 'Dashboard' }],
  '/admin': [{ label: 'Admin Dashboard' }],
  '/admin/logistics': [{ label: 'Admin', to: '/admin' }, { label: 'Logistics Hub' }],
  '/staff-schedule': [{ label: 'My Schedule' }],
  '/staff-profile': [{ label: 'My Schedule', to: '/staff-schedule' }, { label: 'My Profile' }],
  '/subcontractor': [{ label: 'Subcontractor' }],
  '/deliveries': [{ label: 'Deliveries' }],
  '/help': [{ label: 'Help Guide' }],
  '/presentation-pack': [{ label: 'Presentation Pack' }],
  '/rig-hub': [{ label: 'Admin', to: '/admin' }, { label: 'Rig Fleet' }],
  '/vehicles': [{ label: 'Admin', to: '/admin' }, { label: 'Vehicles' }],
  '/pat-testing': [{ label: 'Admin', to: '/admin' }, { label: 'Rig Fleet', to: '/rig-hub' }, { label: 'PAT Testing' }],
};

// Convert a raw path segment into a human-readable label.
function segmentToLabel(seg) {
  return seg
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Auto-generate a breadcrumb trail from the pathname when no explicit map
// entry exists. Each intermediate segment links to its accumulated path.
function autoGenerateTrail(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [{ label: 'Dashboard' }];
  return segments.map((seg, i, arr) => {
    const to = '/' + arr.slice(0, i + 1).join('/');
    return { label: segmentToLabel(seg), to: i < arr.length - 1 ? to : undefined };
  });
}

export default function Breadcrumbs({ sectionLabel }) {
  const { pathname } = useLocation();
  let trail = ROUTE_MAP[pathname] || autoGenerateTrail(pathname);

  // Allow pages with internal section navigation (e.g. AdminDashboard) to
  // append the current sub-section to the trail so users always see where
  // they are, even when the URL doesn't change.
  if (sectionLabel) {
    const last = trail[trail.length - 1];
    if (last) {
      // If the last item already matches the section label, don't duplicate.
      if (last.label !== sectionLabel) {
        // Make the previous last item clickable if it isn't already.
        if (!last.to) last.to = pathname;
        trail = [...trail, { label: sectionLabel }];
      }
    } else {
      trail = [{ label: sectionLabel }];
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1.5 py-[3px] text-sm overflow-hidden">
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