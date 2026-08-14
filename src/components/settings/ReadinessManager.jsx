import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useReadiness, STATE_ACTIVE, STATE_COMING_SOON, STATE_LOCKED } from '@/hooks/useReadiness';
import { FEATURE_REGISTRY, HUB_ORDER, INTEGRATIONS, getFeaturesForHub } from '@/utils/featureRegistry';
import { Clock, Lock, CheckCircle2, Search, ChevronDown, ChevronRight, RefreshCw, Loader2, Zap } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const STATE_CONFIG = {
  [STATE_ACTIVE]: { label: 'Active', icon: CheckCircle2, color: 'emerald', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  [STATE_COMING_SOON]: { label: 'Coming Soon', icon: Clock, color: 'amber', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  [STATE_LOCKED]: { label: 'Locked', icon: Lock, color: 'slate', badge: 'bg-slate-200 text-slate-600', dot: 'bg-slate-500' },
};

export default function ReadinessManager() {
  const { toast } = useToast();
  const { states, setState, setAll, isLoading } = useReadiness();
  const [expandedHub, setExpandedHub] = useState(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(null);

  // Integration connection status — checks if each integration's config entity has credentials
  const { data: integrationStatus = {} } = useQuery({
    queryKey: ['readiness-integration-status'],
    queryFn: async () => {
      const status = {};
      // SafetyCulture
      try {
        const sc = await base44.entities.SafetyCultureConfig.filter({ key: 'global' });
        status.safetyculture = !!(sc?.[0]?.enabled && sc?.[0]?.webhook_secret);
      } catch { status.safetyculture = false; }
      // KeyLogBook
      try {
        const kl = await base44.entities.KeyLogBookConfig.filter({ key: 'global' });
        status.keylogbook = !!(kl?.[0]?.enabled && kl?.[0]?.webhook_url);
      } catch { status.keylogbook = false; }
      // Asset Panda
      try {
        const ap = await base44.entities.AssetPandaConfig.filter({ key: 'global' });
        status.assetpanda = !!(ap?.[0]?.enabled && ap?.[0]?.api_key);
      } catch { status.assetpanda = false; }
      // Others — check AppSetting for config keys
      try {
        const settings = await base44.entities.AppSetting.filter({ key: { $in: ['geotab_config', 'holman_config', 'bob_config', 'concur_config', 'openground_config', 'cis_config', 'metoffice_config', 'google_maps_config', 'whatsapp_config', 'accounting_config', 'stripe_config', 'm365_config', 'zapier_config', 'push_config'] } });
        const map = {};
        settings.forEach(s => { map[s.key] = s.value; });
        status.geotab = !!(map.geotab_config?.api_key);
        status.holman = !!(map.holman_config?.api_key);
        status.bobhr = !!(map.bob_config?.api_token);
        status.concur = !!(map.concur_config?.client_id);
        status.openground = !!(map.openground_config?.client_id);
        status.cis = !!(map.cis_config?.api_key);
        status.metoffice = !!(map.metoffice_config?.api_key);
        status.googlemaps = !!(map.google_maps_config?.api_key);
        status.whatsapp = !!(map.whatsapp_config?.api_key);
        status.accounting = !!(map.accounting_config?.api_key);
        status.stripe = !!(map.stripe_config?.secret_key);
        status.m365 = !!(map.m365_config?.client_id);
        status.zapier = !!(map.zapier_config?.enabled);
        status.push = !!(map.push_config?.enabled);
      } catch {}
      return status;
    },
  });

  const handleSetState = async (featureId, newState) => {
    setSaving(featureId);
    try {
      await setState(featureId, newState);
      toast({ title: `${FEATURE_REGISTRY[featureId]?.label} set to ${STATE_CONFIG[newState].label}`, duration: 1500 });
    } catch (e) {
      toast({ title: 'Failed to update', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleBulkSetHub = async (hubId, newState) => {
    setSaving(`hub-${hubId}`);
    const featureIds = [hubId, ...getFeaturesForHub(hubId).map(f => f.id)];
    const newStates = { ...states };
    featureIds.forEach(id => { newStates[id] = newState; });
    try {
      await setAll(newStates);
      toast({ title: `${FEATURE_REGISTRY[hubId]?.label} — all sections set to ${STATE_CONFIG[newState].label}`, duration: 1500 });
    } catch (e) {
      toast({ title: 'Failed to update', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  // Auto-flag: set integration-dependent features to coming_soon if integration is not connected
  const handleAutoDetect = async () => {
    setSaving('auto-detect');
    const newStates = { ...states };
    let changed = 0;
    for (const [id, feature] of Object.entries(FEATURE_REGISTRY)) {
      if (feature.type === 'feature' && feature.dependsOn) {
        const connected = integrationStatus[feature.dependsOn];
        if (!connected && newStates[id] === STATE_ACTIVE) {
          newStates[id] = STATE_COMING_SOON;
          changed++;
        }
      }
    }
    try {
      await setAll(newStates);
      toast({ title: `Auto-detect complete — ${changed} feature(s) flagged as Coming Soon`, duration: 2000 });
    } catch (e) {
      toast({ title: 'Failed to auto-detect', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const filteredHubs = useMemo(() => {
    if (!search.trim()) return HUB_ORDER;
    const q = search.toLowerCase();
    return HUB_ORDER.filter(hubId => {
      if (FEATURE_REGISTRY[hubId]?.label.toLowerCase().includes(q)) return true;
      return getFeaturesForHub(hubId).some(f => f.label.toLowerCase().includes(q));
    });
  }, [search]);

  return (
    <div>
      <SettingsSectionHeader
        icon={Zap}
        title="Readiness Manager"
        description="Control which hubs, tabs, and integration-dependent features are visible across the platform. Toggle sections between Active, Coming Soon, and Locked."
        actions={
          <>
            <button
              onClick={handleAutoDetect}
              disabled={saving === 'auto-detect' || isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
            >
              {saving === 'auto-detect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Auto-Detect
            </button>
          </>
        }
      />

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hubs or features..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
        />
      </div>

      {/* Hub rows */}
      <div className="space-y-2.5">
        {filteredHubs.map(hubId => {
          const hub = FEATURE_REGISTRY[hubId];
          const features = getFeaturesForHub(hubId);
          const hubState = states[hubId];
          const isExpanded = expandedHub === hubId;
          const HubIcon = hub.icon;
          const hasFeatures = features.length > 0;

          return (
            <div key={hubId} className="insight-card rounded-2xl overflow-hidden">
              {/* Hub header row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => hasFeatures && setExpandedHub(isExpanded ? null : hubId)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  {hasFeatures ? (
                    isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <div className="w-4 flex-shrink-0" />
                  )}
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <HubIcon className="w-4.5 h-4.5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{hub.label}</p>
                    <p className="text-xs text-slate-500">
                      {hasFeatures ? `${features.length} feature${features.length !== 1 ? 's' : ''}` : 'Top-level hub'}
                    </p>
                  </div>
                </button>

                {/* State toggle pills */}
                <StateToggle
                  currentState={hubState}
                  saving={saving === `hub-${hubId}`}
                  onChange={(s) => s === hubState ? handleBulkSetHub(hubId, s) : handleSetState(hubId, s)}
                />
              </div>

              {/* Expanded features */}
              {isExpanded && hasFeatures && (
                <div className="border-t border-slate-100 bg-slate-50/50">
                  {features.map(feat => {
                    const featState = states[feat.id];
                    const integration = feat.dependsOn ? INTEGRATIONS[feat.dependsOn] : null;
                    const connected = feat.dependsOn ? integrationStatus[feat.dependsOn] : null;
                    const FeatIcon = feat.icon;
                    return (
                      <div key={feat.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0">
                        <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0 border border-slate-200">
                          <FeatIcon className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800 truncate">{feat.label}</p>
                            {feat.dependsOn && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {connected ? 'Connected' : 'Not connected'}
                              </span>
                            )}
                          </div>
                          {integration && (
                            <p className="text-[11px] text-slate-400 mt-0.5">Depends on {integration.label}</p>
                          )}
                        </div>
                        <StateToggle
                          currentState={featState}
                          saving={saving === feat.id}
                          onChange={(s) => handleSetState(feat.id, s)}
                          compact
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Active — fully visible and functional</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Coming Soon — greyed out with a banner</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500" /> Locked — hidden from all users</span>
      </div>
    </div>
  );
}

// Compact 3-state toggle pill switch
function StateToggle({ currentState, onChange, saving, compact }) {
  const states = [STATE_ACTIVE, STATE_COMING_SOON, STATE_LOCKED];
  return (
    <div className={`flex items-center gap-1 ${compact ? 'scale-90' : ''}`}>
      {states.map(s => {
        const cfg = STATE_CONFIG[s];
        const Icon = cfg.icon;
        const isActive = currentState === s;
        return (
          <button
            key={s}
            onClick={() => !saving && onChange(s)}
            disabled={saving}
            title={cfg.label}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
              isActive
                ? `${cfg.badge} ring-1 ring-current/20`
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-3 h-3" />
            {!compact && cfg.label}
          </button>
        );
      })}
    </div>
  );
}