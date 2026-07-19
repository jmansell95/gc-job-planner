import React, { useState, useEffect } from 'react';
import { Briefcase, Calendar, CalendarDays, Grid3x3, LogOut, Settings, Clock, Bell, HardHat, Sparkles, ShieldCheck, Menu, CalendarClock, HelpCircle, FlaskConical, Receipt } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NotificationCenter from '@/components/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { useStaffAssistant } from '@/components/StaffAssistantChat';
import { useSchedulingAssistant } from '@/components/SchedulingAssistantChat';
import { useNavigate } from 'react-router-dom';
import MobileNavDrawer from '@/components/MobileNavDrawer';
import GlobalSearch from '@/components/GlobalSearch';
import { canAccessSection } from '@/utils/access';

export default function AdminNav({ activeSection, setActiveSection }) {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const notifications = useNotifications();
  const notifCount = notifications.count;
  const { openChat } = useStaffAssistant();
  const { openChat: openSchedulingChat } = useSchedulingAssistant();

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    if (!notifOpen && !drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [notifOpen, drawerOpen]);

  const handleLogout = async () => {
    await base44.auth.logout('/');
  };

  const allNavItems = [
    { id: 'overview', label: 'Dashboard', icon: Grid3x3 },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'rota', label: 'Rotas', icon: Calendar },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'timesheets', label: 'Timesheets', icon: Clock },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
    { id: 'log-qc', label: 'Log QC', icon: FlaskConical },
    { id: 'billing', label: 'Billing', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const navItems = allNavItems.filter(item => canAccessSection(profile, item.id));
  const canViewSchedule = canAccessSection(profile, 'staff_schedule');

  const desktopNav = (
    <>
      <div className="p-6 border-b border-emerald-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-sm ring-1 ring-white/20 flex-shrink-0">
            <HardHat className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white leading-tight">GC Job Planner</h1>
            <p className="text-xs text-emerald-300">Admin Panel</p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 space-y-2">
        <GlobalSearch />
        <button onClick={openChat} type="button"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-medium hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none shadow-sm">
          <Sparkles className="w-4 h-4" />
          Ask Assistant
        </button>
        <button onClick={openSchedulingChat} type="button"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-800/60 text-emerald-200 text-sm font-medium hover:bg-emerald-800 hover:text-white active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-emerald-700/50">
          <CalendarClock className="w-4 h-4" />
          Schedule Assistant
        </button>
        {canViewSchedule && (
          <button onClick={() => navigate('/staff-schedule')} type="button"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-800/60 text-emerald-200 text-sm font-medium hover:bg-emerald-800 hover:text-white active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-emerald-700/50">
            <CalendarDays className="w-4 h-4" />
            My Schedule
          </button>
        )}
        <button onClick={() => setNotifOpen(true)} type="button"
          className="relative w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-800/60 text-emerald-200 text-sm font-medium hover:bg-emerald-800 hover:text-white active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-emerald-700/50">
          <Bell className="w-4 h-4" />
          Notifications
          {notifCount > 0 && (
            <span className="absolute top-1 right-2 min-w-[18px] h-[18px] px-1 bg-amber-400 text-emerald-950 text-[10px] font-bold rounded-full flex items-center justify-center">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>
      </div>
      <div className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-medium transition cursor-pointer touch-manipulation select-none ${
                isActive
                  ? 'bg-emerald-700 text-white shadow-[inset_3px_0_0_0_rgb(110,231,183)]'
                  : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
              }`}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="p-4 border-t border-emerald-800/50 space-y-1">
        <button type="button" onClick={() => navigate('/help')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-emerald-200 hover:bg-emerald-800/50 hover:text-white transition cursor-pointer touch-manipulation select-none">
          <HelpCircle className="w-5 h-5 flex-shrink-0" />
          <span>Help & Guide</span>
        </button>
        <button type="button" onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-emerald-300 hover:bg-emerald-800/50 hover:text-white transition cursor-pointer touch-manipulation select-none">
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Top Header — hamburger + brand + actions */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 bg-gradient-to-r from-emerald-950 to-emerald-900 border-b border-emerald-800/60 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-14 flex items-center justify-between gap-2 px-3">
          <div className="flex items-center gap-1 min-w-0">
            <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" type="button"
              className="h-11 w-11 flex items-center justify-center text-white hover:bg-emerald-800/70 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-sm flex-shrink-0 ring-1 ring-white/20">
                <HardHat className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-white font-bold text-base truncate">GC Job Planner</h1>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canViewSchedule && (
              <button onClick={() => navigate('/staff-schedule')} aria-label="My Schedule" type="button"
                className="relative h-11 w-11 flex items-center justify-center text-white hover:bg-emerald-800/70 active:bg-emerald-700 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
                <CalendarDays className="w-5 h-5" />
              </button>
            )}
            <button onClick={openChat} aria-label="Ask Assistant" type="button"
              className="relative h-11 w-11 flex items-center justify-center text-white hover:bg-emerald-800/70 active:bg-emerald-700 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <Sparkles className="w-5 h-5" />
            </button>
            <button onClick={() => setNotifOpen(true)} aria-label="Notifications" type="button"
              className="relative h-11 w-11 flex items-center justify-center text-white hover:bg-emerald-800/70 active:bg-emerald-700 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <Bell className="w-5 h-5" />
              {notifCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-amber-400 text-emerald-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <nav className="hidden lg:flex sticky top-0 h-screen w-64 bg-gradient-to-b from-emerald-950 to-emerald-900 border-r border-emerald-800/50 flex-col">
        {desktopNav}
      </nav>

      <MobileNavDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navItems={navItems}
        activeSection={activeSection}
        onNavigate={setActiveSection}
        onLogout={handleLogout}
        onAssistant={openChat}
        onScheduling={openSchedulingChat}
        onHelp={() => { navigate('/help'); setDrawerOpen(false); }}
      />

      <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={setActiveSection} notifications={notifications} />
    </>
  );
}