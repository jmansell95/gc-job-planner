import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Briefcase, Calendar, CalendarDays, Grid3x3, LogOut, Menu, X, Settings, Clock, Bell } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { differenceInDays } from 'date-fns';
import NotificationCenter from '@/components/NotificationCenter';

export default function AdminNav({ activeSection, setActiveSection }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['absences'], queryFn: () => base44.entities.Absence.list() });

  const today = new Date();
  const vehicleAlerts = vehicles.filter(v => {
    const check = (d) => d && differenceInDays(new Date(d + 'T00:00:00'), today) <= 30;
    return check(v.mot_expiry) || check(v.service_due_date);
  }).length;
  const notifCount = vehicleAlerts + timesheets.filter(t => t.status === 'submitted').length + absences.filter(a => a.status === 'pending').length;

  const handleLogout = async () => {
    await base44.auth.logout('/');
  };

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: Grid3x3 },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'rota', label: 'Weekly Rota', icon: Calendar },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'timesheets', label: 'Timesheets', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id) => {
    setActiveSection(id);
    setIsOpen(false);
  };

  const renderNavContent = () => (
    <>
      <div className="p-6 border-b border-emerald-800/50">
        <h1 className="text-xl font-bold text-white">GC Job Planner</h1>
        <p className="text-xs text-emerald-300 mt-1">Admin Panel</p>
      </div>
      <div className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-medium transition cursor-pointer touch-manipulation select-none ${
                isActive
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white active:bg-emerald-800/50'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="p-4 border-t border-emerald-800/50">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-medium text-emerald-300 hover:bg-emerald-800/50 hover:text-white transition cursor-pointer touch-manipulation select-none"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-[70] bg-emerald-900 border-b border-emerald-800 shadow-lg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-14 flex items-center justify-between gap-2 px-3 sm:px-4">
          <button onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu" type="button"
            className="flex items-center gap-2 h-14 px-4 -ml-1 text-white hover:bg-emerald-800/70 active:bg-emerald-700 active:scale-95 rounded-lg transition min-w-[56px] cursor-pointer touch-manipulation select-none">
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            <span className="text-sm font-semibold">Menu</span>
          </button>
          <span className="text-white font-bold text-sm truncate flex-1 text-center">GC Job Planner</span>
          <button onClick={() => setNotifOpen(true)} aria-label="Notifications" type="button"
            className="relative h-14 w-14 text-white hover:bg-emerald-800/70 active:bg-emerald-700 active:scale-95 rounded-lg transition flex items-center justify-center cursor-pointer touch-manipulation select-none">
            <Bell className="w-5 h-5" />
            {notifCount > 0 && <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-amber-400 text-emerald-950 text-[10px] font-bold rounded-full flex items-center justify-center">{notifCount > 9 ? '9+' : notifCount}</span>}
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <nav className="hidden lg:flex sticky top-0 h-screen w-64 bg-gradient-to-b from-emerald-950 to-emerald-900 border-r border-emerald-800/50 flex-col">
        {renderNavContent()}
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/50 z-50"
          />
        )}
        {isOpen && (
          <motion.nav
            key="drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="lg:hidden fixed top-0 left-0 h-screen w-64 z-[60] overflow-y-auto bg-gradient-to-b from-emerald-950 to-emerald-900 border-r border-emerald-800/50 flex flex-col"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            {renderNavContent()}
          </motion.nav>
        )}
      </AnimatePresence>

      <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={setActiveSection} />
    </>
  );
}