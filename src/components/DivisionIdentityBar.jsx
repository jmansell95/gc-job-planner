import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { useDivision } from '@/contexts/DivisionContext';

/**
 * DivisionIdentityBar — a thin, animated visual indicator showing the active
 * division's brand color and identity. Injected at the top of both the
 * AdminDashboard and StaffDashboard so users know which division they're in
 * the moment they land on the page.
 *
 * Returns null when no division is active (Enterprise Overview) or still loading.
 * Works automatically for all current and future divisions — pulls color, name
 * and code from the Division entity via the DivisionContext.
 */
export default function DivisionIdentityBar() {
  const { activeDivision, isLoading } = useDivision();

  if (isLoading || !activeDivision) return null;

  const color = activeDivision.color || '#2E5A1A';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeDivision.id}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="overflow-hidden"
      >
        {/* Brand color strip */}
        <div className="h-1 w-full" style={{ background: color }} />
        {/* Identity chip */}
        <div className="flex items-center gap-2.5 px-4 py-2 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: color }}>
            <Building2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-sm font-bold text-slate-900 truncate leading-tight">{activeDivision.name}</p>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">{activeDivision.code}</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5 capitalize">{activeDivision.division_type} Division</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: color }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
            </span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide hidden sm:inline">Active</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}