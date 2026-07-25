import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function SyncComplianceButton({ className = '' }) {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncAssetCompliance', {});
      const d = res.data;
      if (d?.error) {
        toast({ title: 'Sync failed', description: d.details || d.error, variant: 'destructive' });
      } else {
        const msg = `${d.equipment_synced || 0} updated${d.equipment_created > 0 ? `, ${d.equipment_created} new` : ''}${d.purged > 0 ? `, ${d.purged} removed` : ''}${d.job_assignments_removed > 0 ? `, ${d.job_assignments_removed} job refs cleaned` : ''}`;
        toast({ title: 'Compliance synced', description: msg });
        queryClient.invalidateQueries({ queryKey: ['site-assets'] });
        queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] });
      }
    } catch (err) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    }
    setSyncing(false);
  };

  return (
    <button onClick={handleSync} disabled={syncing}
      className={`flex items-center gap-2 px-3.5 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg hover:brightness-110 active:scale-95 transition text-sm font-semibold shadow-sm disabled:opacity-60 ${className}`}>
      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Syncing…' : 'Sync Compliance'}
    </button>
  );
}