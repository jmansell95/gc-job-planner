import React, { useState, useEffect } from 'react';
import { Users, Briefcase, Calendar, CalendarDays, Grid3x3, LogOut, Menu, X, Settings, Clock, Bell } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NotificationCenter from '@/components/NotificationCenter';
import { useNotifications } from '@/hooks/useNotifications';

export default function AdminNav({ activeSection, setActiveSection }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const notifications = useNotifications();
  const notifCount = notifications.count;

  useEffect(() => {
    const open = isOpen || notifOpen;
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen, notifOpen]);

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

  const currentLabel = navItems.find(i => i.id === activeSection)?.label || 'Dashboard';

  const closeMenu = () => setIsOpen(false);
  const toggleMenu = () => setIsOpen(v => !v);
  const handleNavClick = (id) => {
    setActiveSection(id);
    closeMenu();
  };

  const renderNavContent = (onClose) => (
    <>
      <div className="p-6 border-b border-emerald-800/50 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">GC Job Planner</h1>
          <p className="text-xs text-emerald-300 mt-1">Admin Panel</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close menu"
            className="p-2 -mr-2 text-emerald-200 hover:bg-emerald-800/50 hover:text-white active:scale-95 rounded-lg transition cursor-pointer touch-manipulation select-none">
            <X className="w-5 h-5" />
          </button>
        )}
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
                  ? 'bg-emerald-700 text-white shadow-[inset_3px_0_0_0_rgb(110,231,183)]'
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
          <button onClick={toggleMenu} aria-label="Toggle menu" aria-expanded={isOpen} type="button"
            className="flex items-center gap-2 h-14 px-4 -ml-1 text-white hover:bg-emerald-800/70 active:bg-emerald-700 active:scale-95 rounded-lg transition min-w-[56px] cursor-pointer touch-manipulation select-none">
            <span className="relative w-6 h-6 flex items-center justify-center">
              <Menu className={`absolute w-6 h-6 transition-all duration-200 ease-out ${isOpen ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`} />
              <X className={`absolute w-6 h-6 transition-all duration-200 ease-out ${isOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`} />
            </span>
            <span className="text-sm font-semibold">Menu</span>
          </button>
          <span className="text-white font-bold text-sm truncate flex-1 text-center">{currentLabel}</span>
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

      {/* Mobile Overlay */}
      <div
        onClick={closeMenu}
        className={`lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Mobile Drawer */}
      <nav
        className={`lg:hidden fixed top-[calc(3.5rem+env(safe-area-inset-top))] left-0 h-[calc(100vh-3.5rem-env(safe-area-inset-top))] w-72 max-w-[85vw] z-[60] overflow-hidden bg-gradient-to-b from-emerald-950 to-emerald-900 border-r border-emerald-800/50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'translate-x-0 pointer-events-auto shadow-2xl' : '-translate-x-full pointer-events-none'}`}
      >
        {renderNavContent(closeMenu)}
      </nav>

      <NotificationCenter isOpen={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={setActiveSection} notifications={notifications} />
    </>
  );
}