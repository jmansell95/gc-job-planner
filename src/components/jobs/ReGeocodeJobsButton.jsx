import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Loader2, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * ReGeocodeJobsButton — admin-only one-time action.
 * Re-runs accurate postcode geocoding for every job with a location, fixing
 * job maps that currently share duplicate / imprecise AI-geocoded coordinates.
 */
export default function ReGeocodeJobsButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRun = async () => {
    if (!confirm('Re-geocode every project map using accurate UK postcode lookup? This updates site coordinates in the background.')) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('reGeocodeAllJobs', {});
      const data = res.data;
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Maps re-geocoded',
        description: `${data.updated} updated · ${data.skipped} already accurate · ${data.failed} unresolved`,
      });
    } catch (e) {
      toast({ title: 'Re-geocode failed', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <button
      onClick={handleRun}
      disabled={running}
      className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition text-sm font-semibold shadow-sm disabled:opacity-60"
      title="Re-geocode every project map with accurate UK postcode lookup"
    >
      {running ? <Loader2 className="w-4 h-4 animate-spin" /> : (result ? <Check className="w-4 h-4" /> : <MapPin className="w-4 h-4" />)}
      {running ? 'Geocoding…' : 'Re-geocode Maps'}
    </button>
  );
}