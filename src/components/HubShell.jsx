import React from 'react';
import PageHeader from '@/components/PageHeader';
import TabBar from '@/components/TabBar';

/**
 * HubShell — shared hybrid layout for every enterprise hub.
 *
 * Standardises the "hybrid" structure across all hubs:
 *   1. PageHeader (icon + title + subtitle + optional actions)
 *   2. Dense KPI strip (passed as `kpiStrip` — usually a <HubStatsBar />)
 *   3. Optional TabBar (when `tabs` is provided)
 *   4. Clean card-grid body (children)
 *
 * Mobile-first density in the KPI strip, breathable card grid on desktop.
 * No new colour tokens — reuses the existing Ground Control palette.
 */
export default function HubShell({
  icon,
  title,
  subtitle,
  actions,
  kpiStrip,
  tabs,
  activeTab,
  onTabChange,
  children,
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader icon={icon} title={title} subtitle={subtitle} actions={actions} />

      {kpiStrip ? (
        <div className="animate-slide-up">{kpiStrip}</div>
      ) : null}

      {tabs && tabs.length > 0 ? (
        <TabBar tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
      ) : null}

      <div className="space-y-3 sm:space-y-4">{children}</div>
    </div>
  );
}