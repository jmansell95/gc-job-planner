import React from 'react';
import { WifiOff, Clock, MessageCircle } from 'lucide-react';
import { isBeforeSiteOpen, SITE_OPEN_TIME } from '@/utils/siteHours';

// Consolidated single-line alert — replaces the stack of separate banners.
// Shows only the most important alert; if none are relevant, renders nothing.
export default function StaffAlerts({ isOnline, staff }) {
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">Offline — changes sync when reconnected.</span>
      </div>
    );
  }

  if (isBeforeSiteOpen() && !staff?.is_admin) {
    return (
      <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm text-blue-900">
        <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="font-medium">Early access — work actions unlock at {SITE_OPEN_TIME}.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-slate-600">
      <MessageCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <span className="font-medium">Check WhatsApp for daily updates.</span>
    </div>
  );
}