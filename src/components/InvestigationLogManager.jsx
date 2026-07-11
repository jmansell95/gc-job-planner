import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { FlaskConical, Layers, Ruler, TestTube, Wrench, MapPin, Package, ClipboardList, ArrowDownToLine } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';

const logTypeConfig = {
  borehole_progress: { label: 'Borehole Progress', icon: ArrowDownToLine, badge: 'bg-blue-100 text-blue-700' },
  sample_collection: { label: 'Sample', icon: TestTube, badge: 'bg-purple-100 text-purple-700' },
  pit_excavation: { label: 'Trial Pit', icon: MapPin, badge: 'bg-amber-100 text-amber-700' },
  installation: { label: 'Installation', icon: Package, badge: 'bg-emerald-100 text-emerald-700' },
  site_setup: { label: 'Site Setup', icon: Wrench, badge: 'bg-slate-100 text-slate-600' },
  other: { label: 'Other', icon: ClipboardList, badge: 'bg-slate-100 text-slate-600' },
};

const sampleTypeLabels = {
  disturbed: 'Disturbed (D)',
  undisturbed: 'Undisturbed (U)',
  water: 'Water (W)',
  none: '—',
};

export default function InvestigationLogManager({ job, isDrillingJob }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['investigation-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });

  // Group by date
  const byDate = {};
  logs.forEach(l => {
    if (!byDate[l.date]) byDate[l.date] = [];
    byDate[l.date].push(l);
  });
  const sortedDates = Object.keys(byDate).sort().reverse();

  // Summary stats
  const totalDepth = logs.reduce((sum, l) => {
    if (l.depth_from != null && l.depth_to != null) return sum + (l.depth_to - l.depth_from);
    return sum;
  }, 0);
  const totalSamples = logs.filter(l => l.sample_type && l.sample_type !== 'none').length;
  const totalPits = logs.filter(l => l.log_type === 'pit_excavation').length;
  const totalInstallations = logs.filter(l => l.log_type === 'installation').reduce((sum, l) => sum + (l.units_completed || 0), 0);
  const uniqueBoreholes = [...new Set(logs.filter(l => l.borehole_ref).map(l => l.borehole_ref))];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Investigation Log</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{logs.length} entries</span>
      </div>

      {/* Summary stats */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 bg-slate-50/50 border-b border-slate-100">
          {isDrillingJob ? (
            <>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Total Depth</p>
                <p className="text-lg font-bold text-blue-700">{totalDepth.toFixed(1)}m</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Boreholes</p>
                <p className="text-lg font-bold text-slate-800">{uniqueBoreholes.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Samples</p>
                <p className="text-lg font-bold text-purple-700">{totalSamples}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Entries</p>
                <p className="text-lg font-bold text-slate-800">{logs.length}</p>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Trial Pits</p>
                <p className="text-lg font-bold text-amber-700">{totalPits}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Installations</p>
                <p className="text-lg font-bold text-emerald-700">{totalInstallations}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Log Entries</p>
                <p className="text-lg font-bold text-slate-800">{logs.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase font-medium">Days Logged</p>
                <p className="text-lg font-bold text-slate-800">{sortedDates.length}</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="p-5">
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : logs.length === 0 ? (
          <EmptyState icon={FlaskConical} title="No investigation logs yet" message={isDrillingJob ? "Drilling crews will log borehole progress and samples here during shifts." : "Groundworks crews will log trial pits, installations and site setup here during shifts."} />
        ) : (
          <div className="space-y-5">
            {sortedDates.map(date => {
              const dayLogs = byDate[date].sort((a, b) => (a.depth_from || 0) - (b.depth_from || 0));
              const d = new Date(date + 'T00:00:00');
              return (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{format(d, 'EEEE, dd MMM yyyy')}</span>
                    <span className="text-xs text-slate-400">{dayLogs.length} entries</span>
                  </div>
                  <div className="space-y-2">
                    {dayLogs.map(log => {
                      const cfg = logTypeConfig[log.log_type] || logTypeConfig.other;
                      const Icon = cfg.icon;
                      return (
                        <div key={log.id} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-slate-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
                              {log.borehole_ref && <span className="text-xs font-mono font-bold text-blue-700">{log.borehole_ref}</span>}
                              {log.sample_id && <span className="text-xs font-mono font-bold text-purple-700">{log.sample_id}</span>}
                              <span className="text-xs text-slate-400 ml-auto">{log.staff_name}</span>
                            </div>
                            {(log.depth_from != null && log.depth_to != null) && (
                              <p className="text-sm text-slate-700 mt-1">
                                <Ruler className="w-3.5 h-3.5 inline text-slate-400 mr-1" />
                                {log.depth_from}m → {log.depth_to}m ({(log.depth_to - log.depth_from).toFixed(1)}m)
                              </p>
                            )}
                            {log.sample_type && log.sample_type !== 'none' && (
                              <p className="text-xs text-purple-600 mt-0.5">Sample: {sampleTypeLabels[log.sample_type]}</p>
                            )}
                            {log.units_completed != null && log.units_completed > 0 && (
                              <p className="text-sm text-slate-700 mt-0.5">{log.units_completed} {log.units_label || 'units'}</p>
                            )}
                            {log.dimensions && <p className="text-xs text-slate-500 mt-0.5">Dimensions: {log.dimensions}</p>}
                            {log.description && <p className="text-sm text-slate-600 mt-1">{log.description}</p>}
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