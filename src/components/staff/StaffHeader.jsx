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
    <div className="hero-vibrant relative overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Decorative leaf accent */}
      <div className="absolute -top-12 -right-8 w-40 h-40 rounded-full bg-[#8DC63F]/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-10 w-32 h-32 rounded-full bg-[#8DC63F]/8 blur-2xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-3.5 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo height={40} className="flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">
                {greeting}, {firstName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-white/60 text-xs">{format(new Date(), 'EEE dd MMM · HH:mm')}</p>
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isOnline ? 'bg-emerald-400/20 text-emerald-100' : 'bg-amber-400/20 text-amber-100'}`}>
                  {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                  {isOnline ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowNumbers(true)} type="button" aria-label="Useful Numbers"
              className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white flex items-center justify-center active:scale-95 transition touch-manipulation">
              <Phone className="w-5 h-5" />
            </button>
            <button onClick={() => base44.auth.logout('/login')} type="button" aria-label="Logout"
              className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white flex items-center justify-center active:scale-95 transition touch-manipulation">
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