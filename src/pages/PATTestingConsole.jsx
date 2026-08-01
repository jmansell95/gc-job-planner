import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plug, Search, ShieldCheck, ShieldAlert, ShieldX, HelpCircle,
  RefreshCw, Plus, CheckCircle2, XCircle, Clock, Cog, Printer, Zap, ChevronRight,
} from 'lucide-react';
import { daysUntil, ASSET_TYPE_META } from '@/utils/rigRollup';
import { Skeleton } from '@/components/StateViews';
import PATTestForm from '@/components/pat/PATTestForm';
import Breadcrumbs from '@/components/Breadcrumbs';
import { safeFormat } from '@/utils/format';
import { useToast } from '@/components/ui/use-toast';

/**
 * PAT Testing Console — the field tester's mobile-first workspace.
 * Pulls every portable appliance (synced from Asset Panda) into a queue,
 * lets the tester open the digital PAT form, and tracks the session's
 * completed tests so the tester can work through a batch and print labels.
 */
export default function PATTestingConsole() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState('all'); // all | overdue | due_soon | unknown | ok
  const [testAsset, setTestAsset] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [sessionLog, setSessionLog] = useState([]);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const patAssets = useMemo(() => assets.filter(a => a.asset_type === 'portable_appliance'), [assets]);

  const items = useMemo(() => patAssets.map(a => {
    const d = daysUntil(a.compliance_expiry_date);
    let b;
    if (a.compliance_status === 'expired' || (d !== null && d < 0)) b = 'overdue';
    else if (a.compliance_status === 'expiring' || (d !== null && d <= 30)) b = 'due_soon';
    else if (a.compliance_status === 'unknown' || d === null) b = 'unknown';
    else b = 'ok';
    return { asset: a, bucket: b, days: d };
  }), [patAssets]);

  const counts = useMemo(() => ({
    overdue: items.filter(i => i.bucket === 'overdue').length,
    due_soon: items.filter(i => i.bucket === 'due_soon').length,
    unknown: items.filter(i => i.bucket === 'unknown').length,
    ok: items.filter(i => i.bucket === 'ok').length,
    total: items.length,
  }), [items]);

  const q = search.toLowerCase().trim();
  const filtered = items.filter(({ asset, bucket: b }) => {
    if (bucket !== 'all' && b !== bucket) return false;
    if (!q) return true;
    return (asset.name || '').toLowerCase().includes(q) || (asset.serial_number || '').toLowerCase().includes(q);
  }).sort((a, b) => {
    // urgent first, then no-date
    const order = { overdue: 0, due_soon: 1, unknown: 2, ok: 3 };
    if (order[a.bucket] !== order[b.bucket]) return order[a.bucket] - order[b.bucket];
    return (a.days ?? 9999) - (b.days ?? 9999);
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncAssetPanda');
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      toast({ title: 'Asset Panda synced', description: res.data?.summary || `${res.data?.pulled || 0} assets pulled.` });
    } catch (e) {
      toast({ title: 'Sync failed', description: e.message, variant: 'destructive' });
    }
    setSyncing(false);
  };

  const handleTestSaved = (assetName, result) => {
    setSessionLog(prev => [...prev, { name: assetName, result, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }]);
  };

  const sessionPassed = sessionLog.filter(s => s.result === 'pass').length;
  const sessionFailed = sessionLog.filter(s => s.result === 'fail').length;

  return (
    <div className="bg-slate-50">
      <Breadcrumbs />
      {/* Hero */}
      <div className="hero-gradient text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => navigate('/rig-hub')} className="p-2 bg-white/15 hover:bg-white/25 rounded-lg transition flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate flex items-center gap-2">
                  <Plug className="w-5 h-5 flex-shrink-0" /> PAT Testing Console
                </h1>
                <p className="text-xs sm:text-sm text-white/70">Portable appliance testing · synced from Asset Panda</p>
              </div>
            </div>
            <button onClick={handleSync} disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition flex-shrink-0 disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing…' : 'Sync Panda'}
            </button>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
            {[
              { key: 'all', label: 'Total', value: counts.total, icon: Plug },
              { key: 'overdue', label: 'Overdue', value: counts.overdue, icon: ShieldX },
              { key: 'due_soon', label: 'Due Soon', value: counts.due_soon, icon: ShieldAlert },
              { key: 'unknown', label: 'No Date', value: counts.unknown, icon: HelpCircle },
              { key: 'ok', label: 'Compliant', value: counts.ok, icon: ShieldCheck },
            ].map(s => {
              const SIcon = s.icon;
              const active = bucket === s.key;
              return (
                <button key={s.key} onClick={() => setBucket(active ? 'all' : s.key)}
                  className={`bg-white/10 backdrop-blur-sm rounded-xl p-2.5 sm:p-3.5 ring-1 ring-white/15 text-left transition ${active ? 'ring-2 ring-white/60' : ''}`}>
                  <SIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 mb-1" />
                  <p className="text-xl sm:text-2xl font-bold tabular-nums leading-none">{s.value}</p>
                  <p className="text-[10px] sm:text-[11px] text-white/70 font-medium mt-1">{s.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Session progress */}
        {sessionLog.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-600" /> This Session</p>
              <button onClick={() => setSessionLog([])} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> {sessionPassed} passed</span>
              <span className="flex items-center gap-1 text-red-600 font-semibold"><XCircle className="w-3.5 h-3.5" /> {sessionFailed} failed</span>
              <span className="text-slate-400">{sessionLog.length} tested</span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or serial number..."
            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 bg-white" />
        </div>

        {/* Queue */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <Plug className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              {patAssets.length === 0
                ? 'No portable appliances found. Sync from Asset Panda or add one in Asset Hub.'
                : 'No items match your filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(({ asset, bucket, days }) => {
              const meta = bucket === 'overdue' ? { Icon: ShieldX, tone: 'text-red-600 bg-red-50 border-red-200' }
                : bucket === 'due_soon' ? { Icon: ShieldAlert, tone: 'text-amber-600 bg-amber-50 border-amber-200' }
                : bucket === 'unknown' ? { Icon: HelpCircle, tone: 'text-slate-500 bg-slate-50 border-slate-200' }
                : { Icon: ShieldCheck, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
              const BIcon = meta.Icon;
              return (
                <div key={asset.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 ${meta.tone}`}>
                    <BIcon className="w-5 h-5" />
                  </div>
                  <button onClick={() => setTestAsset(asset)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{asset.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {asset.equipment_type || asset.compliance_category || 'Portable Appliance'}
                        {asset.serial_number && ` · ${asset.serial_number}`}
                      </p>
                      {days !== null && (
                        <p className={`text-[10px] font-medium ${days < 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`} · {safeFormat(asset.compliance_expiry_date, 'dd MMM yyyy')}
                        </p>
                      )}
                    </div>
                  </button>
                  <button onClick={() => setTestAsset(asset)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg text-xs font-semibold hover:brightness-110 transition flex-shrink-0 shadow-sm">
                    <Zap className="w-3.5 h-3.5" /> Test
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Bluetooth printer note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5">
          <Printer className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            After saving a record, use your KEWPAT / Bluetooth printer to print the physical appliance label as normal — the digital record is now stored here.
          </p>
        </div>
      </div>

      {testAsset && (
        <PATTestForm
          asset={testAsset}
          onClose={() => setTestAsset(null)}
        />
      )}
    </div>
  );
}