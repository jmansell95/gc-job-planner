import React from 'react';
import { motion } from 'framer-motion';

/** Animated surveying scene: theodolite on a tripod with a scanning laser beam. */
export default function SurveysScene({ color = '#2563eb' }) {
  return (
    <svg viewBox="0 0 280 270" className="w-full h-full drop-shadow-2xl">
      {/* Ground */}
      <motion.line x1="20" y1="220" x2="260" y2="220" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5 5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.1 }} />

      {/* Tripod */}
      <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.15 }} style={{ transformOrigin: '140px 220px' }}>
        <line x1="140" y1="220" x2="120" y2="160" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <line x1="140" y1="220" x2="160" y2="160" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <line x1="140" y1="220" x2="140" y2="155" stroke="white" strokeWidth="3" strokeLinecap="round" />
        {/* Tripod feet */}
        <circle cx="120" cy="220" r="3" fill="white" />
        <circle cx="160" cy="220" r="3" fill="white" />
        <circle cx="140" cy="220" r="3" fill="white" />
      </motion.g>

      {/* Theodolite body */}
      <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }} style={{ transformOrigin: '140px 150px' }}>
        {/* Base */}
        <rect x="128" y="148" width="24" height="10" rx="2" fill={color} stroke="white" strokeWidth="1.5" />
        {/* Turret */}
        <motion.g animate={{ rotate: [0, 30, -20, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }} style={{ transformOrigin: '140px 145px' }}>
          <rect x="130" y="132" width="20" height="18" rx="3" fill="white" />
          {/* Telescope */}
          <rect x="135" y="120" width="35" height="8" rx="3" fill={color} stroke="white" strokeWidth="1.5" />
          <circle cx="168" cy="124" r="4" fill="rgba(255,255,255,0.6)" stroke="white" strokeWidth="1" />
          {/* Display */}
          <rect x="132" y="136" width="8" height="6" rx="1" fill="#8DC63F" />
          {/* Laser beam from telescope */}
          <motion.line x1="170" y1="124" x2="240" y2="100" stroke="#8DC63F" strokeWidth="2" strokeLinecap="round"
            animate={{ opacity: [0.2, 0.8, 0.2] }} transition={{ duration: 1.5, repeat: Infinity, delay: 1 }} />
          <motion.circle cx="240" cy="100" r="3" fill="#8DC63F"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity, delay: 1 }} />
        </motion.g>
      </motion.g>

      {/* Survey target pole (reflector) */}
      <motion.g initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8, duration: 0.5 }}>
        <line x1="240" y1="220" x2="240" y2="95" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        {/* Target prisms */}
        <motion.circle cx="240" cy="100" r="5" fill="#f97316" stroke="white" strokeWidth="1.5"
          animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.5, repeat: Infinity, delay: 1 }} />
        <circle cx="240" cy="115" r="3" fill="white" opacity="0.6" />
      </motion.g>

      {/* Measurement points appearing on ground */}
      {[50, 80, 200].map((x, i) => (
        <motion.g key={x} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.5] }} transition={{ delay: 1 + i * 0.4, duration: 0.5 }}>
          <circle cx={x} cy="220" r="3" fill="#8DC63F" />
          <circle cx={x} cy="220" r="6" fill="none" stroke="#8DC63F" strokeWidth="1" opacity="0.5" />
        </motion.g>
      ))}

      {/* Grid lines (survey grid) */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.15 }} transition={{ delay: 1.2, duration: 0.5 }}>
        {[80, 120, 160, 200].map(x => (
          <line key={x} x1={x} y1="220" x2={x} y2="180" stroke="white" strokeWidth="0.5" strokeDasharray="2 3" />
        ))}
        <line x1="40" y1="200" x2="240" y2="200" stroke="white" strokeWidth="0.5" strokeDasharray="2 3" />
      </motion.g>

      {/* Data readout floating */}
      <motion.g animate={{ y: [0, -5, 0], opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}>
        <rect x="195" y="60" width="50" height="22" rx="3" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <text x="220" y="70" textAnchor="middle" fill="#8DC63F" fontSize="7" fontFamily="monospace" fontWeight="bold">N 51.48°</text>
        <text x="220" y="78" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="6" fontFamily="monospace">E 0.00°</text>
      </motion.g>
    </svg>
  );
}