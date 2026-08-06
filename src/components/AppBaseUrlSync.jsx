import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Keeps a single shared record of the app's public base URL so backend
// email functions can build "View your schedule" / "Open planner" links.
export default function AppBaseUrlSync() {
  useEffect(() => {
    let origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (!origin) return;
    // Normalise legacy subdomain to the rebranded GC Mission Control slug
    origin = origin.replace(/gc-job-planner/gi, 'gc-mission-control');
    (async () => {
      try {
        const list = await base44.entities.AppSetting.filter({ key: 'global' });
        const existing = list[0];
        if (existing && existing.app_base_url === origin) return;
        if (existing) {
          await base44.entities.AppSetting.update(existing.id, { app_base_url: origin });
        } else {
          await base44.entities.AppSetting.create({ key: 'global', app_base_url: origin });
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);
  return null;
}