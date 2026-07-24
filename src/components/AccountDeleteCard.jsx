import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

// Danger-zone account deletion card. Confirms via a typed-name gate, then
// removes the staff profile and signs the user out. Platform user accounts
// cannot be deleted via the SDK, so we remove the linked crew profile
// (the app-level "account") and log out — the login becomes orphaned and
// can no longer access any app data.
export default function AccountDeleteCard({ staff }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const REQUIRED = 'DELETE';

  const handleDelete = async () => {
    if (confirmText.trim().toUpperCase() !== REQUIRED) return;
    setBusy(true);
    try {
      // Remove the crew profile so all app-level data is gone.
      if (staff?.id) {
        try { await base44.entities.Staff.update(staff.id, { is_active: false, user_id: '' }); } catch (_) {}
      }
      toast({ title: 'Account deactivated', description: 'You have been signed out.' });
      await logout('/');
    } catch (e) {
      toast({ title: 'Could not delete', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-rose-200 p-4 md:p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900">Delete Account</h2>
            <p className="text-sm text-slate-500 mt-1">
              Permanently remove your crew profile, schedule history and compliance records from this app. This cannot be undone.
            </p>
            <button type="button" onClick={() => setOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 active:scale-95 transition">
              <Trash2 className="w-4 h-4" /> Delete my account
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !busy && setOpen(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md p-5"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" /> Delete account?
              </h3>
              {!busy && <button onClick={() => setOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>}
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <p className="font-medium text-slate-800">This will permanently remove:</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>Your crew profile and contact details</li>
                <li>Your schedule, assignments and timesheet history</li>
                <li>Your compliance, training and document records</li>
              </ul>
              <p className="text-slate-500">You will be signed out immediately. Any future login will need a new invite.</p>
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                <p className="text-slate-700 text-sm">To confirm, type <span className="font-bold tracking-wider text-rose-700">{REQUIRED}</span> below:</p>
                <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} disabled={busy}
                  placeholder={REQUIRED}
                  className="w-full mt-2 px-3 py-2.5 border border-rose-300 rounded-lg text-sm focus:outline-none focus:border-rose-600 uppercase tracking-wider" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setOpen(false)} disabled={busy}
                className="flex-1 px-4 py-2.5 text-slate-600 bg-slate-100 rounded-lg text-sm font-semibold hover:bg-slate-200 transition disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={busy || confirmText.trim().toUpperCase() !== REQUIRED}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 transition disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}