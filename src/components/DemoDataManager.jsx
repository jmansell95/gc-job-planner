import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Database, Trash2, Sparkles, AlertTriangle, Loader2, CheckCircle2, Info } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function DemoDataManager() {
  const [resetting, setResetting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleReset = async () => {
    setResetting(true);
    setLastResult(null);
    try {
      const res = await base44.functions.invoke('resetDatabase', {});
      const d = res.data;
      if (d.error) {
        toast({ title: 'Reset failed', description: d.error, variant: 'destructive' });
      } else {
        toast({ title: 'Database wiped', description: 'All operational data removed. Configurations preserved.' });
        setLastResult({ type: 'reset', data: d });
        queryClient.invalidateQueries();
      }
    } catch (err) {
      toast({ title: 'Reset failed', description: err.message, variant: 'destructive' });
    }
    setResetting(false);
  };

  const handleSeed = async () => {
    setSeeding(true);
    setLastResult(null);
    try {
      const res = await base44.functions.invoke('seedDemoData', {});
      const d = res.data;
      if (d.error) {
        toast({ title: 'Seeding failed', description: d.error, variant: 'destructive' });
      } else {
        toast({ title: 'Demo data seeded', description: `${d.counts.jobs} jobs, ${d.counts.staff} staff, ${d.counts.site_assets} assets created.` });
        setLastResult({ type: 'seed', data: d });
        queryClient.invalidateQueries();
      }
    } catch (err) {
      toast({ title: 'Seeding failed', description: err.message, variant: 'destructive' });
    }
    setSeeding(false);
  };

  const isBusy = resetting || seeding;

  return (
    <div>
      <SettingsSectionHeader
        icon={Database}
        title="Demo Data Manager"
        description="Populate the system with realistic showcase data, or wipe everything for a clean slate"
      />

      {/* Info banner */}
      <div className="insight-card rounded-xl p-4 mb-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Info className="w-5 h-5 text-blue-600" />
        </div>
        <div className="text-sm text-slate-600 pt-1">
          <p className="font-semibold text-slate-800 mb-1">Showcase Mode</p>
          <p>Seed a full, realistic dataset — clients, jobs, crews, assets, timesheets, costs, invoices, safety reports & more — to demonstrate the system to managers. All demo assets are tagged so sync integrations (Asset Panda, GC Compliance, KeyLogBook, SafetyCulture) remain active and are never affected.</p>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Seed Demo Data */}
        <div className="insight-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Seed Demo Data</h3>
              <p className="text-xs text-slate-500">Populate everything for a showcase</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Creates 4 clients, 7 jobs, 12 staff, 13 assets, 4 weeks of timesheets, invoices, investigation logs, safety reports & more — all with realistic numbers and budgets.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={isBusy}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-lg hover:brightness-110 active:scale-95 transition text-sm font-semibold shadow-sm disabled:opacity-50"
              >
                {seeding ? <><Loader2 className="w-4 h-4 animate-spin" /> Seeding…</> : <><Sparkles className="w-4 h-4" /> Seed Demo Data</>}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Seed demo data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create a full set of demo records (clients, jobs, staff, assets, timesheets, invoices, etc.) across the system. Existing data will remain alongside the new demo data. Sync integrations will not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSeed} className="bg-emerald-600 hover:bg-emerald-700">
                  Yes, seed data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Wipe All Data */}
        <div className="insight-card rounded-xl p-5 border-l-4 border-l-red-400">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-md">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Wipe All Data</h3>
              <p className="text-xs text-slate-500">Remove everything for a clean slate</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Deletes all jobs, staff, assets, timesheets, invoices, logs & more. <strong>Configurations, sync settings, and user accounts are preserved.</strong> This cannot be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={isBusy}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-95 transition text-sm font-semibold shadow-sm disabled:opacity-50"
              >
                {resetting ? <><Loader2 className="w-4 h-4 animate-spin" /> Wiping…</> : <><Trash2 className="w-4 h-4" /> Wipe All Data</>}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Wipe all operational data?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes all jobs, staff, assets, timesheets, invoices, investigation logs, safety reports and more. Configurations, sync settings, and user accounts are preserved. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} className="bg-red-600 hover:bg-red-700">
                  Yes, wipe everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* What gets seeded */}
      <div className="insight-card rounded-xl p-5 mb-4">
        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          What gets seeded
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-600">
          {[
            '4 Clients (Arup, Mott MacDonald, WSP, Stantec)',
            '3 Projects with linked jobs',
            '7 Jobs (active, completed, planning, decommissioning)',
            '6 Teams (CP, Rotary, Groundworks, Enabling)',
            '12 Staff (drillers, groundworkers, managers)',
            '13 Site Assets (rigs, lifting, machinery, trailers)',
            '22 Job Cost Items (labour, equipment, materials)',
            '9 Asset Assignments to jobs',
            '15 Rota Assignments across 2 weeks',
            '~40 Timesheets across 4 weeks (approved & submitted)',
            '15 Investigation Logs (borehole, sampling, pits)',
            '3 Safety Reports with action items',
            '3 Invoices (paid, sent, draft)',
            '10 Job Milestones',
            '5 Job Comments',
            '2 Hotel Bookings',
            '4 Delivery Logs',
            '2 Job Delay Logs',
            '7 Billing Rules',
            '8 Rate Card Items',
            '3 Suppliers & 3 Contractors',
            '5 Vehicles',
            'Varied compliance statuses (compliant, expiring, expired)',
            'Realistic budgets, costs & revenue figures',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-emerald-500 mt-0.5">✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sync protection info */}
      <div className="insight-card rounded-xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        <p className="text-sm text-slate-600 pt-1">
          <strong>Sync integrations are protected.</strong> Demo SiteAssets are tagged <code className="text-xs bg-slate-100 px-1 rounded">is_demo_data: true</code> so the Asset Panda and GC Compliance sync functions skip them entirely. Your live sync configurations are never modified.
        </p>
      </div>

      {/* Last result */}
      {lastResult && (
        <div className="insight-card rounded-xl p-4 mt-4">
          <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {lastResult.type === 'reset' ? 'Wipe complete' : 'Seed complete'}
          </h3>
          {lastResult.type === 'reset' ? (
            <p className="text-sm text-slate-600">{lastResult.data.message}</p>
          ) : (
            <div className="text-sm text-slate-600">
              <p className="mb-2">{lastResult.data.message}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {Object.entries(lastResult.data.counts).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 rounded-lg px-2 py-1.5 flex justify-between">
                    <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-semibold text-slate-700">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}