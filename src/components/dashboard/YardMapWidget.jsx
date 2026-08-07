import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Warehouse, MapPin, Package, Truck, Wrench, Boxes } from 'lucide-react';
import WidgetShell from './WidgetShell';

// Yard Management Visual Map — shows a visual layout of the depot/yard
// with zones (rig bay, van parking, container storage, workshop) and
// which assets are currently parked/stored in each zone. Uses SiteAsset
// location data to map items to yard zones.

const YARD_ZONES = [
  { id: 'rig_bay', label: 'Rig Bay', icon: Wrench, color: 'stat-gradient-amber', desc: 'Drilling rigs & ancillaries' },
  { id: 'van_parking', label: 'Van Parking', icon: Truck, color: 'stat-gradient-blue', desc: 'Fleet vehicles' },
  { id: 'container', label: 'Container Storage', icon: Boxes, color: 'stat-gradient-emerald', desc: 'Casing, tooling, gear' },
  { id: 'workshop', label: 'Workshop', icon: Package, color: 'stat-gradient-violet', desc: 'Maintenance & repairs' },
  { id: 'yard_open', label: 'Open Yard', icon: MapPin, color: 'stat-gradient-slate', desc: 'General storage' },
];

export default function YardMapWidget() {
  const { data: assets = [] } = useQuery({
    queryKey: ['assets-yard-map'],
    queryFn: async () => { const r = await base44.entities.SiteAsset.list('-created_date', 200); return r.data || r || []; },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-yard-map'],
    queryFn: async () => { const r = await base44.entities.Vehicle.list('-created_date', 100); return r.data || r || []; },
  });

  // Group assets by their current location zone
  const zoneData = useMemo(() => {
    const zones = {};
    YARD_ZONES.forEach(z => { zones[z.id] = { assets: [], vehicles: [] }; });

    assets.forEach(a => {
      const zone = a.current_location_type === 'depot' ? 'yard_open' :
                   a.current_location_type === 'workshop' ? 'workshop' :
                   a.current_location_type === 'container' ? 'container' :
                   a.current_location_type === 'rig_bay' ? 'rig_bay' :
                   a.current_location_type === 'van' ? 'van_parking' : null;
      if (zone && zones[zone]) {
        zones[zone].assets.push(a);
      }
    });

    // Vehicles not currently assigned to a job are "in yard"
    vehicles.forEach(v => {
      if (!v.assigned_staff_id) {
        zones.van_parking.vehicles.push(v);
      }
    });

    return zones;
  }, [assets, vehicles]);

  const totalItems = Object.values(zoneData).reduce((sum, z) => sum + z.assets.length + z.vehicles.length, 0);

  return (
    <WidgetShell
      icon={Warehouse}
      title="Yard Management Map"
      subtitle={`${totalItems} items currently in the depot across ${YARD_ZONES.length} zones`}
    >
      {/* Visual yard layout grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {YARD_ZONES.map(zone => {
          const data = zoneData[zone.id] || { assets: [], vehicles: [] };
          const count = data.assets.length + data.vehicles.length;
          const Icon = zone.icon;
          return (
            <div key={zone.id} className="relative rounded-xl overflow-hidden ring-1 ring-slate-200 hover:ring-slate-300 transition group">
              {/* Zone background */}
              <div className={`absolute inset-0 ${zone.color} opacity-10`} />
              <div className="relative p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg ${zone.color} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-lg font-bold text-slate-700">{count}</span>
                </div>
                <p className="text-xs font-semibold text-slate-700">{zone.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{zone.desc}</p>

                {/* Items in zone */}
                {count > 0 && (
                  <div className="mt-2 space-y-0.5 max-h-20 overflow-y-auto">
                    {data.vehicles.slice(0, 3).map(v => (
                      <p key={v.id} className="text-[10px] text-slate-600 truncate">🚐 {v.registration_number || v.name}</p>
                    ))}
                    {data.assets.slice(0, 4).map(a => (
                      <p key={a.id} className="text-[10px] text-slate-600 truncate">📦 {a.name || a.asset_type}</p>
                    ))}
                    {count > 7 && <p className="text-[10px] text-slate-400">+ {count - 7} more</p>}
                  </div>
                )}
                {count === 0 && (
                  <p className="text-[10px] text-slate-300 mt-2 italic">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> = Vehicle</span>
        <span className="flex items-center gap-1"><Package className="w-3 h-3" /> = Asset</span>
        <span className="ml-auto">Items map from SiteAsset current_location_type</span>
      </div>
    </WidgetShell>
  );
}