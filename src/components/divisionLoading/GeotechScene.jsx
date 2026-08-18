import React from 'react';
import { motion } from 'framer-motion';

/** Animated cable percussion drilling rig with a driller in orange PPE. */
export default function GeotechScene({ color = '#2E5A1A' }) {
  return (
    <svg viewBox="0 0 280 270" className="w-full h-full drop-shadow-2xl">
      {/* Ground */}
      <motion.line x1="20" y1="215" x2="260" y2="215" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5 5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 0.1 }} />
      <motion.ellipse cx="140" cy="216" rx="14" ry="4" fill="rgba(0,0,0,0.5)"
        initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.4, delay: 0.9 }} style={{ transformOrigin: '140px 216px' }} />

      {/* Derrick */}
      <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }} style={{ transformOrigin: '140px 215px' }}>
        <line x1="100" y1="215" x2="132" y2="45" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="180" y1="215" x2="148" y2="45" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="100" y1="215" x2="92" y2="215" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="180" y1="215" x2="188" y2="215" stroke="white" strokeWidth="4" strokeLinecap="round" />
        {[188, 158, 128, 98, 68].map(y => (
          <line key={y} x1={100 + (132 - 100) * (215 - y) / 170} y1={y} x2={180 - (180 - 148) * (215 - y) / 170} y2={y} stroke="white" strokeWidth="2" opacity="0.75" strokeLinecap="round" />
        ))}
        <line x1="103" y1="188" x2="173" y2="158" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="177" y1="188" x2="107" y2="158" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="108" y1="158" x2="168" y2="128" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="172" y1="158" x2="112" y2="128" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="113" y1="128" x2="167" y2="98" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="167" y1="128" x2="113" y2="98" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="117" y1="98" x2="163" y2="68" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="163" y1="98" x2="117" y2="68" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <rect x="130" y="38" width="20" height="12" rx="2" fill="white" />
        <motion.g style={{ transformOrigin: '140px 44px' }} animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: 1 }}>
          <circle cx="140" cy="44" r="5" fill={color} stroke="white" strokeWidth="1.5" />
          <line x1="140" y1="40" x2="140" y2="48" stroke="white" strokeWidth="1.5" />
          <line x1="136" y1="44" x2="144" y2="44" stroke="white" strokeWidth="1.5" />
        </motion.g>
      </motion.g>

      {/* Cable */}
      <motion.line x1="140" y1="50" x2="140" y2="100" stroke="#8DC63F" strokeWidth="2"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.4, delay: 1.0 }} />

      {/* Traveling block + drill string */}
      <motion.g animate={{ y: [0, 35, 12, 35, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 1.2, times: [0, 0.3, 0.5, 0.75, 1] }}>
        <rect x="133" y="98" width="14" height="10" rx="2" fill="#8DC63F" stroke="white" strokeWidth="1" />
        <line x1="140" y1="108" x2="140" y2="200" stroke="#8DC63F" strokeWidth="5" strokeLinecap="round" />
        <line x1="140" y1="108" x2="140" y2="200" stroke="white" strokeWidth="1" opacity="0.3" />
        <motion.g style={{ transformOrigin: '140px 206px' }} animate={{ rotate: 360 }} transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}>
          <polygon points="131,200 149,200 140,214" fill="#8DC63F" stroke="white" strokeWidth="1.2" />
          <line x1="140" y1="200" x2="140" y2="212" stroke="white" strokeWidth="1" opacity="0.6" />
          <circle cx="140" cy="203" r="2" fill="white" opacity="0.5" />
        </motion.g>
      </motion.g>

      {/* Rotary table */}
      <motion.g initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.4, delay: 0.8 }} style={{ transformOrigin: '140px 212px' }}>
        <motion.ellipse cx="140" cy="212" rx="20" ry="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"
          animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear', delay: 1 }} style={{ transformOrigin: '140px 212px' }} />
        <ellipse cx="140" cy="212" rx="10" ry="2.5" fill="rgba(0,0,0,0.3)" />
      </motion.g>

      {/* Spoil */}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <motion.circle key={'spoil' + i} cx={140} cy={210} r="2.5" fill={i % 2 === 0 ? '#a16207' : '#8DC63F'}
          animate={{ x: [0, 18 - i * 3, 22 - i * 4, 0], y: [0, -12 - i * 2, -24 - i * 3, 0], opacity: [0, 0.9, 0.7, 0], scale: [0.4, 1, 0.8, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.25 + 1.4, ease: 'easeOut' }} />
      ))}

      {/* Driller in orange PPE */}
      <motion.g initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7, duration: 0.6, ease: 'easeOut' }}>
        <motion.g animate={{ rotate: [0, -4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} style={{ transformOrigin: '215px 155px' }}>
          <path d="M 205 158 Q 215 146 225 158 L 225 161 L 205 161 Z" fill="#facc15" stroke="white" strokeWidth="0.6" />
          <rect x="203" y="160" width="24" height="2.5" rx="1" fill="#eab308" />
          <line x1="215" y1="148" x2="215" y2="152" stroke="#eab308" strokeWidth="1" />
        </motion.g>
        <circle cx="215" cy="166" r="5.5" fill="#fde68a" stroke="white" strokeWidth="0.5" />
        <line x1="215" y1="171" x2="215" y2="175" stroke="#fde68a" strokeWidth="2.5" />
        <path d="M 207 175 L 223 175 L 225 196 L 205 196 Z" fill="#f97316" stroke="white" strokeWidth="0.8" />
        <line x1="205" y1="184" x2="225" y2="184" stroke="white" strokeWidth="1.5" opacity="0.9" />
        <line x1="206" y1="190" x2="224" y2="190" stroke="white" strokeWidth="1.2" opacity="0.7" />
        <motion.line x1="208" y1="180" x2="196" y2="186" stroke="#f97316" strokeWidth="3.5" strokeLinecap="round"
          animate={{ x2: [196, 191, 196], y2: [186, 183, 186] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
        <motion.circle cx="196" cy="186" r="2.5" fill="#fde68a" stroke="white" strokeWidth="0.4"
          animate={{ cx: [196, 191, 196], cy: [186, 183, 186] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
        <line x1="222" y1="180" x2="230" y2="192" stroke="#f97316" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="230" cy="193" r="2.5" fill="#fde68a" stroke="white" strokeWidth="0.4" />
        <line x1="212" y1="196" x2="210" y2="214" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
        <line x1="218" y1="196" x2="220" y2="214" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="209" cy="215" rx="4" ry="2" fill="#0f172a" />
        <ellipse cx="221" cy="215" rx="4" ry="2" fill="#0f172a" />
      </motion.g>

      {/* Control lever */}
      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.4 }}>
        <rect x="188" y="210" width="14" height="6" rx="1" fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <line x1="195" y1="210" x2="195" y2="188" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" />
        <motion.line x1="195" y1="188" x2="200" y2="182" stroke="#8DC63F" strokeWidth="3" strokeLinecap="round"
          animate={{ x2: [200, 205, 200], y2: [182, 180, 182] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
        <motion.circle cx="200" cy="182" r="3" fill="#8DC63F" stroke="white" strokeWidth="1"
          animate={{ cx: [200, 205, 200], cy: [182, 180, 182] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
      </motion.g>

      {/* Dust */}
      {[0, 1, 2, 3].map(i => (
        <motion.circle key={'dust' + i} cx={95 + i * 12} cy={218} r="1.8" fill="rgba(255,255,255,0.45)"
          animate={{ y: [0, -14, -2], opacity: [0, 0.6, 0], scale: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 + 1.6, ease: 'easeOut' }} />
      ))}
    </svg>
  );
}