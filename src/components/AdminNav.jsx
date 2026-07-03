import React, { useState } from 'react';
import { Users, Truck, Briefcase, Calendar, CalendarDays, Grid3x3, LogOut, Menu, X, Settings, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AdminNav({ activeSection, setActiveSection }) {
  const [isOpen, setIsOpen] = useState(false);

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

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-emerald-900 border-b border-emerald-800 h-14 flex items-center justify-between px-4 shadow-lg">
        <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 pl-2.5 pr-3 py-1.5 text-white hover:bg-emerald-800 rounded-lg transition">
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          <span className="text-sm font-semibold">Menu</span>
        </button>
        <span className="text-white font-bold text-sm">GC Job Planner</span>
        <div className="w-9" />
      </header>

      {/* Overlay */}
      {isOpen && (
        <div onClick={() => setIsOpen(false)} className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
      )}

      {/* Sidebar */}
      <nav className={`
        fixed lg:sticky top-0 left-0 h-screen lg:h-screen w-64 transform lg:transform-none transition-transform duration-300 ease-in-out overflow-y-auto bg-gradient-to-b from-emerald-950 to-emerald-900 border-r border-emerald-800/50 flex flex-col z-50 lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
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
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
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
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-emerald-300 hover:bg-emerald-800/50 hover:text-white transition"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </nav>
    </>
  );
}