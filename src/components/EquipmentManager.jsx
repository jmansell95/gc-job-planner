import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench, Plus, Trash2, Package, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/PageHeader';

const typeConfig = {
  drill: { label: 'Drill', badge: 'bg-amber-100 text-amber-700' },
  pump: { label: 'Pump', badge: 'bg-blue-100 text-blue-700' },
  generator: { label: 'Generator', badge: 'bg-purple-100 text-purple-700' },
  vehicle: { label: 'Vehicle', badge: 'bg-emerald-100 text-emerald-700' },
  tool: { label: 'Tool', badge: 'bg-slate-100 text-slate-600' },
  other: { label: 'Other', badge: 'bg-slate-100 text-slate-600' }
};

const statusConfig = {
  available: { label: 'Available', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  checked_out: { label: 'Checked Out', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  maintenance: { label: 'Maintenance', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' }
};

export default function EquipmentManager() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'drill', serial_number: '' });
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [checkoutData, setCheckoutData] = useState({ job_id: '', staff_id: '', return_date: '' });
  const queryClient = useQueryClient();

  const { data: equipment = [] } = useQuery({ queryKey: ['equipment'], queryFn: () => base44.entities.Equipment.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await base44.entities.Equipment.create({ ...formData, status: 'available' });
    setFormData({ name: '', type: 'drill', serial_number: '' });
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
  };

  const handleCheckout = async (item) => {
    await base44.entities.Equipment.update(item.id, {
      status: 'checked_out',
      assigned_job_id: checkoutData.job_id,
      assigned_staff_id: checkoutData.staff_id,
      checkout_date: format(new Date(), 'yyyy-MM-dd'),
      return_date: checkoutData.return_date
    });
    setCheckoutTarget(null);
    setCheckoutData({ job_id: '', staff_id: '', return_date: '' });
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
  };

  const handleReturn = async (item) => {
    await base44.entities.Equipment.update(item.id, {
      status: 'available', assigned_job_id: '', assigned_staff_id: '', checkout_date: '', return_date: ''
    });
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
  };

  const handleDelete = async (id) => {
    await base44.entities.Equipment.delete(id);
    queryClient.invalidateQueries({ queryKey: ['equipment'] });
  };

  const availableCount = equipment.filter(e => e.status === 'available').length;
  const checkedOutCount = equipment.filter(e => e.status === 'checked_out').length;

  return (
    <div>
      <PageHeader title="Equipment" icon={Wrench} />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Available</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{availableCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Checked Out</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{checkedOutCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Total Items</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{equipment.length}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-slate-900">Equipment Inventory</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Equipment
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 border border-emerald-200 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm">
                {Object.entries(typeConfig).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Serial Number</label>
              <input type="text" value={formData.serial_number} onChange={e => setFormData({ ...formData, serial_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">Add</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {equipment.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No equipment added yet</div>
        ) : equipment.map(item => {
          const type = typeConfig[item.type] || typeConfig.other;
          const status = statusConfig[item.status] || statusConfig.available;
          const job = jobs.find(j => j.id === item.assigned_job_id);
          const member = staff.find(s => s.id === item.assigned_staff_id);
          return (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Wrench className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{item.name}</p>
                    {item.serial_number && <p className="text-xs text-slate-400 font-mono">{item.serial_number}</p>}
                  </div>
                </div>
                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-300 hover:text-red-500 rounded transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.badge}`}>{type.label}</span>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${status.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                  {status.label}
                </span>
              </div>
              {item.status === 'checked_out' && (
                <div className="text-xs text-slate-500 space-y-1 mb-3 bg-slate-50 rounded-lg p-2">
                  {job && <p className="truncate">📍 {job.name}</p>}
                  {member && <p>👤 {member.name}</p>}
                  {item.return_date && <p>📅 Due: {item.return_date}</p>}
                </div>
              )}
              {item.status === 'available' && (
                <button onClick={() => setCheckoutTarget(item)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm font-medium">
                  <Package className="w-3.5 h-3.5" /> Check Out
                </button>
              )}
              {item.status === 'checked_out' && (
                <button onClick={() => handleReturn(item)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium">
                  <RotateCcw className="w-3.5 h-3.5" /> Return
                </button>
              )}
            </div>
          );
        })}
      </div>

      {checkoutTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setCheckoutTarget(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-900 mb-4">Check Out: {checkoutTarget.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assign to Job</label>
                <select value={checkoutData.job_id} onChange={e => setCheckoutData({ ...checkoutData, job_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                  <option value="">Select Job</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assign to Staff</label>
                <select value={checkoutData.staff_id} onChange={e => setCheckoutData({ ...checkoutData, staff_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                  <option value="">Select Staff</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expected Return Date</label>
                <input type="date" value={checkoutData.return_date} onChange={e => setCheckoutData({ ...checkoutData, return_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleCheckout(checkoutTarget)} disabled={!checkoutData.job_id}
                className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm disabled:opacity-50">
                Confirm Checkout
              </button>
              <button onClick={() => setCheckoutTarget(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}