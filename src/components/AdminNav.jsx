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
        className="hidden max-lg:fixed max-lg:top-4 max-lg:left-4 max-lg:z-50 max-lg:p-2 max-lg:bg-green-600 max-lg:text-white max-lg:rounded-lg"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay on mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="hidden max-lg:fixed max-lg:inset-0 max-lg:bg-black max-lg:bg-opacity-50 max-lg:z-40"
        />
      )}

      {/* Sidebar */}
      <nav className={`
        fixed max-lg:z-40 max-lg:top-0 max-lg:left-0 max-lg:h-screen max-lg:transform max-lg:transition-transform
        ${isOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
        lg:relative lg:translate-x-0
        w-64 bg-white border-r border-slate-200 flex flex-col
      `}>
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-green-600">WorkRota</h1>
          <p className="text-xs text-slate-500 mt-1">Admin Panel</p>
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
                    ? 'bg-green-50 text-green-600 border-l-4 border-green-600'
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