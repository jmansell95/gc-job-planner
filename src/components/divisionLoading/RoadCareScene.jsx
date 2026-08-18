import React from 'react';
import { motion } from 'framer-motion';

/**
 * Animated road maintenance scene — road roller compacting tarmac, pothole
 * patching crew with a jackhammer, traffic cones & barriers, steam rising
 * from hot asphalt. Built to the same quality bar as GeotechScene (~3.8s).
 */
export default function RoadCareScene({ color = '#ea580c' }) {
  return (
    <svg viewBox="0 0 280 270" className="w-full h-full drop-shadow-2xl">
      {/* Road surface */}
      <motion.rect x="20" y="195" width="240" height="40" rx="3" fill="rgba(30,41,59,0.85)"
        initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1 }} style={{ transformOrigin: '140px 215px' }} />
      {/* Road centre line dashes */}
      {[0, 1, 2, 3].map(i => (
        <motion.rect key={'dash' + i} x={50 + i * 55} y="213" width="28" height="3" rx="1" fill="rgba(255,255,255,0.7)"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.4 + i * 0.08 }} />
      ))}

      {/* Steam rising from hot asphalt patch */}
      {[0, 1, 2, 3].map(i => (
        <motion.g key={'steam' + i}>
          <motion.circle cx={95 + i * 8} cy={195} r="3" fill="rgba(255,255,255,0.5)"
            animate={{ y: [0, -30 - i * 5, -50], opacity: [0, 0.6, 0], scale: [0.5, 1.2, 0.3], x: [0, 3, -2] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 + 0.8, ease: 'easeOut' }} />
          <motion.circle cx={99 + i * 8} cy={195} r="2.5" fill="rgba(255,255,255,0.4)"
            animate={{ y: [0, -25 - i * 4, -45], opacity: [0, 0.5, 0], scale: [0.5, 1, 0.3], x: [0, -3, 2] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 + 1.0, ease: 'easeOut' }} />
        </motion.g>
      ))}

      {/* Hot asphalt patch (glowing) */}
      <motion.ellipse cx="105" cy="200" rx="22" ry="6" fill={color} opacity="0.8"
        animate={{ opacity: [0.6, 0.9, 0.6] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.ellipse cx="105" cy="200" rx="18" ry="4" fill="#fbbf24" opacity="0.5"
        animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />

      {/* Traffic cones */}
      {[0, 1, 2].map(i => (
        <motion.g key={'cone' + i} initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4, delay: 0.5 + i * 0.15 }}>
          <ellipse cx={45 + i * 12} cy="218" rx="5" ry="1.5" fill="rgba(0,0,0,0.3)" />
          <polygon points={`${40 + i * 12},218 ${50 + i * 12},218 ${45 + i * 12},198`} fill="#f97316" stroke="white" strokeWidth="1" />
          <rect x={41 + i * 12} y="208" width="8" height="2.5" fill="white" />
          <rect x={42 + i * 12} y="203" width="6" height="2" fill="white" />
        </motion.g>
      ))}

      {/* Barrier board */}
      <motion.g initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }}>
        <rect x="20" y="195" width="3" height="25" fill="#475569" />
        <rect x="14" y="188" width="16" height="8" rx="1" fill="#f97316" stroke="white" strokeWidth="0.8" />
        <line x1="14" y1="192" x2="30" y2="192" stroke="white" strokeWidth="1.5" />
      </motion.g>

      {/* Road roller — moves forward, drum rotates */}
      <motion.g initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }}>
        <motion.g animate={{ x: [0, 8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}>
          {/* Roller drum (front) */}
          <motion.circle cx="195" cy="210" r="14" fill="#475569" stroke="white" strokeWidth="1.5"
            style={{ transformOrigin: '195px 210px' }} animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: 1 }} />
          <motion.circle cx="195" cy="210" r="14" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="4 4"
            style={{ transformOrigin: '195px 210px' }} animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: 1 }} />
          <circle cx="195" cy="210" r="4" fill="#1e293b" stroke="white" strokeWidth="1" />
          {/* Drum frame */}
          <line x1="195" y1="196" x2="195" y2="180" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          {/* Body */}
          <rect x="170" y="170" width="40" height="18" rx="3" fill={color} stroke="white" strokeWidth="1.5" />
          <rect x="174" y="173" width="14" height="8" rx="1" fill="rgba(255,255,255,0.4)" />
          <rect x="192" y="173" width="14" height="8" rx="1" fill="rgba(255,255,255,0.4)" />
          {/* Cab/roof */}
          <rect x="175" y="160" width="30" height="12" rx="2" fill="#475569" stroke="white" strokeWidth="1" />
          <rect x="180" y="162" width="20" height="7" rx="1" fill="rgba(141,198,63,0.5)" />
          {/* Rear wheel */}
          <circle cx="175" cy="210" r="8" fill="#1e293b" stroke="white" strokeWidth="1.5" />
          <motion.circle cx="175" cy="210" r="8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 3"
            style={{ transformOrigin: '175px 210px' }} animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: 1 }} />
          {/* Exhaust pipe */}
          <line x1="168" y1="170" x2="162" y2="155" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          {/* Exhaust puff */}
          <motion.circle cx="162" cy="153" r="3" fill="rgba(255,255,255,0.4)"
            animate={{ y: [0, -15, -25], opacity: [0, 0.5, 0], scale: [0.5, 1.5, 0.3] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: 1.5, ease: 'easeOut' }} />
        </motion.g>
      </motion.g>

      {/* Pothole patching crew with jackhammer */}
      <motion.g initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.8 }}>
        {/* Worker body */}
        <motion.g animate={{ y: [0, 1.5, 0] }} transition={{ duration: 0.15, repeat: Infinity, ease: 'easeInOut' }}>
          {/* Hard hat */}
          <path d="M 88 168 Q 96 160 104 168 L 104 170 L 88 170 Z" fill="#facc15" stroke="white" strokeWidth="0.6" />
          <rect x="86" y="169" width="20" height="2.5" rx="1" fill="#eab308" />
          {/* Head */}
          <circle cx="96" cy="174" r="4.5" fill="#fde68a" stroke="white" strokeWidth="0.5" />
          {/* Hi-vis vest */}
          <path d="M 88 179 L 104 179 L 106 198 L 86 198 Z" fill={color} stroke="white" strokeWidth="0.8" />
          <line x1="88" y1="186" x2="104" y2="186" stroke="white" strokeWidth="1.5" opacity="0.9" />
          <line x1="89" y1="192" x2="103" y2="192" stroke="white" strokeWidth="1.2" opacity="0.7" />
          {/* Legs */}
          <line x1="92" y1="198" x2="90" y2="214" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
          <line x1="100" y1="198" x2="102" y2="214" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="90" cy="215" rx="3.5" ry="1.8" fill="#0f172a" />
          <ellipse cx="102" cy="215" rx="3.5" ry="1.8" fill="#0f172a" />
        </motion.g>

        {/* Jackhammer (vibrating) */}
        <motion.g animate={{ x: [0, 1.5, -1.5, 0], y: [0, 1, 0] }} transition={{ duration: 0.08, repeat: Infinity, ease: 'easeInOut' }}>
          {/* Handle */}
          <rect x="78" y="182" width="14" height="4" rx="2" fill="#475569" stroke="white" strokeWidth="0.8" />
          {/* Body */}
          <rect x="80" y="186" width="10" height="16" rx="2" fill="#64748b" stroke="white" strokeWidth="1" />
          {/* Bit going into ground */}
          <polygon points="82,202 88,202 85,212" fill="#1e293b" stroke="white" strokeWidth="0.6" />
          {/* Vibration lines */}
          <motion.line x1="75" y1="190" x2="70" y2="188" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"
            animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 0.1, repeat: Infinity }} />
          <motion.line x1="75" y1="194" x2="70" y2="194" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"
            animate={{ opacity: [0, 0.8, 0] }} transition={{ duration: 0.1, repeat: Infinity, delay: 0.05 }} />
        </motion.g>

        {/* Debris flying from jackhammer */}
        {[0, 1, 2].map(i => (
          <motion.circle key={'debris' + i} cx={85} cy={210} r="1.5" fill="#a16207"
            animate={{ x: [0, -8 - i * 3, -15], y: [0, -10 - i * 2, -5], opacity: [0, 0.9, 0], scale: [0.5, 1, 0.3] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 + 1, ease: 'easeOut' }} />
        ))}
      </motion.g>

      {/* Dust particles near roller */}
      {[0, 1, 2].map(i => (
        <motion.circle key={'rdust' + i} cx={210 + i * 8} cy={218} r="1.5" fill="rgba(255,255,255,0.4)"
          animate={{ y: [0, -10, -2], opacity: [0, 0.5, 0], scale: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 + 1.5, ease: 'easeOut' }} />
      ))}
    </svg>
  );
}