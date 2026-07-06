import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Phone } from 'lucide-react';

export default function EndOfDayCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-lg overflow-hidden">
      <div className="p-6 md:p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-white/15 ring-1 ring-white/25 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold mb-2">That's it for the day!</h2>
        <p className="text-emerald-50 text-sm md:text-base max-w-md mx-auto leading-relaxed">
          All your jobs are complete. Please call your line manager for any more updates before heading home for the day.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 ring-1 ring-white/20 rounded-xl text-sm font-semibold">
          <Phone className="w-4 h-4" /> Call your line manager
        </div>
      </div>
    </motion.div>
  );
}