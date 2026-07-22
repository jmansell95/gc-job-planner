import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, LogOut, HelpCircle } from 'lucide-react';
import Logo from '@/components/Logo';

export default function MobileNavDrawer({ isOpen, onClose, navItems, activeSection, onNavigate, onLogout, onAssistant, onHelp }) {
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
            className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[82%] max-w-xs bg-gradient-to-b from-[#7a3410] via-[#8a3f14] to-[#9a4a1a] border-r border-black/20 flex flex-col shadow-2xl"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center min-w-0 flex-1 justify-center">
                <Logo variant="full" height={38} tone="light" />
              </div>
              <button onClick={onClose} aria-label="Close menu" type="button"
                className="h-9 w-9 flex items-center justify-center text-white/80 hover:bg-white/15 hover:text-white rounded-lg transition flex-shrink-0 touch-manipulation">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 pt-4 pb-2 space-y-2">
              <button onClick={onAssistant} type="button"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl command-gradient text-white text-sm font-medium hover:brightness-110 active:scale-[0.98] transition shadow-sm touch-manipulation select-none">
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
                        ? 'bg-white/15 text-white shadow-[inset_3px_0_0_0_#F5821F]'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}>
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-white/10 space-y-1">
              {onHelp && (
                <button type="button" onClick={onHelp}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition touch-manipulation select-none">
                  <HelpCircle className="w-5 h-5 flex-shrink-0" />
                  <span>Help & Guide</span>
                </button>
              )}
              <button type="button" onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white transition touch-manipulation select-none">
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