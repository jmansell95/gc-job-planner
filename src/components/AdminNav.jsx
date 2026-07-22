import React, { useState, useEffect } from 'react';
import { Briefcase, Calendar, CalendarDays, Grid3x3, LogOut, Settings, Bell, HardHat, Sparkles, Menu, HelpCircle, Receipt } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NotificationCenter from '@/components/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { useStaffAssistant } from '@/components/StaffAssistantChat';
import { useNavigate } from 'react-router-dom';
import MobileNavDrawer from '@/components/MobileNavDrawer';
import GlobalSearch from '@/components/GlobalSearch';
import { canAccessSection } from '@/utils/access';
import Logo from '@/components/Logo';

export default function AdminNav({ activeSection, setActiveSection }) {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const notifications = useNotifications();
  const notifCount = notifications.count;
  const { openChat } = useStaffAssistant();

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
    { id: 'scheduling', label: 'Scheduling', icon: Calendar },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const navItems = allNavItems.filter(item => canAccessSection(profile, item.id));
  const canViewSchedule = canAccessSection(profile, 'staff_schedule');

  const desktopNav = (
    <>
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-11 w-auto rounded-xl bg-white/95 p-1 flex items-center justify-center shadow-sm ring-1 ring-white/30 flex-shrink-0">
            <Logo variant="lockup" height={36} />
          </div>
        </div>
        <p className="text-[11px] text-white/70 mt-2 font-medium tracking-wide">Admin Panel</p>
      </div>
      <div className="px-4 pb-3 space-y-2">
        <GlobalSearch />
        <button onClick={openChat} type="button"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg command-gradient text-white text-sm font-medium hover:brightness-110 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none shadow-sm">
          <Sparkles className="w-4 h-4" />
          Ask Assistant
        </button>
        {canViewSchedule && (
          <button onClick={() => navigate('/staff-schedule')} type="button"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
            <CalendarDays className="w-4 h-4" />
            My Schedule
          </button>
        )}
        <button onClick={() => setNotifOpen(true)} type="button"
          className="relative w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
          <Bell className="w-4 h-4" />
          Notifications
          {notifCount > 0 && (
            <span className="absolute top-1 right-2 min-w-[18px] h-[18px] px-1 bg-[#F5821F] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-1 ring-white/30">
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
                  ? 'bg-white/15 text-white shadow-[inset_3px_0_0_0_#F5821F]'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="p-4 border-t border-white/10 space-y-1">
        <button type="button" onClick={() => navigate('/help')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white transition cursor-pointer touch-manipulation select-none">
          <HelpCircle className="w-5 h-5 flex-shrink-0" />
          <span>Help & Guide</span>
        </button>
        <button type="button" onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition cursor-pointer touch-manipulation select-none">
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Top Header — hamburger + brand + actions */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 border-b border-white/10 shadow-sm relative overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="absolute inset-0 mesh-bg" />
        <div className="relative z-10 h-14 flex items-center justify-between gap-2 px-3">
          <div className="flex items-center gap-1 min-w-0">
            <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" type="button"
              className="h-11 w-11 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-9 w-auto rounded-lg bg-white/95 px-1.5 flex items-center justify-center shadow-sm flex-shrink-0">
                <Logo variant="lockup" height={26} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canViewSchedule && (
              <button onClick={() => navigate('/staff-schedule')} aria-label="My Schedule" type="button"
                className="relative h-11 w-11 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
                <CalendarDays className="w-5 h-5" />
              </button>
            )}
            <button onClick={openChat} aria-label="Ask Assistant" type="button"
              className="relative h-11 w-11 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <Sparkles className="w-5 h-5" />
            </button>
            <button onClick={() => setNotifOpen(true)} aria-label="Notifications" type="button"
              className="relative h-11 w-11 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <Bell className="w-5 h-5" />
              {notifCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-[#F5821F] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-1 ring-white/30">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <nav className="hidden lg:flex sticky top-0 h-screen w-64 border-r border-black/10 flex-col relative overflow-hidden">
        <div className="absolute inset-0 mesh-bg" />
        <div className="relative z-10 flex flex-col h-full">
          {desktopNav}
        </div>
      </nav>

      <MobileNavDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navItems={navItems}
        activeSection={activeSection}
        onNavigate={setActiveSection}
        onLogout={handleLogout}
        onAssistant={openChat}
        onHelp={() => { navigate('/help'); setDrawerOpen(false); }}
      />

      <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={setActiveSection} notifications={notifications} />
    </>
  );
}