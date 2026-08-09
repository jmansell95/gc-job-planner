import React, { useState } from 'react';
import { LogOut, Phone, WifiOff, Wifi } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import Logo from '@/components/Logo';
import { base44 } from '@/api/base44Client';
import UsefulNumbersModal from '@/components/UsefulNumbersModal';
import StaffMaintenanceReportModal from '@/components/staff/StaffMaintenanceReportModal';

// Modern staff header — glassmorphic gradient bar with greeting, live clock,
// and connection status. Keeps the compact single-row layout but adds polish.
export default function StaffHeader({ staff, onShowSchedule }) {
  const navigate = useNavigate();
  const [showNumbers, setShowNumbers] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  React.useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const firstName = staff?.name?.split(' ')[0] || 'Team';

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3.5 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo height={40} className="flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-slate-900 font-bold text-sm leading-tight truncate">
                {greeting}, {firstName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-slate-500 text-xs">{format(new Date(), 'EEE dd MMM · HH:mm')}</p>
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                  {isOnline ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowNumbers(true)} type="button" aria-label="Useful Numbers"
              className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center active:scale-95 transition touch-manipulation">
              <Phone className="w-5 h-5" />
            </button>
            <button onClick={() => base44.auth.logout('/login')} type="button" aria-label="Logout"
              className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center active:scale-95 transition touch-manipulation">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      <UsefulNumbersModal open={showNumbers} onClose={() => setShowNumbers(false)}
        onLogBooking={() => { setShowNumbers(false); setShowReport(true); }} />
      <StaffMaintenanceReportModal open={showReport} onClose={() => setShowReport(false)} staff={staff} />
    </div>
  );
}