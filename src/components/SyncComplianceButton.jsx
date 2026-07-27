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
        const msg = `${d.equipment_synced || 0} updated${d.equipment_created > 0 ? `, ${d.equipment_created} new` : ''}${d.rigs_synced || 0 ? `, ${d.rigs_synced} rigs` : ''}${d.rigs_created > 0 ? `, ${d.rigs_created} new rigs` : ''}${d.certificates_rehosted > 0 ? ` · ${d.certificates_rehosted} certificates pulled locally` : ''}. Records are kept permanently — safe to delete the old app now.`;
        toast({ title: 'Imported from GC', description: msg });
        queryClient.invalidateQueries({ queryKey: ['site-assets'] });
        queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] });
      }
    } catch (err) {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    }
    setSyncing(false);
  };

  return (
    <button id="sync-compliance-btn" onClick={handleSync} disabled={syncing}
      className={`flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 active:scale-95 transition text-sm font-semibold shadow-sm disabled:opacity-60 ${className}`}>
      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Importing…' : 'Import from GC'}
    </button>
  );
}