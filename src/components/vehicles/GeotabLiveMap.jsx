import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import {
  MapPin, Satellite, Loader2, RefreshCw, Navigation, Gauge, Clock,
  Car, FileBarChart, X, Route, Zap, Filter,
} from 'lucide-react';
import GeotabReportModal from '@/components/vehicles/GeotabReportModal';

// Default UK centre
const UK_CENTER = [52.3, -1.5];

function VehicleMarker({ vehicle, onClick }) {
  const pos = [vehicle.lat, vehicle.lng];
  const colour = vehicle.ignition_on ? '#06b6d4' : '#94a3b8';
  const icon = window.L?.divIcon({
    html: `<div style="position:relative">
      <div style="background:${colour};width:30px;height:30px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-7l-2-5H6L4 9v7h3"/><circle cx="7.5" cy="16.5" r="2.5"/><circle cx="17.5" cy="16.5" r="2.5"/></svg>
      </div>
      ${vehicle.ignition_on ? '<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ' + colour + ';opacity:0.4;animation:pulse 2s infinite"></div>' : ''}
    </div>`,
    className: 'hazard-map-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
  if (!icon) return <Marker position={pos}><Popup>{vehicle.registration_number}</Popup></Marker>;
  return (
    <Marker position={pos} icon={icon} eventHandlers={{ click: () => onClick(vehicle) }}>
      <Popup>
        <div className="text-xs space-y-1">
          <p className="font-bold text-sm font-mono">{vehicle.registration_number}</p>
          <p className="text-slate-600">{vehicle.vehicle_name}</p>
          <p className="flex items-center gap-1"><Navigation className="w-3 h-3" /> {vehicle.speed_kph} km/h {vehicle.ignition_on ? '🟢 Engine On' : '⚪ Engine Off'}</p>
          {vehicle.driver_name && <p>Driver: {vehicle.driver_name}</p>}
          <p className="text-slate-400">{new Date(vehicle.timestamp).toLocaleString('en-GB')}</p>
        </div>
      </Popup>
    </Marker>
  );
}

export default function GeotabLiveMap() {
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [filterMoving, setFilterMoving] = useState('all'); // 'all' | 'moving' | 'stopped'

  const { data: liveData, isLoading, refetch } = useQuery({
    queryKey: ['geotab-live-locations'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live', limit: 500 });
      return res.data || res;
    },
    refetchInterval: 60000,
  });

  const { data: history } = useQuery({
    queryKey: ['geotab-vehicle-history', selectedVehicle?.vehicle_id],
    queryFn: async () => {
      if (!selectedVehicle?.vehicle_id) return null;
      const res = await base44.functions.invoke('getVehicleLocationHistory', {
        mode: 'history',
        vehicle_id: selectedVehicle.vehicle_id,
        limit: 200,
      });
      return res.data || res;
    },
    enabled: !!selectedVehicle?.vehicle_id,
  });

  const allVehicles = liveData?.vehicles || [];
  const vehicles = useMemo(() => {
    if (filterMoving === 'moving') return allVehicles.filter(v => v.ignition_on);
    if (filterMoving === 'stopped') return allVehicles.filter(v => !v.ignition_on);
    return allVehicles;
  }, [allVehicles, filterMoving]);

  const trackedCount = allVehicles.length;
  const movingCount = allVehicles.filter(v => v.ignition_on).length;
  const stoppedCount = trackedCount - movingCount;

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await base44.functions.invoke('syncGeotabFleet', { action: 'sync' });
      const d = res.data || res;
      setSyncMsg({ ok: !!d.ok, text: d.message || d.error || 'Done' });
      refetch();
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message || 'Sync failed' });
    }
    setSyncing(false);
  };

  const historyPath = useMemo(() => {
    if (!history?.points) return [];
    return history.points.map(p => [p.lat, p.lng]).reverse();
  }, [history]);

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="w-9 h-9 rounded-lg stat-gradient-cyan flex items-center justify-center">
            <Satellite className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Live Fleet Map</p>
            <p className="text-[11px] text-slate-500">{trackedCount} tracked · {movingCount} moving · {stoppedCount} stopped</p>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex p-1 bg-slate-100 rounded-lg gap-0.5">
          {[
            { val: 'all', label: 'All', count: trackedCount },
            { val: 'moving', label: 'Moving', count: movingCount },
            { val: 'stopped', label: 'Stopped', count: stoppedCount },
          ].map(opt => (
            <button key={opt.val} onClick={() => setFilterMoving(opt.val)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${filterMoving === opt.val ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`}>
              {opt.val === 'moving' && <Zap className="w-3 h-3" />}
              {opt.val === 'stopped' && <Clock className="w-3 h-3" />}
              {opt.label}
              <span className={`text-[10px] tabular-nums ${filterMoving === opt.val ? 'text-cyan-500' : 'text-slate-400'}`}>{opt.count}</span>
            </button>
          ))}
        </div>

        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold hover:bg-[#1c4a12] disabled:opacity-50 transition">
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync
        </button>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        <button onClick={() => setShowReport(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition">
          <FileBarChart className="w-3.5 h-3.5" /> Reports
        </button>
      </div>

      {syncMsg && (
        <div className={`rounded-lg px-3 py-2 text-xs ${syncMsg.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {syncMsg.text}
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-cyan-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500">Loading live vehicle locations...</p>
        </div>
      ) : trackedCount === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <MapPin className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No location data yet</p>
          <p className="text-xs text-slate-400 mt-1">Sync from Geotab to populate the live map. Configure credentials in Settings → Geotab GPS Sync.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Map */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div style={{ height: '500px' }} className="rounded-xl">
              <MapContainer center={UK_CENTER} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                {vehicles.map(v => (
                  <VehicleMarker key={v.vehicle_id || v.registration_number} vehicle={v} onClick={setSelectedVehicle} />
                ))}
                {historyPath.length > 1 && (
                  <Polyline positions={historyPath} pathOptions={{ color: '#06b6d4', weight: 3, opacity: 0.6 }} />
                )}
              </MapContainer>
            </div>
          </div>

          {/* Vehicle list */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Car className="w-4 h-4 text-cyan-600" /> Vehicles ({vehicles.length})</p>
              <span className="text-[10px] text-slate-400 flex items-center gap-1"><Filter className="w-3 h-3" /> {filterMoving}</span>
            </div>
            <div className="max-h-[448px] overflow-y-auto divide-y divide-slate-50">
              {vehicles.map(v => (
                <button key={v.vehicle_id || v.registration_number}
                  onClick={() => setSelectedVehicle(v)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition ${selectedVehicle?.vehicle_id === v.vehicle_id ? 'bg-cyan-50' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-sm text-slate-900 truncate">{v.registration_number}</p>
                      <p className="text-[11px] text-slate-500 truncate">{v.vehicle_name}</p>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${v.ignition_on ? 'bg-cyan-500 pulse-ring' : 'bg-slate-300'}`} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                    <span className="flex items-center gap-0.5"><Gauge className="w-3 h-3" /> {v.speed_kph} km/h</span>
                    <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {v.timestamp ? new Date(v.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    {v.driver_name && <span className="flex items-center gap-0.5 text-blue-500 truncate">{v.driver_name}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected vehicle detail */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedVehicle(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3 rounded-t-2xl z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg stat-gradient-cyan flex items-center justify-center">
                  <Car className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 font-mono">{selectedVehicle.registration_number}</h3>
                  <p className="text-[11px] text-slate-400">{selectedVehicle.vehicle_name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedVehicle(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {/* Live status tiles */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-xl p-3 ${selectedVehicle.ignition_on ? 'bg-cyan-50 border border-cyan-200' : 'bg-slate-50 border border-slate-200'}`}>
                  <p className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1"><Zap className="w-3 h-3" /> Status</p>
                  <p className="text-sm font-bold flex items-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full ${selectedVehicle.ignition_on ? 'bg-cyan-500 pulse-ring' : 'bg-slate-300'}`} />
                    <span className={selectedVehicle.ignition_on ? 'text-cyan-700' : 'text-slate-500'}>{selectedVehicle.ignition_on ? 'Engine On' : 'Engine Off'}</span>
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1"><Gauge className="w-3 h-3" /> Speed</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">{selectedVehicle.speed_kph} <span className="text-[10px] font-normal">km/h</span></p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> Coordinates</p>
                  <p className="text-xs font-mono text-slate-600 mt-1">{selectedVehicle.lat.toFixed(4)}, {selectedVehicle.lng.toFixed(4)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Last Seen</p>
                  <p className="text-xs text-slate-600 mt-1">{selectedVehicle.timestamp ? new Date(selectedVehicle.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                </div>
              </div>

              {/* Driver */}
              {selectedVehicle.driver_name && (
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-700">{selectedVehicle.driver_name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-blue-400 font-semibold">Driver</p>
                    <p className="text-sm font-medium text-blue-700">{selectedVehicle.driver_name}</p>
                  </div>
                </div>
              )}

              {/* Trip history route */}
              {history && history.count > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Route className="w-4 h-4 text-cyan-600" />
                    <p className="text-xs font-bold text-slate-700">Location History ({history.count} points)</p>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {history.points.slice(0, 20).map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-slate-500 py-1 border-b border-slate-50">
                        <MapPin className="w-3 h-3 text-slate-300 flex-shrink-0" />
                        <span className="font-mono">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                        <span className="ml-auto">{p.timestamp ? new Date(p.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showReport && <GeotabReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
}