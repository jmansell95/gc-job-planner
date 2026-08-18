import React from 'react';
import { motion } from 'framer-motion';

/** Animated renewables scene: wind turbine with spinning blades and sun. */
export default function RenewablesScene({ color = '#d97706' }) {
  return (
    <svg viewBox="0 0 280 270" className="w-full h-full drop-shadow-2xl">
      {/* Ground */}
      <motion.line x1="20" y1="220" x2="260" y2="220" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5 5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.1 }} />
      <rect x="20" y="220" width="240" height="8" fill={`${color}33`} />

      {/* Sun with rotating rays */}
      <motion.g animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '60px 60px' }}>
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
          <line key={deg} x1="60" y1="60" x2="60" y2="42" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round"
            transform={`rotate(${deg} 60 60)`} opacity="0.7" />
        ))}
      </motion.g>
      <motion.circle cx="60" cy="60" r="14" fill="#facc15" stroke="white" strokeWidth="2"
        animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />

      {/* Wind turbine tower — rises */}
      <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }} style={{ transformOrigin: '160px 220px' }}>
        <path d="M 155 220 L 157 90 L 163 90 L 165 220 Z" fill="white" opacity="0.9" />
      </motion.g>

      {/* Turbine nacelle + spinning blades */}
      <motion.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8, duration: 0.4 }} style={{ transformOrigin: '160px 85px' }}>
        {/* Nacelle */}
        <rect x="155" y="82" width="14" height="8" rx="2" fill={color} stroke="white" strokeWidth="1.5" />
        {/* Hub */}
        <circle cx="160" cy="86" r="4" fill="white" />
        {/* Spinning blades */}
        <motion.g animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '160px 86px' }}>
          {[0, 120, 240].map(deg => (
            <g key={deg} transform={`rotate(${deg} 160 86)`}>
              <path d="M 160 86 L 158 50 L 162 50 Z" fill="white" stroke="white" strokeWidth="0.5" opacity="0.9" />
              <path d="M 158 50 Q 156 55 159 60 L 161 60 Q 164 55 162 50 Z" fill="white" opacity="0.7" />
            </g>
          ))}
        </motion.g>
      </motion.g>

      {/* Second smaller turbine in background */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} transition={{ delay: 1, duration: 0.5 }}>
        <path d="M 225 220 L 226 140 L 230 140 L 231 220 Z" fill="white" opacity="0.5" />
        <rect x="224" y="137" width="9" height="6" rx="1" fill={color} opacity="0.6" />
        <motion.g animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '228px 140px' }}>
          {[0, 120, 240].map(deg => (
            <line key={deg} x1="228" y1="140" x2="228" y2="120" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5"
              transform={`rotate(${deg} 228 140)`} />
          ))}
        </motion.g>
      </motion.g>

      {/* Solar panels */}
      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.5 }}>
        {[0, 1, 2].map(i => (
          <g key={i} transform={`translate(${40 + i * 25} 200)`}>
            <rect x="0" y="0" width="20" height="12" rx="1" fill="#1e40af" stroke="white" strokeWidth="0.8" opacity="0.8" />
            <line x1="10" y1="0" x2="10" y2="12" stroke="white" strokeWidth="0.5" opacity="0.4" />
            <line x1="0" y1="6" x2="20" y2="6" stroke="white" strokeWidth="0.5" opacity="0.4" />
            {/* Shine effect */}
            <motion.rect x="0" y="0" width="20" height="12" rx="1" fill="rgba(255,255,255,0.2)"
              animate={{ opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }} />
          </g>
        ))}
      </motion.g>

      {/* Wind gust lines */}
      {[0, 1, 2].map(i => (
        <motion.path key={i} d={`M ${90 + i * 10} 110 Q ${110 + i * 10} 108 ${130 + i * 10} 110`}
          stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round"
          animate={{ x: [-30, 30], opacity: [0, 0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }} />
      ))}
    </svg>
  );
}