import React, { useState, useEffect } from 'react';
import { Briefcase, Calendar, CalendarDays, Grid3x3, LogOut, Settings, Bell, HardHat, Sparkles, Menu, HelpCircle, Receipt, ScanLine, User, Truck, Boxes, Car, Clock, ShieldCheck, PoundSterling, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NotificationCenter from '@/components/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { useStaffAssistant } from '@/components/StaffAssistantChat';
import { useDrillingIntelligence } from '@/components/DrillingIntelligenceChat';
import { useNavigate } from 'react-router-dom';
import MobileNavDrawer from '@/components/MobileNavDrawer';
import GlobalSearch from '@/components/GlobalSearch';
import AssetLens from '@/components/logistics/AssetLens';
import { canAccessSection } from '@/utils/access';
import Logo from '@/components/Logo';
import ProfileAvatar from '@/components/ui/ProfileAvatar';

export default function AdminNav({ activeSection, setActiveSection }) {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lensOpen, setLensOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const notifications = useNotifications();
  const notifCount = notifications.count;
  const { openChat } = useStaffAssistant();
  const { openChat: openDrillingIntelligence } = useDrillingIntelligence();

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
    { id: 'timesheets', label: 'Timesheets', icon: Clock },
    { id: 'logistics', label: 'Logistics', icon: Truck },
    { id: 'fleet', label: 'Rig Fleet', icon: Boxes },
    { id: 'vehicles', label: 'Vehicles', icon: Car },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
    { id: 'safety', label: 'Safety', icon: ShieldAlert },
    { id: 'billing', label: 'Billing', icon: PoundSterling },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const navItems = allNavItems.filter(item => canAccessSection(profile, item.id));
  const canViewSchedule = canAccessSection(profile, 'staff_schedule');

  const desktopNav = (
    <>
      <div className="px-4 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center justify-start">
          <img src="https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/993ce8312_GC_Logo-removebg-preview.png" alt="Ground Control" className="w-44 h-auto object-contain" />
        </div>
        <p className="text-left text-[10px] text-white/60 mt-1.5 font-display font-semibold uppercase tracking-[0.22em]">Admin Panel</p>
      </div>
      <div className="flex-1 px-3 py-2.5 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer touch-manipulation select-none ${
                isActive
                  ? 'bg-white/15 text-white shadow-[inset_3px_0_0_0_#8DC63F]'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}>
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      {/* Compact action cluster — single row of quick actions */}
      <div className="px-3 pt-2 pb-2 border-t border-white/10 space-y-1.5">
        <GlobalSearch />
        <div className="grid grid-cols-3 gap-2">
          <button onClick={openDrillingIntelligence} type="button" title="Drilling Intelligence"
            className="h-10 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
            <HardHat className="w-4 h-4" />
          </button>
          <button onClick={() => setLensOpen(true)} type="button" title="Asset Lens"
            className="h-10 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
            <ScanLine className="w-4 h-4" />
          </button>
          <button onClick={openChat} type="button" title="Ask Assistant"
            className="h-10 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Profile card */}
      {profile && (
        <div className="px-3 py-2.5 border-t border-white/10">
          <button type="button" onClick={() => navigate('/staff-profile')}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer touch-manipulation select-none">
            <ProfileAvatar name={profile.name} avatarUrl={profile.avatar_url} size={36} />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-white truncate">{profile.name}</p>
              <p className="text-[11px] text-white/50 truncate">{profile.email}</p>
            </div>
            <Settings className="w-4 h-4 text-white/40 flex-shrink-0" />
          </button>
        </div>
      )}
      {/* Personal links + system actions */}
      <div className="px-3 py-2 border-t border-white/10 space-y-0.5">
        {canViewSchedule && (
          <button type="button" onClick={() => navigate('/staff-schedule')}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white transition cursor-pointer touch-manipulation select-none">
            <CalendarDays className="w-[18px] h-[18px] flex-shrink-0" />
            <span>My Schedule</span>
          </button>
        )}
        <button type="button" onClick={() => navigate('/staff-profile')}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white transition cursor-pointer touch-manipulation select-none">
          <User className="w-[18px] h-[18px] flex-shrink-0" />
          <span>My Profile</span>
        </button>
        <button type="button" onClick={() => navigate('/help')}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white transition cursor-pointer touch-manipulation select-none">
          <HelpCircle className="w-[18px] h-[18px] flex-shrink-0" />
          <span>Help & Guide</span>
        </button>
        <button type="button" onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition cursor-pointer touch-manipulation select-none">
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
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
            <div className="flex items-center min-w-0">
              <Logo variant="full" height={30} tone="light" />
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canViewSchedule && (
              <button onClick={() => navigate('/staff-schedule')} aria-label="My Schedule" type="button"
                className="relative h-10 w-10 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
                <CalendarDays className="w-[18px] h-[18px]" />
              </button>
            )}
            <button onClick={() => navigate('/staff-profile')} aria-label="My Profile" type="button"
              className="relative flex items-center justify-center active:scale-95 rounded-full transition flex-shrink-0 touch-manipulation select-none">
              <ProfileAvatar name={profile?.name} avatarUrl={profile?.avatar_url} size={32} />
            </button>
            <button onClick={() => navigate('/help')} aria-label="Help & Guide" type="button"
              className="relative h-10 w-10 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <HelpCircle className="w-[18px] h-[18px]" />
            </button>
            <button onClick={() => setNotifOpen(true)} aria-label="Notifications" type="button"
              className="relative h-10 w-10 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <Bell className="w-[18px] h-[18px]" />
              {notifCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[15px] h-4 px-1 bg-[#8DC63F] text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-1 ring-white/30">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <button onClick={handleLogout} aria-label="Logout" type="button"
              className="relative h-10 w-10 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <LogOut className="w-[18px] h-[18px]" />
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
        onDrillingIntelligence={() => { openDrillingIntelligence(); setDrawerOpen(false); }}
        onNotifications={() => { setNotifOpen(true); setDrawerOpen(false); }}
        notifCount={notifCount}
        onAssetLens={() => { setLensOpen(true); setDrawerOpen(false); }}
        onDeliveries={() => { navigate('/deliveries'); setDrawerOpen(false); }}
        onHelp={() => { navigate('/help'); setDrawerOpen(false); }}
        onProfile={() => { navigate('/staff-profile'); setDrawerOpen(false); }}
        profile={profile}
      />

      <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={setActiveSection} notifications={notifications} />
      <AssetLens open={lensOpen} onClose={() => setLensOpen(false)} />
    </>
  );
}