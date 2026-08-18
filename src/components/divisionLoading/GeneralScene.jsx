import React from 'react';
import { motion } from 'framer-motion';

/** Animated general construction scene: hard hat with crossed tools and a spinning gear. */
export default function GeneralScene({ color = '#475569' }) {
  return (
    <svg viewBox="0 0 280 270" className="w-full h-full drop-shadow-2xl">
      {/* Ground */}
      <motion.line x1="20" y1="220" x2="260" y2="220" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5 5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.1 }} />

      {/* Large spinning gear (background) */}
      <motion.g animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '140px 130px' }} opacity="0.15">
        <circle cx="140" cy="130" r="50" fill="none" stroke="white" strokeWidth="3" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
          <rect key={deg} x="136" y="72" width="8" height="14" rx="1" fill="white" transform={`rotate(${deg} 140 130)`} />
        ))}
        <circle cx="140" cy="130" r="12" fill="none" stroke="white" strokeWidth="3" />
      </motion.g>

      {/* Hard hat — drops in */}
      <motion.g initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}>
        <motion.g animate={{ rotate: [0, -3, 0, 3, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '140px 130px' }}>
          {/* Hat dome */}
          <path d="M 110 130 Q 140 85 170 130 Z" fill="#facc15" stroke="white" strokeWidth="2" />
          {/* Hat brim */}
          <ellipse cx="140" cy="132" rx="38" ry="8" fill="#eab308" stroke="white" strokeWidth="1.5" />
          {/* Ridge */}
          <line x1="140" y1="92" x2="140" y2="130" stroke="#eab308" strokeWidth="2" opacity="0.5" />
          {/* Logo plate */}
          <rect x="132" y="115" width="16" height="8" rx="1" fill={color} stroke="white" strokeWidth="0.8" />
        </motion.g>
      </motion.g>

      {/* Crossed wrench and hammer — slide in */}
      <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }} style={{ transformOrigin: '140px 185px' }}>
        {/* Wrench (left) */}
        <motion.g animate={{ rotate: [-5, 5, -5] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '140px 185px' }}>
          <g transform="rotate(-20 140 185)">
            <rect x="136" y="160" width="8" height="50" rx="2" fill="white" />
            <path d="M 130 158 L 130 168 L 136 164 L 136 156 Z M 144 156 L 144 164 L 150 168 L 150 158 Z" fill="white" />
          </g>
        </motion.g>
        {/* Hammer (right) */}
        <motion.g animate={{ rotate: [5, -5, 5] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '140px 185px' }}>
          <g transform="rotate(20 140 185)">
            <rect x="136" y="160" width="8" height="50" rx="2" fill="white" />
            <rect x="128" y="155" width="24" height="12" rx="2" fill="#f97316" stroke="white" strokeWidth="1" />
          </g>
        </motion.g>
      </motion.g>

      {/* Tool belt / measuring tape */}
      <motion.g initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.4 }}>
        <ellipse cx="140" cy="215" rx="45" ry="6" fill={color} stroke="white" strokeWidth="1.5" opacity="0.7" />
        <rect x="125" y="210" width="30" height="8" rx="2" fill="#f97316" stroke="white" strokeWidth="1" />
        <circle cx="140" cy="214" r="3" fill="white" />
      </motion.g>

      {/* Sparks / particles */}
      {[0, 1, 2, 3, 4].map(i => (
        <motion.circle key={i} cx={100 + i * 20} cy={185} r="1.5" fill="#facc15"
          animate={{ y: [0, -15 - i * 3], opacity: [0, 0.8, 0], scale: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 + 1.2, ease: 'easeOut' }} />
      ))}

      {/* Blueprint lines (faint background grid) */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.08 }} transition={{ delay: 0.5, duration: 0.5 }}>
        {[60, 100, 180, 220].map(x => (
          <line key={x} x1={x} y1="40" x2={x} y2="220" stroke="white" strokeWidth="0.5" />
        ))}
        {[60, 100, 160, 200].map(y => (
          <line key={y} x1="40" y1={y} x2="240" y2={y} stroke="white" strokeWidth="0.5" />
        ))}
      </motion.g>
    </svg>
  );
}