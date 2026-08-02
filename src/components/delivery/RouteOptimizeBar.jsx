import React, { useState } from 'react';
import { Route, Loader2, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

/**
 * Route Optimisation trigger button + result banner.
 * Used in both the driver Delivery Dashboard and the admin Logistics Hub.
 *
 * Props:
 * - driverStaffId: string (required)
 * - date: string (yyyy-MM-dd)
 * - count: number — number of active stops (for the badge)
 * - onOptimized?: callback after successful optimisation
 */
export default function RouteOptimizeBar({ driverStaffId, date, count, onOptimized }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState(null);

  if (!driverStaffId || !date || count < 2) return null;

  const handleOptimize = async () => {
    setOptimizing(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('optimizeDailyRoute', {
        driver_staff_id: driverStaffId,
        date
      });
      const data = res.data;
      if (data.error) {
        setResult({ error: data.error });
        toast({ title: 'Route optimisation failed', description: data.error, variant: 'destructive' });
      } else {
        setResult(data);
        toast({
          title: 'Route optimised',
          description: `${data.optimized_count || data.route?.length || 0} stops reordered — ${data.total_duration_minutes}m drive, ${data.total_distance_miles}mi.`
        });
        queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
        queryClient.invalidateQueries({ queryKey: ['admin-all-deliveries'] });
        onOptimized?.(data);
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Optimisation failed';
      setResult({ error: msg });
      toast({ title: 'Route optimisation failed', description: msg, variant: 'destructive' });
    }
    setOptimizing(false);
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleOptimize}
        disabled={optimizing}
        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl font-bold text-sm hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.98] transition touch-manipulation shadow-sm disabled:opacity-60"
      >
        {optimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {optimizing ? 'Optimising route…' : `Optimise Route (${count} stops)`}
      </button>

      {result?.error && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{result.error}</p>
        </div>
      )}

      {result && !result.error && (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <Route className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-800">Recommended route ready</p>
            <p className="text-[11px] text-emerald-600">
              {result.total_duration_minutes}m drive · {result.total_distance_miles}mi total
              {result.route?.length > 0 && ` · finish by ${new Date(result.route[result.route.length - 1].eta).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
          <button onClick={handleOptimize} disabled={optimizing} className="text-emerald-600 hover:text-emerald-800 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}