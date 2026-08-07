import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Waves, MapPin, AlertTriangle } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { serviceEncounterConfig } from '@/components/investigation/shared';

const SERVICE_COLORS = {
  gas: '#ef4444',
  water: '#3b82f6',
  electric: '#f59e0b',
  telecom: '#8b5cf6',
  drainage: '#06b6d4',
  unknown: '#64748b',
};

// Custom coloured div icon for leaflet markers
const makeIcon = (color) => window.L?.divIcon?.({
  className: 'hazard-map-marker',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function SiteHazardMapWidget({ onNavigate }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['hazard-map-logs'],
    queryFn: () => base44.entities.InvestigationLog.list('-created_date', 500)
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['hazard-map-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200)
  });

  // Filter to logs with GPS coordinates and a service encounter
  const hazardLogs = logs.filter(l =>
    l.service_encounter_gps &&
    l.service_encounter_type &&
    l.service_encounter_type !== 'none'
  );

  const parsedHazards = hazardLogs.map(l => {
    const [lat, lng] = (l.service_encounter_gps || '').split(',').map(v => parseFloat(v.trim()));
    if (isNaN(lat) || isNaN(lng)) return null;
    return { ...l, lat, lng };
  }).filter(Boolean);

  const jobMap = {};
  jobs.forEach(j => { jobMap[j.id] = j; });

  // Group by type for the legend counts
  const typeCounts = {};
  parsedHazards.forEach(h => {
    const t = h.service_encounter_type;
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  // Default centre: first hazard or UK centre
  const center = parsedHazards[0]
    ? [parsedHazards[0].lat, parsedHazards[0].lng]
    : [51.5074, -0.1278];

  return (
    <WidgetShell icon={Waves} iconBg="bg-cyan-50" iconColor="text-cyan-700" title="Site Hazard Map" subtitle="Live service encounter locations from field logs"
      action={parsedHazards.length > 0 ? (
        <button onClick={() => onNavigate?.('compliance')} type="button"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-cyan-700 hover:bg-cyan-50 rounded-lg transition">
          Review Logs <MapPin className="w-3.5 h-3.5" />
        </button>
      ) : null}>
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-cyan-100 border-t-cyan-600 rounded-full animate-spin" />
        </div>
      ) : parsedHazards.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center px-6">
          <div className="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center mb-3">
            <Waves className="w-6 h-6 text-cyan-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No hazards mapped yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">Service encounters logged by field crews with GPS coordinates will appear here as a live hazard map.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '320px' }}>
            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {parsedHazards.map(h => {
                const color = SERVICE_COLORS[h.service_encounter_type] || '#64748b';
                const icon = makeIcon(color);
                const job = h.job_id ? jobMap[h.job_id] : null;
                const sc = serviceEncounterConfig[h.service_encounter_type];
                return (
                  <Marker key={h.id} position={[h.lat, h.lng]} icon={icon}>
                    <Popup>
                      <div style={{ minWidth: '180px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: color, marginBottom: '4px' }}>
                          {sc?.label || h.service_encounter_type}
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569' }}>
                          <div><strong>Ref:</strong> {h.borehole_ref || '—'}</div>
                          {job && <div><strong>Job:</strong> {job.name}</div>}
                          <div><strong>Depth:</strong> {h.depth_from != null ? `${h.depth_from}m` : '—'} → {h.depth_to != null ? `${h.depth_to}m` : '—'}</div>
                          <div><strong>Logged by:</strong> {h.staff_name || '—'}</div>
                          <div><strong>Date:</strong> {h.date || '—'}</div>
                          {h.description && <div style={{ marginTop: '4px', fontStyle: 'italic' }}>{h.description}</div>}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(typeCounts).map(([type, count]) => {
              const sc = serviceEncounterConfig[type] || {};
              return (
                <span key={type} className="inline-flex items-center gap-1.5 text-xs bg-slate-50 px-2 py-1 rounded-full font-medium text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: SERVICE_COLORS[type] || '#64748b' }} />
                  {sc.label || type} ({count})
                </span>
              );
            })}
          </div>

          {/* Alert if high-risk services found */}
          {parsedHazards.some(h => ['gas', 'electric'].includes(h.service_encounter_type)) && (
            <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="font-medium">High-risk services detected (gas/electric). Review logs for safe digging procedures.</span>
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}