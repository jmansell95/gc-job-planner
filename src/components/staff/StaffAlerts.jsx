import React from 'react';
import { WifiOff, Clock, MessageCircle } from 'lucide-react';
import { isBeforeSiteOpen, SITE_OPEN_TIME } from '@/utils/siteHours';

// Consolidated single-line alert — replaces the stack of separate banners.
// Shows only the most important alert; if none are relevant, renders nothing.
export default function StaffAlerts({ isOnline, staff }) {
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2.5 bg-gradient-to-r from-amber-50 to-amber-100/40 border border-amber-200/60 rounded-2xl px-4 py-3 text-sm text-amber-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200/50 flex items-center justify-center flex-shrink-0">
          <WifiOff className="w-4 h-4 text-amber-600" strokeWidth={2.5} />
        </div>
        <span className="font-medium">Offline — changes sync when reconnected.</span>
      </div>
    );
  }

  if (isBeforeSiteOpen() && !staff?.is_admin) {
    return (
      <div className="flex items-center gap-2.5 bg-gradient-to-r from-blue-50 to-blue-100/40 border border-blue-200/60 rounded-2xl px-4 py-3 text-sm text-blue-900">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200/50 flex items-center justify-center flex-shrink-0">
          <Clock className="w-4 h-4 text-blue-600" strokeWidth={2.5} />
        </div>
        <span className="font-medium">Early access — work actions unlock at {SITE_OPEN_TIME}.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 bg-gradient-to-r from-slate-50 to-slate-100/40 border border-slate-200/60 rounded-2xl px-4 py-3 text-sm text-slate-600">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200/50 flex items-center justify-center flex-shrink-0">
        <MessageCircle className="w-4 h-4 text-slate-400" strokeWidth={2.5} />
      </div>
      <span className="font-medium">Check WhatsApp for daily updates.</span>
    </div>
  );
}