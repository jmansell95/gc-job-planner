import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, HelpCircle, CalendarDays, UserCircle } from 'lucide-react';
import { format } from 'date-fns';
import Logo from '@/components/Logo';

// Compact single-row header — reclaims vertical space for job content.
// Logo + name/date on the left, icon-only nav buttons on the right.
export default function StaffHeader({ staff, onShowSchedule }) {
  const navigate = useNavigate();
  return (
    <div className="hero-gradient">
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
            {staff?.delivery_dashboard_enabled && (
              <button onClick={() => navigate('/deliveries')} type="button" aria-label="Deliveries"
                className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white flex items-center justify-center active:scale-95 transition touch-manipulation">
                <Truck className="w-5 h-5" />
              </button>
            )}
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
          </div>
        </div>
      </div>
    </div>
  );
}