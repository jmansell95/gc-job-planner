import React, { useState } from 'react';
import { Users, Truck, Briefcase, Calendar, Grid3x3, LogOut, Menu, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AdminNav({ activeSection, setActiveSection }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await base44.auth.logout('/');
  };

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: Grid3x3 },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'vehicles', label: 'Vehicles', icon: Truck },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'rota', label: 'Weekly Rota', icon: Calendar },
  ];

  const handleNavClick = (id) => {
    setActiveSection(id);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-emerald-700 text-white rounded-lg"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay on mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
        />
      )}

      {/* Sidebar */}
      <nav className={`
        fixed lg:relative z-40 lg:z-auto top-0 left-0 h-screen lg:h-auto transform lg:transform-none transition-transform lg:transition-none overflow-y-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        w-64 bg-white border-r border-slate-200 flex flex-col
      `}>
        <div className="p-6 border-b border-slate-200 bg-emerald-700">
          <h1 className="text-2xl font-bold text-white">WorkRota</h1>
          <p className="text-xs text-emerald-100 mt-1">Admin Panel</p>
        </div>

        <div className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-left">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </nav>
    </>
  );
}