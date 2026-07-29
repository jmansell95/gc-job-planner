import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Search, Truck, ShieldCheck, ShieldAlert, ShieldX, Link2, Settings2, Trash2, Edit2, Wrench } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import VehicleCard from '@/components/vehicles/VehicleCard';
import VehicleEditModal from '@/components/vehicles/VehicleEditModal';
import HolmanSyncBar from '@/components/vehicles/HolmanSyncBar';
import VehicleMaintenanceManager from '@/components/VehicleMaintenanceManager';
import { Skeleton } from '@/components/StateViews';
import { differenceInDays } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function Vehicles() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editVehicle, setEditVehicle] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState('fleet'); // 'fleet' | 'maintenance'

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-created_date', 500),
  });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });

  const stats = useMemo(() => {
    const today = new Date();
    let compliant = 0, warning = 0, expired = 0, synced = 0;
    vehicles.forEach(v => {
      if (v.holman_sync_status === 'synced') synced++;
      const issues = [];
      if (v.mot_expiry) {
        const d = differenceInDays(new Date(v.mot_expiry + 'T00:00:00'), today);
        if (d < 0) issues.push('expired'); else if (d <= 30) issues.push('warning');
      }
      if (v.service_due_date) {
        const d = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today);
        if (d < 0) issues.push('expired'); else if (d <= 30) issues.push('warning');
      }
      if (issues.includes('expired')) expired++;
      else if (issues.includes('warning')) warning++;
      else compliant++;
    });
    return { total: vehicles.length, compliant, warning, expired, synced };
  }, [vehicles]);

  const q = search.toLowerCase().trim();
  const filtered = vehicles.filter(v => {
    if (statusFilter !== 'all') {
      const today = new Date();
      const issues = [];
      if (v.mot_expiry) { const d = differenceInDays(new Date(v.mot_expiry + 'T00:00:00'), today); if (d < 0) issues.push('expired'); else if (d <= 30) issues.push('warning'); }
      if (v.service_due_date) { const d = differenceInDays(new Date(v.service_due_date + 'T00:00:00'), today); if (d < 0) issues.push('expired'); else if (d <= 30) issues.push('warning'); }
      const level = issues.includes('expired') ? 'expired' : issues.includes('warning') ? 'warning' : 'compliant';
      if (statusFilter !== level) return false;
    }
    if (!q) return true;
    return (v.name || '').toLowerCase().includes(q) || (v.registration_number || '').toLowerCase().includes(q);
  });

  const handleAdd = () => { setEditVehicle(null); setModalOpen(true); };
  const handleEdit = (v) => { setEditVehicle(v); setModalOpen(true); };

  const handleDelete = async (id) => {
    if (!confirm('Delete this vehicle?')) return;
    try {
      await base44.entities.Vehicle.delete(id);
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({ title: 'Vehicle deleted' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Breadcrumbs />
      {/* Hero header */}
      <div className="hero-gradient text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate('/admin')} className="p-2 bg-white/15 hover:bg-white/25 rounded-lg transition flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight truncate">Vehicles</h1>
                <p className="text-sm text-white/70">Manage your fleet vehicles — MOT, service dates & Holman sync</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setView(view === 'fleet' ? 'maintenance' : 'fleet')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-lg font-semibold text-sm transition">
                <Wrench className="w-4 h-4" /> {view === 'fleet' ? 'Maintenance' : 'Fleet'}
              </button>
              <button onClick={handleAdd} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-[#2E5A1A] rounded-lg font-semibold text-sm hover:bg-white/90 active:scale-95 transition shadow-sm">
                <Plus className="w-4 h-4" /> Add Vehicle
              </button>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Vehicles', value: stats.total, icon: Truck, grad: 'stat-gradient-brand' },
              { label: 'Compliant', value: stats.compliant, icon: ShieldCheck, grad: 'stat-gradient-emerald' },
              { label: 'Need Attention', value: stats.warning, icon: ShieldAlert, grad: 'stat-gradient-amber' },
              { label: 'Critical', value: stats.expired, icon: ShieldX, grad: 'stat-gradient-rose' },
              { label: 'Holman Synced', value: stats.synced, icon: Link2, grad: 'stat-gradient-blue' },
            ].map(s => {
              const SIcon = s.icon;
              return (
                <div key={s.label} className={`${s.grad} rounded-xl p-3.5 text-white shadow-lg ring-1 ring-white/20`}>
                  <SIcon className="w-5 h-5 text-white/90 mb-1.5" />
                  <p className="text-2xl font-bold tabular-nums drop-shadow-sm">{s.value}</p>
                  <p className="text-[11px] text-white/85 font-medium">{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {view === 'maintenance' ? (
          <VehicleMaintenanceManager />
        ) : (
          <>
            {/* Holman sync bar */}
            <div className="mb-4">
              <HolmanSyncBar />
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 mb-5 flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by reg or description..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
              </div>
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                {[
                  { val: 'all', label: 'All' },
                  { val: 'compliant', label: 'Compliant' },
                  { val: 'warning', label: 'Attention' },
                  { val: 'expired', label: 'Critical' },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setStatusFilter(opt.val)}
                    className={`px-3 py-1.5 rounded-md text-sm font-semibold transition ${statusFilter === opt.val ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <Truck className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{vehicles.length === 0 ? 'No vehicles yet. Add your first vehicle to get started.' : 'No vehicles match your filters.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(v => (
                  <div key={v.id} className="relative group">
                    <VehicleCard vehicle={v} staff={staff} team={teams} onClick={handleEdit} />
                    <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(v); }} className="p-1.5 bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 rounded-lg transition shadow-sm">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }} className="p-1.5 bg-white border border-slate-200 text-red-500 hover:bg-red-50 rounded-lg transition shadow-sm">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <VehicleEditModal vehicle={editVehicle} staff={staff} teams={teams} onClose={() => { setModalOpen(false); setEditVehicle(null); }} />
      )}
    </div>
  );
}