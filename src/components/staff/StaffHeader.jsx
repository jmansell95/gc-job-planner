import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, HelpCircle, CalendarDays, UserCircle, LogOut, Phone } from 'lucide-react';
import { format } from 'date-fns';
import Logo from '@/components/Logo';
import { base44 } from '@/api/base44Client';
import UsefulNumbersModal from '@/components/UsefulNumbersModal';
import StaffMaintenanceReportModal from '@/components/staff/StaffMaintenanceReportModal';

// Compact single-row header — reclaims vertical space for job content.
// Logo + name/date on the left, icon-only nav buttons on the right.
export default function StaffHeader({ staff, onShowSchedule }) {
  const navigate = useNavigate();
  const [showNumbers, setShowNumbers] = useState(false);
  const [showReport, setShowReport] = useState(false);
  return (
    <div className="hero-gradient" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo height={40} className="flex-shrink-0" />
            <div className="min-w-0 hidden sm:block">
              <p className="text-white font-bold text-sm leading-tight truncate">{staff?.name?.split(' ')[0] || 'Staff'}</p>
              <p className="text-white/60 text-xs">{format(new Date(), 'EEE dd MMM')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(staff?.delivery_dashboard_enabled || staff?.is_admin) && (
              <button onClick={() => navigate('/deliveries')} type="button" aria-label="Deliveries"
                className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white flex items-center justify-center active:scale-95 transition touch-manipulation">
                <Truck className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setShowNumbers(true)} type="button" aria-label="Useful Numbers"
              className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white flex items-center justify-center active:scale-95 transition touch-manipulation">
              <Phone className="w-5 h-5" />
            </button>
            <button onClick={onShowSchedule} type="button" aria-label="Schedule"
              className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white flex items-center justify-center active:scale-95 transition touch-manipulation">
              <CalendarDays className="w-5 h-5" />
            </button>
            <button onClick={() => navigate('/help')} type="button" aria-label="Help"
              className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white flex items-center justify-center active:scale-95 transition touch-manipulation">
              <HelpCircle className="w-5 h-5" />
            </button>
            <button onClick={() => navigate('/staff-profile')} type="button" aria-label="Profile"
              className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white flex items-center justify-center active:scale-95 transition touch-manipulation">
              <UserCircle className="w-5 h-5" />
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