import React, { useState, useEffect } from 'react';
import { Briefcase, Calendar, CalendarDays, Grid3x3, LogOut, Settings, Bell, HardHat, Sparkles, Menu, HelpCircle, Receipt, ScanLine, User, Boxes, ChevronLeft, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NotificationCenter from '@/components/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { useStaffAssistant } from '@/components/StaffAssistantChat';
import { useNavigate } from 'react-router-dom';
import MobileNavDrawer from '@/components/MobileNavDrawer';
import GlobalSearch from '@/components/GlobalSearch';
import AssetLens from '@/components/logistics/AssetLens';
import { canAccessSection } from '@/utils/access';
import Logo from '@/components/Logo';

export default function AdminNav({ activeSection, setActiveSection }) {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lensOpen, setLensOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
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
      <div className={`pt-5 pb-3 border-b border-white/10 flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {collapsed ? (
          <img src="https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/993ce8312_GC_Logo-removebg-preview.png" alt="Ground Control" className="w-9 h-auto object-contain" />
        ) : (
          <img src="https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/993ce8312_GC_Logo-removebg-preview.png" alt="Ground Control" className="w-40 h-auto object-contain" />
        )}
        <button onClick={() => setCollapsed(c => !c)} type="button" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition flex-shrink-0 ${collapsed ? 'mt-3' : ''}`}>
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
      <div className={`space-y-2 ${collapsed ? 'px-2 pt-3 pb-2' : 'px-4 pb-3'}`}>
        {collapsed ? (
          <>
            <div className="flex justify-center"><GlobalSearch compact /></div>
            <button onClick={openChat} type="button" title="Ask Assistant"
              className="w-full flex items-center justify-center px-2 py-2.5 rounded-lg command-gradient text-white hover:brightness-110 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none shadow-sm">
              <Sparkles className="w-4 h-4" />
            </button>
            {canViewSchedule && (
              <button onClick={() => navigate('/staff-schedule')} type="button" title="My Schedule"
                className="w-full flex items-center justify-center px-2 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
                <CalendarDays className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => navigate('/staff-profile')} type="button" title="My Profile"
              className="w-full flex items-center justify-center px-2 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
              <User className="w-4 h-4" />
            </button>
            <button onClick={() => setNotifOpen(true)} type="button" title="Notifications"
              className="relative w-full flex items-center justify-center px-2 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
              <Bell className="w-4 h-4" />
              {notifCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-[#8DC63F] text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-1 ring-white/30">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <button onClick={() => setLensOpen(true)} type="button" title="Asset Lens"
              className="w-full flex items-center justify-center px-2 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
              <ScanLine className="w-4 h-4" />
            </button>
            <button onClick={() => navigate('/rig-hub')} type="button" title="Rig Hub"
              className="w-full flex items-center justify-center px-2 py-2.5 rounded-lg bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] text-white hover:brightness-110 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none shadow-sm">
              <Boxes className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
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
            <button onClick={() => navigate('/staff-profile')} type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
              <User className="w-4 h-4" />
              My Profile
            </button>
            <button onClick={() => setNotifOpen(true)} type="button"
              className="relative w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
              <Bell className="w-4 h-4" />
              Notifications
              {notifCount > 0 && (
                <span className="absolute top-1 right-2 min-w-[18px] h-[18px] px-1 bg-[#8DC63F] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-1 ring-white/30">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <button onClick={() => setLensOpen(true)} type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
              <ScanLine className="w-4 h-4" />
              Asset Lens
            </button>
            <button onClick={() => navigate('/rig-hub')} type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E] text-white text-sm font-semibold hover:brightness-110 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none shadow-sm">
              <Boxes className="w-4 h-4" />
              Rig Hub
            </button>
          </>
        )}
      </div>
      <div className={`flex-1 ${collapsed ? 'px-2 py-2' : 'p-4'} space-y-1 overflow-y-auto`}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setActiveSection(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg text-sm font-medium transition cursor-pointer touch-manipulation select-none ${
                isActive
                  ? 'bg-white/15 text-white shadow-[inset_3px_0_0_0_#8DC63F]'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>
      <div className={`${collapsed ? 'px-2 py-2' : 'p-4'} border-t border-white/10 space-y-1`}>
        <button type="button" onClick={() => navigate('/help')} title={collapsed ? 'Help & Guide' : undefined}
          className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white transition cursor-pointer touch-manipulation select-none`}>
          <HelpCircle className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Help & Guide</span>}
        </button>
        <button type="button" onClick={handleLogout} title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition cursor-pointer touch-manipulation select-none`}>
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
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
            <div className="flex items-center min-w-0">
              <Logo variant="full" height={30} tone="light" />
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canViewSchedule && (
              <button onClick={() => navigate('/staff-schedule')} aria-label="My Schedule" type="button"
                className="relative h-11 w-11 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
                <CalendarDays className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => navigate('/staff-profile')} aria-label="My Profile" type="button"
              className="relative h-11 w-11 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <User className="w-5 h-5" />
            </button>
            <button onClick={openChat} aria-label="Ask Assistant" type="button"
              className="relative h-11 w-11 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <Sparkles className="w-5 h-5" />
            </button>
            <button onClick={() => setNotifOpen(true)} aria-label="Notifications" type="button"
              className="relative h-11 w-11 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <Bell className="w-5 h-5" />
              {notifCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-[#8DC63F] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-1 ring-white/30">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <nav className={`hidden lg:flex sticky top-0 h-screen ${collapsed ? 'w-[72px]' : 'w-64'} border-r border-black/10 flex-col relative overflow-hidden transition-[width] duration-200`}>
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
        onProfile={() => { navigate('/staff-profile'); setDrawerOpen(false); }}
      />

      <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={setActiveSection} notifications={notifications} />
      <AssetLens open={lensOpen} onClose={() => setLensOpen(false)} />
    </>
  );
}