import React from 'react';
import { motion } from 'framer-motion';

/** Animated excavator digging with an operator in the cab. */
export default function InfrastructureScene({ color = '#2563eb' }) {
  return (
    <svg viewBox="0 0 280 270" className="w-full h-full drop-shadow-2xl">
      {/* Ground */}
      <motion.line x1="20" y1="220" x2="260" y2="220" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5 5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.1 }} />

      {/* Tracks */}
      <motion.g initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }} style={{ transformOrigin: '100px 215px' }}>
        <rect x="55" y="205" width="90" height="16" rx="8" fill="#334155" stroke="white" strokeWidth="1.5" />
        {/* Track rollers */}
        {[70, 90, 110, 130].map(x => (
          <circle key={x} cx={x} cy="213" r="5" fill="#475569" stroke="white" strokeWidth="1" />
        ))}
        {/* Moving track segments */}
        <motion.g animate={{ x: [0, 12, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
          {[60, 72, 84, 96, 108, 120, 132].map(x => (
            <line key={x} x1={x} y1="205" x2={x + 4} y2="205" stroke="white" strokeWidth="1" opacity="0.4" />
          ))}
        </motion.g>
      </motion.g>

      {/* Cab */}
      <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.35 }} style={{ transformOrigin: '100px 205px' }}>
        <rect x="75" y="165" width="50" height="40" rx="4" fill={color} stroke="white" strokeWidth="2" />
        {/* Window */}
        <rect x="82" y="172" width="36" height="18" rx="2" fill="rgba(255,255,255,0.7)" />
        {/* Operator silhouette in cab */}
        <circle cx="100" cy="182" r="4" fill="#fde68a" />
        <rect x="96" y="186" width="8" height="10" rx="2" fill="#f97316" />
        {/* Exhaust stack */}
        <rect x="120" y="150" width="4" height="18" fill="#475569" />
        <motion.g animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <circle cx="124" cy="148" r="3" fill="rgba(255,255,255,0.4)" />
          <circle cx="128" cy="142" r="4" fill="rgba(255,255,255,0.3)" />
          <circle cx="132" cy="134" r="5" fill="rgba(255,255,255,0.2)" />
        </motion.g>
      </motion.g>

      {/* Boom arm — reaches out and digs */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.4 }}>
        {/* Boom (main arm) */}
        <motion.g
          animate={{ rotate: [5, -8, 5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          style={{ transformOrigin: '125px 175px' }}
        >
          <line x1="125" y1="175" x2="185" y2="145" stroke="white" strokeWidth="5" strokeLinecap="round" />
          {/* Stick (second arm) */}
          <motion.g
            animate={{ rotate: [0, 15, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
            style={{ transformOrigin: '185px 145px' }}
          >
            <line x1="185" y1="145" x2="210" y2="195" stroke="white" strokeWidth="4" strokeLinecap="round" />
            {/* Bucket */}
            <motion.g animate={{ y: [0, 8, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}>
              <path d="M 205 195 L 220 195 L 218 208 L 207 208 Z" fill="#facc15" stroke="white" strokeWidth="1.5" />
              <line x1="207" y1="208" x2="205" y2="213" stroke="white" strokeWidth="1" />
              <line x1="211" y1="208" x2="210" y2="213" stroke="white" strokeWidth="1" />
              <line x1="215" y1="208" x2="215" y2="213" stroke="white" strokeWidth="1" />
              <line x1="219" y1="208" x2="221" y2="213" stroke="white" strokeWidth="1" />
            </motion.g>
          </motion.g>
          {/* Hydraulic cylinder */}
          <line x1="130" y1="170" x2="160" y2="155" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
        </motion.g>
      </motion.g>

      {/* Dirt pile being excavated */}
      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.5 }}>
        <path d="M 225 220 Q 235 210 250 220 L 255 222 L 220 222 Z" fill="#a16207" opacity="0.7" />
      </motion.g>

      {/* Flying dirt clods */}
      {[0, 1, 2].map(i => (
        <motion.circle key={i} cx={215} cy={200} r="2.5" fill="#a16207"
          animate={{ x: [0, 10 + i * 5, 20 + i * 8], y: [0, -15 - i * 3, -5], opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 + 1.5, ease: 'easeOut' }} />
      ))}

      {/* Warning barrier (cones) */}
      {[40, 250].map(x => (
        <motion.g key={x} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          <path d={`M ${x} 220 L ${x + 8} 220 L ${x + 6} 208 L ${x + 2} 208 Z`} fill="#f97316" stroke="white" strokeWidth="1" />
          <line x1={x - 1} y1="220" x2={x + 9} y2="220" stroke="white" strokeWidth="1.5" />
        </motion.g>
      ))}
    </svg>
  );
}