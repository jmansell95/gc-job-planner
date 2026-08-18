import React from 'react';
import { motion } from 'framer-motion';

/** Animated laboratory scene with microscope, test tubes and rising bubbles. */
export default function LabScene({ color = '#7c3aed' }) {
  return (
    <svg viewBox="0 0 280 270" className="w-full h-full drop-shadow-2xl">
      {/* Lab bench */}
      <motion.line x1="20" y1="210" x2="260" y2="210" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.1 }} />
      <rect x="20" y="210" width="240" height="8" fill={`${color}44`} />

      {/* Microscope */}
      <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.7, delay: 0.2 }} style={{ transformOrigin: '90px 210px' }}>
        {/* Base */}
        <ellipse cx="90" cy="208" rx="22" ry="4" fill="white" opacity="0.9" />
        <rect x="75" y="195" width="30" height="14" rx="3" fill="white" />
        {/* Arm */}
        <rect x="85" y="150" width="10" height="50" rx="2" fill="white" />
        {/* Eyepiece */}
        <rect x="82" y="135" width="16" height="18" rx="4" fill={color} stroke="white" strokeWidth="1.5" />
        {/* Lens */}
        <motion.g animate={{ y: [0, 5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}>
          <rect x="84" y="170" width="12" height="14" rx="2" fill="#8DC63F" stroke="white" strokeWidth="1" />
          <circle cx="90" cy="177" r="3" fill="rgba(255,255,255,0.6)" />
        </motion.g>
        {/* Stage */}
        <rect x="72" y="185" width="36" height="6" rx="1" fill="white" />
        {/* Slide on stage */}
        <motion.rect x="84" y="183" width="12" height="3" rx="0.5" fill="#8DC63F"
          animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }} />
      </motion.g>

      {/* Test tube rack */}
      <motion.g initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
        <rect x="160" y="200" width="70" height="12" rx="3" fill="white" opacity="0.85" />
        {[170, 185, 200, 215].map((x, i) => (
          <g key={x}>
            {/* Tube */}
            <path d={`M ${x} 165 L ${x} 198 L ${x + 8} 198 L ${x + 8} 165 Z`} fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5" />
            {/* Liquid */}
            <motion.rect x={x + 1} y={185 - i * 3} width="6" height={13 + i * 3} rx="1"
              fill={['#8DC63F', '#f97316', '#7c3aed', '#0ea5e9'][i]} opacity="0.7"
              animate={{ height: [13 + i * 3, 16 + i * 3, 13 + i * 3], y: [185 - i * 3, 182 - i * 3, 185 - i * 3] }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }} />
            {/* Bubbles rising */}
            {[0, 1].map(b => (
              <motion.circle key={b} cx={x + 4} cy={195} r="1.5" fill="rgba(255,255,255,0.6)"
                animate={{ y: [0, -20 - b * 8], opacity: [0, 1, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: b * 0.6 + i * 0.3 + 0.8, ease: 'easeOut' }} />
            ))}
          </g>
        ))}
      </motion.g>

      {/* Flask (Erlenmeyer) */}
      <motion.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7, duration: 0.5 }} style={{ transformOrigin: '130px 210px' }}>
        <path d="M 125 165 L 125 178 L 112 205 L 148 205 L 135 178 L 135 165 Z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5" />
        {/* Liquid with bubbles */}
        <motion.path d="M 118 195 L 142 195 L 148 205 L 112 205 Z" fill="#8DC63F" opacity="0.6"
          animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
        <motion.circle cx="125" cy="200" r="1.5" fill="rgba(255,255,255,0.7)"
          animate={{ y: [0, -12, -20], opacity: [0, 1, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5, ease: 'easeOut' }} />
        <motion.circle cx="135" cy="200" r="1.5" fill="rgba(255,255,255,0.7)"
          animate={{ y: [0, -15, -22], opacity: [0, 1, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, delay: 1.2, ease: 'easeOut' }} />
      </motion.g>

      {/* Molecule / atom symbol floating */}
      <motion.g animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '230px 140px' }}>
        <ellipse cx="230" cy="140" rx="18" ry="7" fill="none" stroke="rgba(141,198,63,0.5)" strokeWidth="1.5" />
        <ellipse cx="230" cy="140" rx="18" ry="7" fill="none" stroke="rgba(141,198,63,0.5)" strokeWidth="1.5" transform="rotate(60 230 140)" />
        <ellipse cx="230" cy="140" rx="18" ry="7" fill="none" stroke="rgba(141,198,63,0.5)" strokeWidth="1.5" transform="rotate(120 230 140)" />
        <circle cx="230" cy="140" r="4" fill="#8DC63F" />
      </motion.g>
    </svg>
  );
}