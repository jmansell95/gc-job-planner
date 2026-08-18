import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Phone, PartyPopper } from 'lucide-react';

// Celebratory end-of-day card — gradient hero with confetti accent.
export default function EndOfDayCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="relative rounded-3xl overflow-hidden shadow-2xl shadow-[#2E5A1A]/30 glow-brand">
      {/* Gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2E5A1A] via-[#3a7a24] to-[#1c4a12]" />
      {/* Decorative glows */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#8DC63F]/20 blur-3xl" />
      <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-[#8DC63F]/15 blur-2xl" />

      <div className="relative p-6 md:p-8 text-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm animate-float">
          <PartyPopper className="w-8 h-8 text-white" strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold mb-2 tracking-tight">That's a wrap!</h2>
        <p className="text-emerald-50/90 text-sm md:text-base max-w-md mx-auto leading-relaxed">
          All your jobs are complete. Give your line manager a quick call for any updates before heading home.
        </p>
        <a href="tel:" className="mt-5 inline-flex items-center gap-2 px-5 py-3 bg-white/15 hover:bg-white/25 ring-1 ring-white/20 rounded-xl text-sm font-semibold backdrop-blur-sm transition touch-manipulation">
          <Phone className="w-4 h-4" strokeWidth={2.5} /> Call your line manager
        </a>
      </div>
    </motion.div>
  );
}