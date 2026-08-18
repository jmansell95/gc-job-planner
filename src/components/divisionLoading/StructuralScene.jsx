import React from 'react';
import { motion } from 'framer-motion';

/** Animated structural inspection scene: building columns with an inspector. */
export default function StructuralScene({ color = '#7c3aed' }) {
  return (
    <svg viewBox="0 0 280 270" className="w-full h-full drop-shadow-2xl">
      {/* Ground */}
      <motion.line x1="20" y1="220" x2="260" y2="220" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5 5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.1 }} />

      {/* Building structure — columns rise */}
      <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }} style={{ transformOrigin: '140px 220px' }}>
        {/* Foundation */}
        <rect x="55" y="212" width="170" height="10" rx="2" fill={`${color}66`} stroke="white" strokeWidth="1" />
        {/* Columns */}
        {[70, 115, 160, 205].map(x => (
          <g key={x}>
            <rect x={x - 5} y="80" width="10" height="132" fill="white" opacity="0.85" />
            {/* Column fluting */}
            <line x1={x} y1="85" x2={x} y2="210" stroke={color} strokeWidth="0.8" opacity="0.3" />
            {/* Capital (top) */}
            <rect x={x - 8} y="75" width="16" height="6" rx="1" fill="white" />
          </g>
        ))}
        {/* Arch / lintel */}
        <rect x="55" y="68" width="170" height="10" rx="2" fill={color} stroke="white" strokeWidth="1.5" />
        {/* Roof */}
        <motion.path d="M 50 68 L 140 40 L 230 68 Z" fill={`${color}`} stroke="white" strokeWidth="1.5"
          animate={{ opacity: [0.85, 1, 0.85] }} transition={{ duration: 3, repeat: Infinity }} />
      </motion.g>

      {/* Crack being inspected — appears on a column */}
      <motion.g initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 1 }} style={{ strokeDasharray: '100' }}>
        <motion.path d="M 115 100 L 118 120 L 113 140 L 117 160" stroke="#f97316" strokeWidth="2" fill="none" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 1.2 }} />
      </motion.g>
      {/* Inspection marker on crack */}
      <motion.circle cx="115" cy="130" r="6" fill="none" stroke="#f97316" strokeWidth="2"
        animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 1.8 }} style={{ transformOrigin: '115px 130px' }} />

      {/* Inspector with clipboard */}
      <motion.g initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }}>
        {/* Hard hat */}
        <path d="M 230 158 Q 240 148 250 158 L 250 161 L 230 161 Z" fill="#facc15" stroke="white" strokeWidth="0.6" />
        <rect x="228" y="160" width="24" height="2.5" rx="1" fill="#eab308" />
        {/* Head */}
        <circle cx="240" cy="166" r="5" fill="#fde68a" stroke="white" strokeWidth="0.5" />
        {/* Orange PPE torso */}
        <path d="M 233 172 L 247 172 L 249 192 L 231 192 Z" fill="#f97316" stroke="white" strokeWidth="0.8" />
        <line x1="231" y1="180" x2="249" y2="180" stroke="white" strokeWidth="1.2" opacity="0.8" />
        {/* Arm holding clipboard */}
        <motion.line x1="234" y1="176" x2="225" y2="185" stroke="#f97316" strokeWidth="3" strokeLinecap="round"
          animate={{ y2: [185, 182, 185] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
        {/* Clipboard */}
        <rect x="216" y="183" width="14" height="18" rx="1.5" fill="white" stroke={color} strokeWidth="1" />
        <line x1="219" y1="188" x2="227" y2="188" stroke={color} strokeWidth="0.8" opacity="0.5" />
        <line x1="219" y1="192" x2="227" y2="192" stroke={color} strokeWidth="0.8" opacity="0.5" />
        <line x1="219" y1="196" x2="225" y2="196" stroke={color} strokeWidth="0.8" opacity="0.5" />
        {/* Other arm */}
        <line x1="246" y1="176" x2="252" y2="188" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
        {/* Legs */}
        <line x1="237" y1="192" x2="235" y2="210" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="243" y1="192" x2="245" y2="210" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
        <ellipse cx="234" cy="212" rx="3.5" ry="1.5" fill="#0f172a" />
        <ellipse cx="246" cy="212" rx="3.5" ry="1.5" fill="#0f172a" />
      </motion.g>

      {/* Measurement laser from clipboard to crack */}
      <motion.line x1="225" y1="192" x2="118" y2="130" stroke="#8DC63F" strokeWidth="1" strokeDasharray="3 3"
        animate={{ opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 1.5, repeat: Infinity, delay: 2 }} />
    </svg>
  );
}