import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import EnterpriseHeader from '@/components/EnterpriseHeader';
import {
  Truck, ArrowLeft, Search, Building2, AlertCircle, Wrench,
  Car, Navigation,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

function getVehicleStatus(v) {
  const today = new Date();
  const issues = [];
  const motExpiry = (v.mot_expiry && v.mot_expiry !== 'null' && v.mot_expiry !== 'None') ? v.mot_expiry : null;
  if (motExpiry) {
    const d = differenceInDays(new Date(motExpiry + 'T00:00:00'), today);
    if (!isNaN(d)) {
      if (d < 0) issues.push({ label: 'MOT Expired', severity: 'expired', days: d });
      else if (d <= 30) issues.push({ label: 'MOT Due', severity: 'warning', days: d });
    }
  }
  if (v.service_due_date && v.service_due_date !== 'null' && v.service_due_date !== 'None') {
    const d = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today);
    if (!isNaN(d)) {
      if (d < 0) issues.push({ label: 'Service Overdue', severity: 'expired', days: d });
      else if (d <= 30) issues.push({ label: 'Service Due', severity: 'warning', days: d });
    }
  }
  const level = issues.find(i => i.severity === 'expired') ? 'expired'
    : issues.find(i => i.severity === 'warning') ? 'warning'
    : 'compliant';
  return { issues, level };
}

const STATUS_BADGE = {
  compliant: { label: 'OK', cls: 'bg-emerald-100 text-emerald-700' },
  warning: { label: 'Attention', cls: 'bg-amber-100 text-amber-700' },
  expired: { label: 'Critical', cls: 'bg-rose-100 text-rose-700' },
};

