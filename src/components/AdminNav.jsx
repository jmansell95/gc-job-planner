import React, { useState, useEffect } from 'react';
import { Briefcase, Calendar, CalendarDays, Grid3x3, LogOut, Settings, Bell, HardHat, Sparkles, Menu, HelpCircle, Receipt, User, Truck, Boxes, Car, Clock, ShieldCheck, PoundSterling, ShieldAlert, ChevronRight, ChevronDown, PanelLeftClose, PanelLeftOpen, Wrench, Warehouse, Users, Contact, Zap, FileBarChart, FileUp, ClipboardCheck, FlaskConical } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import NotificationCenter from '@/components/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';
import { useStaffAssistant } from '@/components/StaffAssistantChat';
import { useDrillingIntelligence } from '@/components/DrillingIntelligenceChat';
import { useNavigate } from 'react-router-dom';
import MobileNavDrawer from '@/components/MobileNavDrawer';
import GlobalSearch from '@/components/GlobalSearch';
import { canAccessSection, resolveRole } from '@/utils/access';
import { settingsGroups, HUB_MIGRATED_ITEMS, accessibleSettingsItems } from '@/components/SettingsNav';
import Logo from '@/components/Logo';
import ProfileAvatar from '@/components/ui/ProfileAvatar';

export default function AdminNav({ activeSection, setActiveSection, onSettingsTabClick }) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('gc-sidebar-collapsed') === 'true'; } catch { return false; }
  });
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
    if (!profileMenuOpen) return;
    const handler = () => setProfileMenuOpen(false);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!notifOpen && !drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [notifOpen, drawerOpen]);

  // Allow the mobile bottom-nav Alerts button (a sibling component with no
  // shared state) to open the notification center via a custom DOM event.
  useEffect(() => {
    const handler = () => setNotifOpen(true);
    window.addEventListener('gc-open-notifications', handler);
    return () => window.removeEventListener('gc-open-notifications', handler);
  }, []);

  // Fallback to the auth user's name when the staff profile fetch fails
  // (common on published-site cold starts). Prevents the avatar showing '?'
  // when profile is null but the user is still logged in.
  const displayName = profile?.name || authUser?.full_name || authUser?.email || null;
  const displayAvatar = profile?.avatar_url || null;

  const handleLogout = async () => {
    await base44.auth.logout('/');
  };

  const allNavItems = [
    { id: 'overview', label: 'Dashboard', icon: Grid3x3 },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'scheduling', label: 'Scheduling', icon: Calendar },
    { id: 'staff', label: 'Staff & Teams', icon: Users },
    { id: 'logistics', label: 'Deliveries', icon: Truck },
    { id: 'assets', label: 'Assets & Fleet', icon: Wrench },
    { id: 'investigation', label: 'Investigation Hub', icon: FlaskConical },
    { id: 'compliance', label: 'Compliance & Audit', icon: ShieldCheck },
    { id: 'billing', label: 'Financial Control', icon: PoundSterling },
    { id: 'settings', label: 'System', icon: Settings },
  ];

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('gc-sidebar-collapsed', String(next)); } catch {}
  };

  const navItems = allNavItems.filter(item => canAccessSection(profile, item.id));
  const canViewSchedule = canAccessSection(profile, 'staff_schedule');

  const desktopNav = (
    <>
      <div className={`${collapsed ? 'px-2 pt-3 pb-2' : 'px-4 pt-4 pb-3'} border-b border-white/10`}>
        <div className="flex flex-col items-start gap-3">
          <div className="flex flex-col items-center w-full">
            {collapsed ? (
              <img src="https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/993ce8312_GC_Logo-removebg-preview.png" alt="Ground Control" className="w-10 h-auto object-contain" />
            ) : (
              <>
                <img src="https://media.base44.com/images/public/6a44ff49723371caf4d96d4c/993ce8312_GC_Logo-removebg-preview.png" alt="Ground Control" className="w-28 h-auto object-contain" />
                <p className="text-[11px] text-white/60 mt-1.5 font-display font-semibold uppercase tracking-[0.22em]">Admin Panel</p>
              </>
            )}
          </div>
          {profile && !collapsed && (
            <div className="relative w-full">
              <button type="button" onClick={(e) => { e.stopPropagation(); setProfileMenuOpen(!profileMenuOpen); }} title={`${profile.name} — ${profile.email}`}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition cursor-pointer touch-manipulation select-none ring-1 ring-white/10">
                <ProfileAvatar name={profile.name} avatarUrl={profile.avatar_url} size={40} />
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-semibold text-white truncate leading-tight">{profile.name}</p>
                  <p className="text-[11px] text-white/50 truncate leading-tight mt-0.5">{profile.email}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileMenuOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50" onClick={(e) => e.stopPropagation()}>
                  <div className="py-1">
                    {canViewSchedule && (
                      <button onClick={() => { navigate('/staff-schedule'); setProfileMenuOpen(false); }} type="button"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                        <CalendarDays className="w-4 h-4 text-slate-400" /> My Schedule
                      </button>
                    )}
                    <button onClick={() => { navigate('/staff-profile'); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                      <User className="w-4 h-4 text-slate-400" /> My Profile
                    </button>
                    <button onClick={() => { navigate('/help'); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                      <HelpCircle className="w-4 h-4 text-slate-400" /> Help Guides
                    </button>
                  </div>
                  <div className="border-t border-slate-100 py-1">
                    <button onClick={() => { handleLogout(); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition text-left">
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {profile && collapsed && (
            <div className="relative w-full flex justify-center">
              <button type="button" onClick={(e) => { e.stopPropagation(); setProfileMenuOpen(!profileMenuOpen); }} title={`${profile.name} — ${profile.email}`}
                className="p-1 rounded-full hover:bg-white/10 transition cursor-pointer touch-manipulation select-none ring-1 ring-white/10">
                <ProfileAvatar name={profile.name} avatarUrl={profile.avatar_url} size={36} />
              </button>
              {profileMenuOpen && (
                <div className="absolute left-full ml-2 top-0 w-60 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50" onClick={(e) => e.stopPropagation()}>
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900 truncate">{profile.name}</p>
                    {profile.email && <p className="text-xs text-slate-500 truncate mt-0.5">{profile.email}</p>}
                  </div>
                  <div className="py-1">
                    {canViewSchedule && (
                      <button onClick={() => { navigate('/staff-schedule'); setProfileMenuOpen(false); }} type="button"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                        <CalendarDays className="w-4 h-4 text-slate-400" /> My Schedule
                      </button>
                    )}
                    <button onClick={() => { navigate('/staff-profile'); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                      <User className="w-4 h-4 text-slate-400" /> My Profile
                    </button>
                    <button onClick={() => { navigate('/help'); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                      <HelpCircle className="w-4 h-4 text-slate-400" /> Help Guides
                    </button>
                  </div>
                  <div className="border-t border-slate-100 py-1">
                    <button onClick={() => { handleLogout(); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition text-left">
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 px-2 py-1.5 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          if (item.comingSoon) {
            return (
              <div key={item.id} className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium opacity-40 cursor-not-allowed select-none">
                <Icon className="w-[18px] h-[18px] flex-shrink-0 text-white/40" />
                {!collapsed && <span className="text-white/40 flex-1">{item.label}</span>}
                {!collapsed && <span className="text-[9px] font-bold text-white/40 bg-white/10 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Soon</span>}
              </div>
            );
          }
          return (
            <div key={item.id}>
              <button type="button" onClick={() => setActiveSection(item.id)} title={collapsed ? item.label : undefined}
                className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} ${collapsed ? 'px-0 py-2.5' : 'px-3.5 py-2'} rounded-xl text-sm font-medium transition cursor-pointer touch-manipulation select-none ${
                  isActive
                    ? 'command-gradient text-white shadow-lg glow-brand ring-1 ring-[#8DC63F]/30'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}>
                <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-[#8DC63F]' : ''}`} />
                {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              </button>
            </div>
          );
        })}
      </div>
      {/* Compact action cluster — single row of quick actions */}
      <div className={`${collapsed ? 'px-1.5' : 'px-3'} pt-1.5 pb-1.5 border-t border-white/10 space-y-1.5`}>
        {!collapsed && <GlobalSearch />}
        <div className={`grid ${collapsed ? 'grid-cols-1 gap-1.5' : 'grid-cols-3 gap-2'}`}>
          <button onClick={openDrillingIntelligence} type="button" title="Drilling Intelligence"
            className="h-9 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
            <HardHat className="w-4 h-4" />
          </button>
          <button onClick={openChat} type="button" title="Ask Assistant"
            className="h-9 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
            <Sparkles className="w-4 h-4" />
          </button>
          {!collapsed && (
            <button onClick={toggleCollapsed} type="button" title="Collapse sidebar"
              className="h-9 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={toggleCollapsed} type="button" title="Expand sidebar"
            className="w-full h-9 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] transition cursor-pointer touch-manipulation select-none ring-1 ring-white/15">
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Top Header — hamburger + brand + actions */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 border-b border-white/10 shadow-sm relative" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="absolute inset-0 sidebar-modern" />
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
            <button onClick={() => setNotifOpen(true)} aria-label="Notifications" type="button"
              className="relative h-10 w-10 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none">
              <Bell className="w-[18px] h-[18px]" />
              {notifCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[15px] h-4 px-1 bg-[#8DC63F] text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-1 ring-white/30">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <div className="h-7 w-px bg-white/20 mx-1.5 flex-shrink-0" />
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setProfileMenuOpen(!profileMenuOpen); }} aria-label="Profile menu" type="button"
                className="relative flex items-center justify-center active:scale-95 rounded-full transition flex-shrink-0 touch-manipulation select-none ring-2 ring-transparent hover:ring-white/20">
                <ProfileAvatar name={displayName} avatarUrl={displayAvatar} size={32} />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50" onClick={(e) => e.stopPropagation()}>
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900 truncate">{displayName || 'User'}</p>
                    {authUser?.email && <p className="text-xs text-slate-500 truncate mt-0.5">{authUser.email}</p>}
                  </div>
                  <div className="py-1">
                    {canViewSchedule && (
                      <button onClick={() => { navigate('/staff-schedule'); setProfileMenuOpen(false); }} type="button"
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                        <CalendarDays className="w-4 h-4 text-slate-400" /> My Schedule
                      </button>
                    )}
                    <button onClick={() => { navigate('/staff-profile'); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                      <User className="w-4 h-4 text-slate-400" /> My Profile
                    </button>
                    <button onClick={() => { navigate('/help'); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition text-left">
                      <HelpCircle className="w-4 h-4 text-slate-400" /> Help Guides
                    </button>
                  </div>
                  <div className="border-t border-slate-100 py-1">
                    <button onClick={() => { handleLogout(); setProfileMenuOpen(false); }} type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition text-left">
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <nav className={`hidden lg:flex sticky top-0 h-screen ${collapsed ? 'w-16' : 'w-64'} border-r border-black/10 flex-col relative transition-all duration-300`}>
        <div className="absolute inset-0 sidebar-modern" />
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
        onDeliveries={() => { navigate('/deliveries'); setDrawerOpen(false); }}
        onHelp={() => { navigate('/help'); setDrawerOpen(false); }}
        onProfile={() => { navigate('/staff-profile'); setDrawerOpen(false); }}
        profile={profile ? { ...profile, name: displayName, avatar_url: displayAvatar } : (authUser ? { name: displayName, avatar_url: displayAvatar, email: authUser.email } : null)}
      />

      <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={setActiveSection} notifications={notifications} />
    </>
  );
}