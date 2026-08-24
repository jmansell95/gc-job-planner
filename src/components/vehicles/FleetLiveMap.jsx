import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const KM_TO_MI = 0.621371;

/**
 * FleetLiveMap — compact Leaflet map showing all vehicles with live GPS
 * positions. Markers are colour-coded: green = moving, amber = engine on,
 * slate = stopped. Click a marker for driver + speed details.
 */
export default function FleetLiveMap({ vehicles, liveByVehicle, height = 280 }) {
  const positions = useMemo(() => {
    return vehicles
      .map(v => {
        const live = liveByVehicle[v.id];
        if (!live || !live.lat || !live.lng) return null;
        const isMoving = live.is_driving_now || (live.ignition_on && (live.speed_kph || 0) > 0);
        return {
          id: v.id,
          reg: v.registration_number || v.name || '',
          name: v.name || '',
          lat: Number(live.lat),
          lng: Number(live.lng),
          speed: live.speed_kph || 0,
          isMoving,
          ignition: live.ignition_on,
          driver: live.driver_name || v.geotab_driver_name || v.geotab_keeper_name || '',
          timestamp: live.timestamp,
        };
      })
      .filter(Boolean);
  }, [vehicles, liveByVehicle]);

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200" style={{ height }}>
        <div className="text-center">
          <Navigation className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-medium">No live GPS data</p>
          <p className="text-xs text-slate-300">Sync from Geotab to see positions</p>
        </div>
      </div>
    );
  }

  // Center on the first moving vehicle, or the first position
  const centerVehicle = positions.find(p => p.isMoving) || positions[0];
  const center = [centerVehicle.lat, centerVehicle.lng];

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ height }}>
      <MapContainer center={center} zoom={6} className="h-full w-full" style={{ zIndex: 1 }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        {positions.map(p => {
          const color = p.isMoving ? '#10b981' : p.ignition ? '#f59e0b' : '#94a3b8';
          return (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={7}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
            >
              <Popup>
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-sm">{p.reg}</p>
                  {p.name && p.name !== p.reg && <p className="text-slate-500">{p.name}</p>}
                  {p.driver && <p className="text-slate-600">Driver: {p.driver}</p>}
                  <p className="font-medium" style={{ color }}>
                    {p.isMoving ? `Moving · ${Math.round(p.speed * KM_TO_MI)} mph` : p.ignition ? 'Engine On' : 'Stopped'}
                  </p>
                  {p.timestamp && (
                    <p className="text-slate-400">{new Date(p.timestamp).toLocaleString('en-GB')}</p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}