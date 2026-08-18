import React from 'react';
import { motion } from 'framer-motion';

/** Animated environmental scene: growing leaf with falling water drop and ripples. */
export default function EnvironmentalScene({ color = '#0d9488' }) {
  return (
    <svg viewBox="0 0 280 270" className="w-full h-full drop-shadow-2xl">
      {/* Ground / soil */}
      <motion.rect x="20" y="215" width="240" height="12" rx="3" fill={`${color}55`}
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, delay: 0.1 }} style={{ transformOrigin: '140px 221px' }} />
      {/* Grass blades */}
      {[40, 55, 70, 210, 225, 240].map((x, i) => (
        <motion.line key={x} x1={x} y1="215" x2={x} y2="205" stroke="#8DC63F" strokeWidth="2" strokeLinecap="round"
          animate={{ rotate: [0, i % 2 === 0 ? 3 : -3, 0] }}
          transition={{ duration: 2 + i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: `${x}px 215px` }} />
      ))}

      {/* Large leaf — grows from ground */}
      <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }} style={{ transformOrigin: '140px 215px' }}>
        {/* Stem */}
        <line x1="140" y1="215" x2="140" y2="160" stroke="#8DC63F" strokeWidth="3" strokeLinecap="round" />
        {/* Leaf body */}
        <motion.path d="M 140 160 Q 100 120 90 80 Q 120 70 140 100 Q 160 70 190 80 Q 180 120 140 160 Z"
          fill="#8DC63F" stroke="white" strokeWidth="1.5"
          animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '140px 120px' }} />
        {/* Leaf veins */}
        <line x1="140" y1="160" x2="140" y2="85" stroke="white" strokeWidth="1" opacity="0.5" />
        <line x1="140" y1="120" x2="115" y2="100" stroke="white" strokeWidth="0.8" opacity="0.4" />
        <line x1="140" y1="120" x2="165" y2="100" stroke="white" strokeWidth="0.8" opacity="0.4" />
        <line x1="140" y1="140" x2="120" y2="130" stroke="white" strokeWidth="0.8" opacity="0.4" />
        <line x1="140" y1="140" x2="160" y2="130" stroke="white" strokeWidth="0.8" opacity="0.4" />
      </motion.g>

      {/* Water drop falling */}
      <motion.g
        animate={{ y: [0, 60, 60], opacity: [0, 1, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeIn', delay: 1 }}
      >
        <path d="M 200 50 Q 196 58 200 62 Q 204 58 200 50 Z" fill="#0ea5e9" stroke="white" strokeWidth="0.5" />
      </motion.g>

      {/* Ripples on ground where drop lands */}
      {[0, 1, 2].map(i => (
        <motion.ellipse key={i} cx="200" cy="215" rx="4" ry="1.5" fill="none" stroke="rgba(14,165,233,0.6)" strokeWidth="1.5"
          animate={{ rx: [4, 18], ry: [1.5, 5], opacity: [0.7, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5 + 1.5, ease: 'easeOut' }} />
      ))}

      {/* Sun rays */}
      <motion.g animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '60px 60px' }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
          <line key={deg} x1="60" y1="60" x2="60" y2="44" stroke="#facc15" strokeWidth="2" strokeLinecap="round"
            transform={`rotate(${deg} 60 60)`} opacity="0.6" />
        ))}
      </motion.g>
      <motion.circle cx="60" cy="60" r="10" fill="#facc15" stroke="white" strokeWidth="1.5"
        animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />

      {/* Floating particles (seeds/spores) */}
      {[0, 1, 2, 3].map(i => (
        <motion.circle key={i} cx={100 + i * 25} cy={180} r="1.5" fill="rgba(141,198,63,0.5)"
          animate={{ y: [0, -30 - i * 5, -50], x: [0, 5, -5], opacity: [0, 0.8, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 + 1, ease: 'easeOut' }} />
      ))}
    </svg>
  );
}