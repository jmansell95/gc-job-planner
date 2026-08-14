import React from 'react';
import ReadinessGate from '@/components/ReadinessGate';

/**
 * HubReadinessGate — wraps a standalone hub page (Staff, Compliance, Billing,
 * Assets, Fleet) with a ReadinessGate. The "Configure" button navigates to the
 * Admin Dashboard's Settings → Readiness Manager tab via the app-navigate event.
 */
export default function HubReadinessGate({ featureId, children }) {
  const goToSettings = () => {
    window.dispatchEvent(new CustomEvent('app-navigate', { detail: { section: 'settings', settingsTab: 'readiness' } }));
  };
  return (
    <ReadinessGate featureId={featureId} onConfigure={goToSettings}>
      {children}
    </ReadinessGate>
  );
}