export default function EnterpriseFleetHub() {
  const navigate = useNavigate();
  const { divisions } = useDivision();
  const [search, setSearch] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['enterprise-vehicles-all'],
    queryFn: () => base44.entities.Vehicle.list('-created_date', 500),
  });

  const divisionMap = useMemo(() => {
    const m = {};
    divisions.forEach(d => { m[d.id] = d; });
    return m;
  }, [divisions]);

  const vehiclesByDivision = useMemo(() => {
    const groups = {};
    divisions.forEach(d => { groups[d.id] = []; });
    vehicles.forEach(v => {
      const key = v.division_id || 'shared';
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    });
    return groups;
  }, [vehicles, divisions]);

  const divisionStats = useMemo(() => {
    const result = divisions.map(d => ({
      division: d,
      count: (vehiclesByDivision[d.id] || []).length,
    })).filter(s => s.count > 0);
    // Add shared pool if any
    if (vehiclesByDivision['shared']?.length > 0) {
      result.push({ division: { id: 'shared', name: 'Shared Pool', color: '#64748b', code: 'SHARED' }, count: vehiclesByDivision['shared'].length });
    }
    return result;
  }, [divisions, vehiclesByDivision]);

  const stats = useMemo(() => {
    let compliant = 0, warning = 0, expired = 0;
    vehicles.forEach(v => {
      const { level } = getVehicleStatus(v);
      if (level === 'expired') expired++;
      else if (level === 'warning') warning++;
      else compliant++;
    });
    return { total: vehicles.length, compliant, warning, expired };
  }, [vehicles]);

  const q = search.toLowerCase().trim();
  const filtered = useMemo(() => {
    let result = vehicles;
    if (divisionFilter !== 'all') {
      result = result.filter(v => (v.division_id || 'shared') === divisionFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter(v => getVehicleStatus(v).level === statusFilter);
    }
    if (q) {
      result = result.filter(v =>
        (v.name || '').toLowerCase().includes(q) ||
        (v.registration_number || '').toLowerCase().includes(q) ||
        (v.make || '').toLowerCase().includes(q) ||
        (v.model || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [vehicles, divisionFilter, statusFilter, q]);

  const groupedFiltered = useMemo(() => {
    const groups = {};
    filtered.forEach(v => {
      const key = v.division_id || 'shared';
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="min-h-screen page-bg-vibrant">
      <EnterpriseHeader />

      {/* Hero */}
      <div className="relative">
        <div className="hero-vibrant absolute inset-0 overflow-hidden" />
        <div className="relative px-4 xl:px-6 pt-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] xl:pt-8 pb-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => navigate('/enterprise')}
                  className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0 shadow-lg hover:bg-white/20 transition"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/20">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-none truncate">
                    Enterprise Fleet Hub
                  </h1>
                  <p className="text-xs sm:text-sm text-white/70 font-semibold mt-1 truncate">All vehicles across every division</p>
                </div>
              </div>
            </div>

            {/* Hero metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="stat-gradient-teal rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">Total Vehicles</p>
                  <p className="text-lg font-extrabold text-white tabular-nums truncate">{stats.total}</p>
                </div>
              </div>
              <div className="stat-gradient-emerald rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Car className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">Compliant</p>
                  <p className="text-lg font-extrabold text-white tabular-nums truncate">{stats.compliant}</p>
                </div>
              </div>
              <div className="stat-gradient-amber rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">Attention</p>
                  <p className="text-lg font-extrabold text-white tabular-nums truncate">{stats.warning}</p>
                </div>
              </div>
              <div className="stat-gradient-rose rounded-2xl p-3 flex items-center gap-2.5 shadow-lg">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide truncate">Critical</p>
                  <p className="text-lg font-extrabold text-white tabular-nums truncate">{stats.expired}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 xl:px-6 pb-24 xl:pb-6 space-y-4 max-w-7xl mx-auto">

        {/* Search + filters */}
        <div className="insight-card rounded-2xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by reg, name, make or model..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10"
            />
          </div>
          {/* Division filter pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setDivisionFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition ${divisionFilter === 'all' ? 'bg-[#2E5A1A] text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              All Divisions ({stats.total})
            </button>
            {divisionStats.map(({ division, count }) => (
              <button
                key={division.id}
                onClick={() => setDivisionFilter(division.id)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${divisionFilter === division.id ? 'text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                style={divisionFilter === division.id ? { background: division.color || '#2E5A1A' } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: division.color || '#2E5A1A' }} />
                {division.name} ({count})
              </button>
            ))}
          </div>
          {/* Status filter pills */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {[
              { val: 'all', label: 'All Status' },
              { val: 'compliant', label: 'OK' },
              { val: 'warning', label: 'Attention' },
              { val: 'expired', label: 'Critical' },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => setStatusFilter(opt.val)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition whitespace-nowrap ${statusFilter === opt.val ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicle grid — grouped by division */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl bg-white border border-slate-200 p-5 h-48" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="insight-card rounded-2xl p-10 text-center">
            <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No vehicles match your filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedFiltered).map(([divId, groupVehicles]) => {
              const division = divisionMap[divId];
              const isShared = divId === 'shared';
              const name = isShared ? 'Shared Pool' : (division?.name || 'Unknown');
              const color = isShared ? '#64748b' : (division?.color || '#2E5A1A');
              return (
                <div key={divId}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                    <h2 className="text-base font-extrabold text-slate-900">{name}</h2>
                    <span className="text-xs font-semibold text-slate-400">({groupVehicles.length})</span>
                    <div className="flex-1 h-px bg-slate-200 ml-2" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {groupVehicles.map(v => {
                      const { issues, level } = getVehicleStatus(v);
                      const badge = STATUS_BADGE[level];
                      return (
                        <div key={v.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition group">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
                                <Truck className="w-5 h-5" style={{ color }} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{v.name || 'Unnamed Vehicle'}</p>
                                <p className="text-xs text-slate-500 truncate">{v.registration_number || 'No reg'}</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>{badge.label}</span>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            {v.make && <p className="text-slate-600"><span className="font-semibold">Make:</span> {v.make}{v.model ? ` ${v.model}` : ''}</p>}
                            {v.vehicle_type && <p className="text-slate-600"><span className="font-semibold">Type:</span> {v.vehicle_type}</p>}
                            {v.current_operator_name && (
                              <p className="text-slate-600 flex items-center gap-1">
                                <Navigation className="w-3 h-3 text-emerald-500" />
                                <span className="font-semibold">Driving:</span> {v.current_operator_name}
                              </p>
                            )}
                            {issues.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {issues.map((issue, i) => (
                                  <span key={i} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${issue.severity === 'expired' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {issue.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}