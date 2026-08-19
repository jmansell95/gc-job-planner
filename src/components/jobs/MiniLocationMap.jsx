import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';

/**
 * MiniLocationMap — a small, non-interactive Leaflet map shown on job cards.
 * Renders a single marker at the job's site coordinates.
 * Lightweight: all interactions disabled, no zoom control, fixed size.
 */
export default function MiniLocationMap({ lat, lng, label, height = 100 }) {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;

  return (
    <div
      className="rounded-lg overflow-hidden border border-slate-200/80 relative"
      style={{ height }}
      onClick={(e) => e.stopPropagation()}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={13}
        style={{ height: '100%', width: '100%', cursor: 'default' }}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker
          center={[lat, lng]}
          radius={8}
          pathOptions={{ color: '#2E5A1A', fillColor: '#2E5A1A', fillOpacity: 0.8, weight: 2 }}
        >
          {label && <Tooltip direction="top" offset={[0, -8]} className="!text-xs">
            {label}
          </Tooltip>}
        </CircleMarker>
      </MapContainer>
      <div className="absolute bottom-1 right-1 bg-white/80 backdrop-blur-sm rounded px-1.5 py-0.5 text-[8px] text-slate-500 font-medium pointer-events-none">
        {lat.toFixed(3)}, {lng.toFixed(3)}
      </div>
    </div>
  );
}