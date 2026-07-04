import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PoundSterling, Ruler, Check, X, TrendingUp, Info, Search, Clock } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const roleLabels = {
  groundworker: 'Groundworker', cp_driller: 'CP Driller', rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew', depot: 'Depot', supervisor: 'Supervisor',
};
const isDrillingRole = (r) => r === 'cp_driller' || r === 'rotary_driller';
const fmt = (n) => '£' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function CostSettings() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState({});
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);
  const [search, setSearch] = useState('');

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets-costs'], queryFn: () => base44.entities.Timesheet.list() });

  const filtered = staff.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    roleLabels[s.job_role]?.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (m) => {
    setEditing({ [m.id]: true });
    setDrafts({ [m.id]: { day_rate: m.day_rate ?? '', meterage_rate: m.meterage_rate ?? '' } });
  };

  const cancelEdit = (id) => {
    setEditing({});
    setDrafts({});
  };

  const save = async (m) => {
    setSaving(m.id);
    try {
      const d = drafts[m.id];
      await base44.entities.Staff.update(m.id, {
        day_rate: d.day_rate === '' ? '' : parseFloat(d.day_rate),
        meterage_rate: d.meterage_rate === '' ? '' : parseFloat(d.meterage_rate),
      });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      cancelEdit(m.id);
    } catch (e) {
      console.error(e);
    }
    setSaving(null);
  };

  // Timesheet-derived metrics
  const approvedTimesheets = timesheets.filter(t => t.status === 'approved');
  const staffHours = {};
  const staffMeterage = {};
  approvedTimesheets.forEach(t => {
    const mins = Number(t.task_duration_minutes) || (t.total_hours ? t.total_hours * 60 : 0);
    staffHours[t.staff_id] = (staffHours[t.staff_id] || 0) + mins;
    staffMeterage[t.staff_id] = (staffMeterage[t.staff_id] || 0) + (Number(t.task_meterage) || 0);
  });

  const totalDailyCost = staff.reduce((sum, s) => sum + (s.day_rate || 0), 0);
  const drillersCount = staff.filter(s => isDrillingRole(s.job_role)).length;
  const staffWithoutRates = staff.filter(s => !s.day_rate && !s.meterage_rate).length;

  return (
    <div>
      <PageHeader title="Cost Management" icon={PoundSterling} />

      {/* How costing works */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5 md:p-6 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-700 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 mb-2">How job costing works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white/70 rounded-lg p-3 border border-emerald-100">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-800 mb-1">
                  <Ruler className="w-4 h-4" /> Meterage rate
                </div>
                <p className="text-slate-600 text-xs">Drilling staff with a £/m rate are costed as <b>meterage × rate</b>. A job-level meterage figure overrides shift meterage for the whole job.</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 border border-emerald-100">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-800 mb-1">
                  <Clock className="w-4 h-4" /> Timesheet hours
                </div>
                <p className="text-slate-600 text-xs">Non-drilling staff with logged hours are costed as <b>hours × hourly rate</b> (day rate ÷ 8), pulled from submitted/approved timesheets.</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 border border-emerald-100">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-800 mb-1">
                  <TrendingUp className="w-4 h-4" /> Day rate fallback
                </div>
                <p className="text-slate-600 text-xs">With no timesheet hours, cost is <b>shifts × day rate</b>. A manual actual cost on a job overrides all auto-calculation.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Staff</p>
          <p className="text-xl md:text-2xl font-bold text-slate-900 mt-1">{staff.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Drillers</p>
          <p className="text-xl md:text-2xl font-bold text-amber-600 mt-1">{drillersCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Daily rate total</p>
          <p className="text-xl md:text-2xl font-bold text-emerald-700 mt-1">{fmt(totalDailyCost)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium">Missing rates</p>
          <p className="text-xl md:text-2xl font-bold text-red-600 mt-1">{staffWithoutRates}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff or role..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white"
        />
      </div>

      {/* Rates table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No staff found.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Staff Member</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Day Rate</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Meterage Rate £/m</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Logged Hours</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Logged Meterage</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(m => {
                  const d = drafts[m.id];
                  const isEdit = editing[m.id];
                  const hours = (staffHours[m.id] || 0) / 60;
                  const meterage = staffMeterage[m.id] || 0;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-700 font-bold text-xs">{m.name.charAt(0)}</span>
                          </div>
                          <span className="font-medium text-slate-900 text-sm">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">{roleLabels[m.job_role] || m.job_role}</td>
                      <td className="px-5 py-3 text-right">
                        {isEdit ? (
                          <input type="number" min="0" step="0.01" value={d.day_rate}
                            onChange={(e) => setDrafts({ [m.id]: { ...d, day_rate: e.target.value } })}
                            placeholder="0.00" className="w-24 px-2 py-1 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:border-emerald-600" />
                        ) : (
                          <span className={`text-sm font-medium ${m.day_rate ? 'text-slate-900' : 'text-red-400'}`}>{m.day_rate ? fmt(m.day_rate) : 'Not set'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isEdit ? (
                          <input type="number" min="0" step="0.01" value={d.meterage_rate}
                            onChange={(e) => setDrafts({ [m.id]: { ...d, meterage_rate: e.target.value } })}
                            placeholder={isDrillingRole(m.job_role) ? '0.00' : 'N/A'}
                            disabled={!isDrillingRole(m.job_role)}
                            className="w-24 px-2 py-1 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:border-emerald-600 disabled:bg-slate-50 disabled:text-slate-300" />
                        ) : (
                          <span className={`text-sm font-medium ${m.meterage_rate ? 'text-amber-600' : (isDrillingRole(m.job_role) ? 'text-red-400' : 'text-slate-300')}`}>
                            {m.meterage_rate ? `£${m.meterage_rate}/m` : (isDrillingRole(m.job_role) ? 'Not set' : '—')}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-sm text-slate-600">{hours > 0 ? `${hours.toFixed(1)}h` : '—'}</td>
                      <td className="px-5 py-3 text-right text-sm text-slate-600">{meterage > 0 ? `${meterage}m` : '—'}</td>
                      <td className="px-5 py-3 text-center">
                        {isEdit ? (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => save(m)} disabled={saving === m.id} className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50"><Check className="w-4 h-4" /></button>
                            <button onClick={() => cancelEdit(m.id)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(m)} className="text-xs text-emerald-700 hover:text-emerald-900 font-medium px-3 py-1 rounded-lg hover:bg-emerald-50 transition">Edit rates</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {filtered.map(m => {
              const d = drafts[m.id];
              const isEdit = editing[m.id];
              const hours = (staffHours[m.id] || 0) / 60;
              const meterage = staffMeterage[m.id] || 0;
              return (
                <div key={m.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-700 font-bold text-sm">{m.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{m.name}</p>
                        <p className="text-xs text-slate-500">{roleLabels[m.job_role] || m.job_role}</p>
                      </div>
                    </div>
                    {isEdit ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => save(m)} disabled={saving === m.id} className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50"><Check className="w-4 h-4" /></button>
                        <button onClick={() => cancelEdit(m.id)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(m)} className="text-xs text-emerald-700 font-medium px-2.5 py-1 rounded-lg bg-emerald-50 flex-shrink-0">Edit</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-xs text-slate-400">Day Rate</p>
                      {isEdit ? (
                        <input type="number" min="0" step="0.01" value={d.day_rate}
                          onChange={(e) => setDrafts({ [m.id]: { ...d, day_rate: e.target.value } })}
                          placeholder="0.00" className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:border-emerald-600" />
                      ) : (
                        <p className={`font-medium mt-0.5 ${m.day_rate ? 'text-slate-900' : 'text-red-400'}`}>{m.day_rate ? fmt(m.day_rate) : 'Not set'}</p>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-xs text-slate-400">Meterage £/m</p>
                      {isEdit ? (
                        <input type="number" min="0" step="0.01" value={d.meterage_rate}
                          onChange={(e) => setDrafts({ [m.id]: { ...d, meterage_rate: e.target.value } })}
                          placeholder={isDrillingRole(m.job_role) ? '0.00' : 'N/A'}
                          disabled={!isDrillingRole(m.job_role)}
                          className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-100" />
                      ) : (
                        <p className={`font-medium mt-0.5 ${m.meterage_rate ? 'text-amber-600' : (isDrillingRole(m.job_role) ? 'text-red-400' : 'text-slate-300')}`}>
                          {m.meterage_rate ? `£${m.meterage_rate}/m` : (isDrillingRole(m.job_role) ? 'Not set' : '—')}
                        </p>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-xs text-slate-400">Logged hours</p>
                      <p className="font-medium text-slate-700 mt-0.5">{hours > 0 ? `${hours.toFixed(1)}h` : '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-xs text-slate-400">Logged meterage</p>
                      <p className="font-medium text-slate-700 mt-0.5">{meterage > 0 ? `${meterage}m` : '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}