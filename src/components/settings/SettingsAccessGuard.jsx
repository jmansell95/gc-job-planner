import React from 'react';
import { Lock, ShieldOff } from 'lucide-react';

// Shown when a user tries to access a settings page that has been locked down.
// The page content is replaced with this restricted-access screen.
export default function SettingsAccessGuard({ pageLabel, lockedBy, lockedAt }) {
  const lockedDate = lockedAt ? new Date(lockedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16 min-h-[400px]">
      <div className="relative mb-5">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-sm">
          <ShieldOff className="w-9 h-9 text-slate-400" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center shadow-md ring-4 ring-white">
          <Lock className="w-4 h-4 text-white" />
        </div>
      </div>
      <h3 className="text-lg font-bold text-slate-700">{pageLabel ? `${pageLabel} is Locked` : 'This Page is Locked'}</h3>
      <p className="text-sm text-slate-400 mt-1.5 max-w-sm">
        Access to this settings page has been restricted by an administrator. You don't have permission to view or edit it.
      </p>
      {lockedBy && (
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Locked by {lockedBy}{lockedDate ? ` · ${lockedDate}` : ''}</span>
        </div>
      )}
    </div>
  );
}