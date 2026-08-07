// Sections that have their own dedicated sidebar-accessible pages.
// When a nav item or dashboard tile targets one of these, navigate
// directly to the route instead of going through the AdminDashboard
// section state (which causes a blank flash before the redirect fires).
export const STANDALONE_ROUTES = {
  staff: '/staff',
  contacts: '/contacts',
  automations: '/automations',
  'price-list': '/price-list',
  reports: '/reports',
  import: '/import',
  audit: '/audit',
  timesheets: '/timesheets',
  compliance: '/compliance',
  billing: '/billing',
  vehicles: '/vehicles',
  assets: '/assets',
};

// Reverse map: route path → section id (for sidebar active-state highlight).
export const ROUTE_TO_SECTION = Object.fromEntries(
  Object.entries(STANDALONE_ROUTES).map(([section, route]) => [route, section])
);

export function isStandaloneSection(section) {
  return Object.prototype.hasOwnProperty.call(STANDALONE_ROUTES, section);
}