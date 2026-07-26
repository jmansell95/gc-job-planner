import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Waves, MapPin, AlertTriangle } from 'lucide-react';
import { serviceEncounterConfig } from '@/components/investigation/shared';

const SERVICE_COLORS = {
  gas: '#ef4444',
  water: '#3b82f6',
  electric: '#f59e0b',
  telecom: '#8b5cf6',
  drainage: '#06b6d4',
  unknown: '#64748b',
};

const makeIcon = (color) => window.L?.divIcon?.({
  className: 'hazard-map-marker',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Job-scoped site hazard map — shows service encounters logged against this
// job's investigation logs only (vs the dashboard widget which is global).
export default function JobHazardMap({ job }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['job-hazard-map-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id })
  });

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

  const typeCounts = {};
  parsedHazards.forEach(h => {
    const t = h.service_encounter_type;
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  const center = parsedHazards[0]
    ? [parsedHazards[0].lat, parsedHazards[0].lng]
    : [51.5074, -0.1278];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center flex-shrink-0">
          <Waves className="w-4 h-4 text-cyan-700" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm">Site Hazard Map</h3>
          <p className="text-xs text-slate-400 truncate">Service encounters logged on this job</p>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-cyan-100 border-t-cyan-600 rounded-full animate-spin" />
          </div>
        ) : parsedHazards.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center px-6">
            <div className="w-11 h-11 rounded-full bg-cyan-50 flex items-center justify-center mb-3">
              <Waves className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No hazards mapped yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">Service encounters logged by the crew with GPS coordinates will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '300px' }}>
              <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                {parsedHazards.map(h => {
                  const color = SERVICE_COLORS[h.service_encounter_type] || '#64748b';
                  const icon = makeIcon(color);
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

            {parsedHazards.some(h => ['gas', 'electric'].includes(h.service_encounter_type)) && (
              <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="font-medium">High-risk services detected (gas/electric). Review logs for safe digging procedures.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}