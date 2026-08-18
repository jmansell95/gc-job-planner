import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * DivisionLoadingScreen — full-screen animated splash shown when entering
 * the Geotechnical drilling division. Features an animated SVG of a man
 * operating a drilling rig with a rotating drill bit, dust particles, and
 * a progress bar. Calls onComplete when the animation finishes.
 */
export default function DivisionLoadingScreen({ division, onComplete, duration = 2400 }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 30);
    return () => clearInterval(interval);
  }, [duration, onComplete]);

  const divColor = division?.color || '#2E5A1A';
  const divName = division?.name || 'Geotechnical';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(150deg, ${divColor} 0%, ${divColor}dd 45%, #0a120a 100%)` }}
    >
      {/* Ambient glow */}
      <motion.div
        className="absolute w-96 h-96 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(141,198,63,0.25) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.7, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Animated drilling rig SVG */}
      <div className="relative w-64 h-64 mb-6 z-10">
        <svg viewBox="0 0 240 240" className="w-full h-full drop-shadow-2xl">
          {/* Ground line */}
          <motion.line
            x1="20" y1="195" x2="220" y2="195"
            stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeDasharray="4 4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          />

          {/* Derrick tower — rises from ground */}
          <motion.g
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
            style={{ transformOrigin: '120px 195px' }}
          >
            {/* Tower legs (V shape) */}
            <line x1="88" y1="195" x2="112" y2="55" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="152" y1="195" x2="128" y2="55" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            {/* Horizontal cross-braces */}
            <line x1="93" y1="172" x2="147" y2="172" stroke="white" strokeWidth="2" opacity="0.7" strokeLinecap="round" />
            <line x1="99" y1="142" x2="141" y2="142" stroke="white" strokeWidth="2" opacity="0.7" strokeLinecap="round" />
            <line x1="105" y1="112" x2="135" y2="112" stroke="white" strokeWidth="2" opacity="0.7" strokeLinecap="round" />
            <line x1="109" y1="82" x2="131" y2="82" stroke="white" strokeWidth="2" opacity="0.7" strokeLinecap="round" />
            {/* X braces */}
            <line x1="93" y1="172" x2="141" y2="142" stroke="white" strokeWidth="1.5" opacity="0.45" />
            <line x1="147" y1="172" x2="99" y2="142" stroke="white" strokeWidth="1.5" opacity="0.45" />
            <line x1="99" y1="142" x2="135" y2="112" stroke="white" strokeWidth="1.5" opacity="0.45" />
            <line x1="141" y1="142" x2="105" y2="112" stroke="white" strokeWidth="1.5" opacity="0.45" />
            <line x1="105" y1="112" x2="131" y2="82" stroke="white" strokeWidth="1.5" opacity="0.45" />
            <line x1="135" y1="112" x2="109" y2="82" stroke="white" strokeWidth="1.5" opacity="0.45" />
            {/* Crown block (top pulley) */}
            <rect x="115" y="48" width="10" height="10" rx="2" fill="white" />
            <circle cx="120" cy="53" r="3" fill={divColor} />
          </motion.g>

          {/* Drill string — oscillates up and down */}
          <motion.g
            animate={{ y: [0, 18, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          >
            <line x1="120" y1="58" x2="120" y2="178" stroke="#8DC63F" strokeWidth="4" strokeLinecap="round" />
            {/* Drill bit — rotating */}
            <motion.g
              style={{ transformOrigin: '120px 183px' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'linear', delay: 0.8 }}
            >
              <polygon points="113,178 127,178 120,193" fill="#8DC63F" stroke="white" strokeWidth="1" />
              <line x1="120" y1="178" x2="120" y2="190" stroke="white" strokeWidth="1" opacity="0.5" />
            </motion.g>
          </motion.g>

          {/* Man figure — walks in and operates the rig */}
          <motion.g
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
          >
            {/* Hard hat */}
            <motion.g
              animate={{ rotate: [0, -3, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
              style={{ transformOrigin: '182px 140px' }}
            >
              <path d="M 174 142 Q 182 132 190 142 L 190 145 L 174 145 Z" fill="#fbbf24" stroke="white" strokeWidth="0.5" />
              <rect x="172" y="144" width="20" height="2" rx="1" fill="#f59e0b" />
            </motion.g>
            {/* Head */}
            <circle cx="182" cy="150" r="5" fill="#fde68a" stroke="white" strokeWidth="0.5" />
            {/* Body */}
            <line x1="182" y1="156" x2="182" y2="175" stroke="white" strokeWidth="3" strokeLinecap="round" />
            {/* Left arm — reaches toward the rig controls */}
            <motion.line
              x1="182" y1="162" x2="168" y2="158"
              stroke="white" strokeWidth="2.5" strokeLinecap="round"
              animate={{ x2: [168, 164, 168], y2: [158, 156, 158] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
            />
            {/* Right arm */}
            <line x1="182" y1="162" x2="192" y2="170" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            {/* Legs — slight walking sway */}
            <motion.g
              animate={{ rotate: [0, 2, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
              style={{ transformOrigin: '182px 175px' }}
            >
              <line x1="182" y1="175" x2="174" y2="192" stroke="white" strokeWidth="3" strokeLinecap="round" />
              <line x1="182" y1="175" x2="190" y2="192" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </motion.g>
          </motion.g>

          {/* Dust / ground particles */}
          {[0, 1, 2, 3, 4].map(i => (
            <motion.circle
              key={i}
              cx={85 + i * 14}
              cy={198}
              r="2"
              fill="rgba(255,255,255,0.5)"
              animate={{
                y: [0, -18, -2],
                x: [0, -3, 0],
                opacity: [0, 0.7, 0],
                scale: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 1.3,
                repeat: Infinity,
                delay: i * 0.18 + 1,
                ease: 'easeOut'
              }}
            />
          ))}
        </svg>
      </div>

      {/* Division name */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xl font-extrabold text-white tracking-tight mb-1 z-10"
      >
        Entering {divName}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-white/60 font-medium mb-6 z-10"
      >
        Ground Investigation Specialists
      </motion.p>

      {/* Progress bar */}
      <div className="w-56 h-1.5 bg-white/15 rounded-full overflow-hidden z-10">
        <div
          className="h-full bg-gradient-to-r from-[#8DC63F] to-white rounded-full transition-all duration-75 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-white/40 font-semibold mt-2 tabular-nums z-10">{Math.round(progress)}%</p>
    </motion.div>
  );
}