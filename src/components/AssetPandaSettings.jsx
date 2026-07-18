import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import AssetPandaCredentials from '@/components/assetpanda/AssetPandaCredentials';
import AssetPandaSyncStatus from '@/components/assetpanda/AssetPandaSyncStatus';

export default function AssetPandaSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    api_token: '', email: '', password: '', base_url: 'https://api.assetpanda.com', group_id: '',
    field_name: '', field_serial: '', field_daily_rate: '', field_stock_status: '', field_asset_type: '',
    auto_deactivate: true,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['asset-panda-config'],
    queryFn: () => base44.entities.AssetPandaConfig.filter({ key: 'global' }),
  });
  const config = configs[0];

  useEffect(() => {
    if (config) {
      setForm({
        api_token: config.api_token || '',
        email: config.email || '',
        password: config.password || '',
        base_url: config.base_url || 'https://api.assetpanda.com',
        group_id: config.group_id || '',
        field_name: config.field_name || '',
        field_serial: config.field_serial || '',
        field_daily_rate: config.field_daily_rate || '',
        field_stock_status: config.field_stock_status || '',
        field_asset_type: config.field_asset_type || '',
        auto_deactivate: config.auto_deactivate !== false,
      });
    }
  }, [config]);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets-panda'],
    queryFn: () => base44.entities.SiteAsset.list(),
  });

  const lastSync = config?.last_sync_at || assets
    .map(a => a.last_sync_timestamp)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { key: 'global', ...form };
      if (config?.id) {
        await base44.entities.AssetPandaConfig.update(config.id, payload);
      } else {
        await base44.entities.AssetPandaConfig.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['asset-panda-config'] });
      toast({ title: 'Settings saved', description: 'Your Asset Panda credentials have been stored.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Could not save', description: err.message || 'Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncAssetPanda', {});
      const data = res?.data || res;
      queryClient.invalidateQueries({ queryKey: ['site-assets-panda'] });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-panda-config'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-catalogue'] });
      toast({
        title: data?.success ? `Synced — ${data.created || 0} new, ${data.synced || 0} updated` : 'Sync complete',
        description: data?.summary || data?.error || 'Inventory refreshed from Asset Panda.',
        variant: data?.success ? 'default' : 'destructive',
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Sync failed',
        description: err?.response?.data?.error || err.message || 'Check your credentials and group ID, then try again.',
        variant: 'destructive',
      });
    }
    setSyncing(false);
  };

  const ready = !!(form.group_id && (form.api_token || (form.email && form.password)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Asset Panda Sync</h2>
            <p className="text-sm text-slate-500">Live inventory, stock levels & billing rates from Asset Panda</p>
          </div>
        </div>
        <button onClick={handleSync} disabled={syncing || isLoading || !ready}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-semibold disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      <AssetPandaCredentials form={form} setForm={setForm} config={config} onSave={handleSave} saving={saving} />
      <AssetPandaSyncStatus assets={assets} config={config} isLoading={isLoading} lastSync={lastSync} />
    </div>
  );
}