import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Map as MapIcon, Users, Briefcase } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { format } from 'date-fns';

// Fix default marker icon for Leaflet in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_COLORS = {
  planning: '#3b82f6',
  in_progress: '#10b981',
  decommissioning: '#f59e0b',
  completed: '#6b7280',
  on_hold: '#a855f7',
  cancelled: '#ef4444',
};

export default function LiveSiteMapWidget() {
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: rotas = [] } = useQuery({ queryKey: ['rotas-today-map'], queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: format(new Date(), 'yyyy-MM-dd') }) });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  // Active jobs with coordinates
  const mappableJobs = useMemo(() => {
    return jobs.filter(j =>
      (j.status === 'in_progress' || j.status === 'planning') &&
      j.site_lat != null && j.site_lng != null &&
      !isNaN(j.site_lat) && !isNaN(j.site_lng)
    );
  }, [jobs]);

  // Crew counts per job today
  const crewPerJob = useMemo(() => {
    const map = {};
    rotas.forEach(r => { if (r.job_id) map[r.job_id] = (map[r.job_id] || 0) + 1; });
    return map;
  }, [rotas]);

  // Center map on first mappable job or default to UK center
  const center = mappableJobs.length > 0
    ? [mappableJobs[0].site_lat, mappableJobs[0].site_lng]
    : [51.5074, -0.1278]; // London default

  const activeCount = jobs.filter(j => j.status === 'in_progress').length;
  const totalCrewToday = new Set(rotas.map(r => r.staff_id)).size;

  return (
    <WidgetShell
      widgetId="live-site-map"
      title="Live Site Map"
      icon={MapPin}
      subtitle={`${mappableJobs.length} active sites · ${totalCrewToday} crew today`}
    >
      <div className="space-y-3">
        {mappableJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MapIcon className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No active jobs with GPS coordinates yet.</p>
            <p className="text-xs text-slate-400 mt-1">Add site coordinates to jobs (via the geocode button on the job form) to see them on the map.</p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                <Briefcase className="w-3 h-3" />{activeCount} active
              </span>
              <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                <Users className="w-3 h-3" />{totalCrewToday} on site
              </span>
              <span className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                <MapPin className="w-3 h-3" />{mappableJobs.length} mapped
              </span>
            </div>

            {/* Map */}
            <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '280px' }}>
              <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                {mappableJobs.map(job => {
                  const crewCount = crewPerJob[job.id] || 0;
                  const color = STATUS_COLORS[job.status] || '#6b7280';
                  return (
                    <Marker key={job.id} position={[job.site_lat, job.site_lng]}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold text-slate-900">{job.name}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{job.location}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: color + '20', color: color }}>
                              {job.status?.replace(/_/g, ' ')}
                            </span>
                            {crewCount > 0 && <span className="text-xs text-slate-500">{crewCount} crew today</span>}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

            {/* Site list */}
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {mappableJobs.slice(0, 5).map(job => (
                <div key={job.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[job.status] || '#6b7280' }} />
                    <span className="text-slate-700 truncate">{job.name}</span>
                  </div>
                  <span className="text-slate-400 ml-2 flex-shrink-0">{crewPerJob[job.id] || 0} crew</span>
                </div>
              ))}
              {mappableJobs.length > 5 && (
                <p className="text-[10px] text-slate-400 text-center pt-1">+ {mappableJobs.length - 5} more sites</p>
              )}
            </div>
          </>
        )}
      </div>
    </WidgetShell>
  );
}