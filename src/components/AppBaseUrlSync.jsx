import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CANONICAL_APP_BASE_URL } from '@/utils/appBaseUrl';

// Keeps a single shared record of the app's public base URL so backend
// email functions can build "View your schedule" / "Open planner" links.
// Always writes the canonical production domain (not window.location.origin)
// so webhook URLs stay stable across preview/published environments.
export default function AppBaseUrlSync() {
  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.AppSetting.filter({ key: 'global' });
        const existing = list[0];
        if (existing && existing.app_base_url === CANONICAL_APP_BASE_URL) return;
        if (existing) {
          await base44.entities.AppSetting.update(existing.id, { app_base_url: CANONICAL_APP_BASE_URL });
        } else {
          await base44.entities.AppSetting.create({ key: 'global', app_base_url: CANONICAL_APP_BASE_URL });
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);
  return null;
}