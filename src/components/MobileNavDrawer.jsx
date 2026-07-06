import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, HardHat, Sparkles, LogOut } from 'lucide-react';

export default function MobileNavDrawer({ isOpen, onClose, navItems, activeSection, onNavigate, onLogout, onAssistant }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="lg:hidden fixed inset-0 z-50 bg-emerald-950/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[82%] max-w-xs bg-gradient-to-b from-emerald-950 to-emerald-900 border-r border-emerald-800/50 flex flex-col shadow-2xl"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="p-5 border-b border-emerald-800/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-sm ring-1 ring-white/20 flex-shrink-0">
                  <HardHat className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-white leading-tight">GC Job Planner</h1>
                  <p className="text-xs text-emerald-300">Admin Panel</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close menu" type="button"
                className="h-9 w-9 flex items-center justify-center text-emerald-200 hover:bg-emerald-800/60 hover:text-white rounded-lg transition flex-shrink-0 touch-manipulation">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 pt-4 pb-2">
              <button onClick={onAssistant} type="button"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-medium hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98] transition shadow-sm touch-manipulation select-none">
                <Sparkles className="w-4 h-4" />
                Ask Assistant
              </button>
            </div>

            <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto overscroll-contain">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button key={item.id} type="button"
                    onClick={() => { onNavigate(item.id); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition touch-manipulation select-none ${
                      isActive
                        ? 'bg-emerald-700 text-white shadow-[inset_3px_0_0_0_rgb(110,231,183)]'
                        : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
                    }`}>
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-emerald-800/50">
              <button type="button" onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-emerald-300 hover:bg-emerald-800/50 hover:text-white transition touch-manipulation select-none">
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}