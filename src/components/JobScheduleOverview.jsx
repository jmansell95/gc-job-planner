import React from 'react';
import { Users, Calendar, User, Truck, ShieldCheck, PlayCircle, CheckCircle2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { getCrewLabel } from '@/utils/terminology';

const roleLabels = {
  groundworker: 'Groundworker', cp_driller: 'CP Driller', rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew', depot: 'Depot', supervisor: 'Supervisor',
};

const workerTypeBadge = {
  direct_employee: 'bg-emerald-100 text-emerald-700',
  subcontractor: 'bg-orange-100 text-orange-700',
  agency: 'bg-blue-100 text-blue-700',
};

export default function JobScheduleOverview({ primaryType, assignedStaff, rotas, allStaff, vehicles, rotasByDate, sortedDates }) {
  return (
    <div className="space-y-6 mb-6">
      {/* Assigned Staff */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><Users className="w-4 h-4 text-emerald-700" /></div>
          <h2 className="font-semibold text-slate-900">Assigned Staff</h2>
          <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{assignedStaff.length} {assignedStaff.length === 1 ? 'person' : 'people'}</span>
        </div>
        {assignedStaff.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">No crew assigned yet</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {assignedStaff.map(member => {
              const memberRotas = rotas.filter(r => r.staff_id === member.id);
              const memberVehicleIds = [...new Set(memberRotas.map(r => r.vehicle_id).filter(Boolean))];
              const memberVehicles = memberVehicleIds.map(id => vehicles.find(v => v.id === id)).filter(Boolean);
              return (
                <div key={member.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-700 font-bold text-sm">{member.name.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                      <p className="text-xs text-slate-500">{roleLabels[member.job_role] || getCrewLabel(primaryType, 1)}</p>
                      {memberVehicles.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs text-slate-500">{memberVehicles.map(v => v.registration_number).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${workerTypeBadge[member.worker_type] || 'bg-slate-100 text-slate-600'}`}>
                      {member.worker_type?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-400">{memberRotas.length} {memberRotas.length === 1 ? 'shift' : 'shifts'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daily Schedule */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Calendar className="w-4 h-4 text-blue-700" /></div>
          <h2 className="font-semibold text-slate-900">Daily Schedule</h2>
          <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{sortedDates.length} days</span>
        </div>
        {sortedDates.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">No shifts scheduled yet</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedDates.map(date => {
              const _rawDayRotas = rotasByDate[date];
              const _seenStaff = {};
              const dayRotas = _rawDayRotas.filter(r => {
                if (_seenStaff[r.staff_id]) return false;
                _seenStaff[r.staff_id] = true;
                return true;
              });
              const d = new Date(date + 'T00:00:00');
              return (
                <div key={date} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-slate-900">{format(d, 'EEEE, dd MMM yyyy')}</span>
                    <span className="text-xs text-slate-400">{dayRotas.length} {dayRotas.length === 1 ? 'person' : 'people'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dayRotas.map(rota => {
                      const member = allStaff.find(s => s.id === rota.staff_id);
                      const vehicle = vehicles.find(v => v.id === rota.vehicle_id);
                      return (
                        <div key={rota.id} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium text-slate-700">{member?.name || 'Unknown'}</span>
                            {vehicle && (
                              <>
                                <span className="text-slate-300">·</span>
                                <Truck className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-slate-500 font-mono">{vehicle.registration_number}</span>
                              </>
                            )}
                            {rota.briefing_signed && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium ml-auto">
                                <ShieldCheck className="w-3 h-3" /> Briefing {rota.briefing_signed_at ? format(new Date(rota.briefing_signed_at), 'HH:mm') : ''}
                              </span>
                            )}
                            {rota.status === 'started' && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                <PlayCircle className="w-3 h-3" /> Started
                              </span>
                            )}
                            {rota.status === 'completed' && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                <CheckCircle2 className="w-3 h-3" /> Done
                              </span>
                            )}
                          </div>
                          {rota.progress_notes && (
                            <div className="flex items-start gap-1.5 mt-1.5 pl-5">
                              <MessageSquare className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                              <p className="text-slate-500 leading-relaxed">{rota.progress_notes}</p>
                            </div>
                          )}
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