import React, { useState, useEffect } from 'react';
import { Phone, LogOut, Wifi, WifiOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import UsefulNumbersModal from '@/components/UsefulNumbersModal';
import StaffMaintenanceReportModal from '@/components/staff/StaffMaintenanceReportModal';

/**
 * StaffHeaderActions — shared action buttons for field pages.
 * Shows online/offline status, useful numbers, and logout.
 * Preserves the UsefulNumbers + Maintenance Report modal flow.
 */
export default function StaffHeaderActions({ staff }) {
  const [showNumbers, setShowNumbers] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <>
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
        {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        {isOnline ? 'Live' : 'Offline'}
      </span>
      <button onClick={() => setShowNumbers(true)} type="button" aria-label="Useful Numbers"
        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition active:scale-95 touch-manipulation">
        <Phone className="w-4 h-4 text-slate-600" />
      </button>
      <button onClick={() => base44.auth.logout('/login')} type="button" aria-label="Logout"
        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition active:scale-95 touch-manipulation">
        <LogOut className="w-4 h-4 text-slate-600" />
      </button>

      <UsefulNumbersModal open={showNumbers} onClose={() => setShowNumbers(false)}
        onLogBooking={() => { setShowNumbers(false); setShowReport(true); }} />
      <StaffMaintenanceReportModal open={showReport} onClose={() => setShowReport(false)} staff={staff} />
    </>
  );
}