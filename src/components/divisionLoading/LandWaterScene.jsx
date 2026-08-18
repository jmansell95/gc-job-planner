import React from 'react';
import { motion } from 'framer-motion';

/**
 * Animated water engineering scene — boat on water with sampling rod, PLUS
 * pump station pipework and a turning valve wheel to distinguish 'Water
 * Engineering Solutions' from a generic marine scene.
 */
export default function LandWaterScene({ color = '#0d9488' }) {
  return (
    <svg viewBox="0 0 280 270" className="w-full h-full drop-shadow-2xl">
      {/* Sky / horizon */}
      <motion.line x1="20" y1="180" x2="260" y2="180" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.1 }} />

      {/* Pump station pipework (left side — water engineering element) */}
      <motion.g initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
        {/* Base platform */}
        <rect x="22" y="175" width="40" height="8" rx="2" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        {/* Vertical pipe */}
        <rect x="30" y="140" width="6" height="38" rx="1" fill="rgba(255,255,255,0.6)" />
        {/* Horizontal pipe */}
        <rect x="30" y="140" width="28" height="6" rx="1" fill="rgba(255,255,255,0.6)" />
        {/* Pipe joint */}
        <circle cx="33" cy="143" r="3" fill="rgba(255,255,255,0.5)" />
        {/* Valve wheel — turning */}
        <motion.g style={{ transformOrigin: '58px 143px' }} animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: 0.8 }}>
          <circle cx="58" cy="143" r="6" fill="none" stroke="white" strokeWidth="2" />
          <line x1="52" y1="143" x2="64" y2="143" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1="58" y1="137" x2="58" y2="149" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1="54" y1="139" x2="62" y2="147" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="62" y1="139" x2="54" y2="147" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <circle cx="58" cy="143" r="1.5" fill={color} />
        </motion.g>
        {/* Gauge */}
        <circle cx="46" cy="155" r="5" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1" />
        <motion.line x1="46" y1="155" x2="49" y2="152" stroke={color} strokeWidth="1.5" strokeLinecap="round"
          animate={{ rotate: [0, 30, -20, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1 }} style={{ transformOrigin: '46px 155px' }} />
        <circle cx="46" cy="155" r="1" fill="white" />
        {/* Water flowing from pipe outlet */}
        {[0, 1, 2].map(i => (
          <motion.circle key={'pflow' + i} cx={58} cy={150} r="1.5" fill="rgba(141,198,63,0.7)"
            animate={{ y: [0, 15, 30], opacity: [0.8, 0.6, 0], scale: [0.8, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 + 1, ease: 'easeIn' }} />
        ))}
      </motion.g>

      {/* Water layers — animated waves */}
      {[0, 1, 2].map(layer => (
        <motion.path
          key={layer}
          d={`M 20 ${200 + layer * 12} Q 60 ${192 + layer * 12} 100 ${200 + layer * 12} T 180 ${200 + layer * 12} T 260 ${200 + layer * 12}`}
          stroke={`rgba(141,198,63,${0.5 - layer * 0.12})`}
          strokeWidth="2.5" fill="none" strokeLinecap="round"
          animate={{ x: [0, -20, 0] }}
          transition={{ duration: 2 + layer * 0.5, repeat: Infinity, ease: 'easeInOut', delay: layer * 0.2 }}
        />
      ))}
      {/* Water fill */}
      <rect x="20" y="200" width="240" height="60" fill={`${color}33`} rx="4" />

      {/* Boat hull — rises on waves */}
      <motion.g animate={{ y: [0, -6, 0, -4, 0], rotate: [0, 1.5, 0, -1, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }} style={{ transformOrigin: '160px 185px' }}>
        {/* Hull */}
        <motion.path d="M 115 185 L 205 185 L 195 205 L 125 205 Z" fill="white" stroke={color} strokeWidth="2"
          initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }} style={{ transformOrigin: '160px 195px' }} />
        {/* Cabin */}
        <rect x="145" y="165" width="30" height="20" rx="2" fill={`${color}`} stroke="white" strokeWidth="1.5" />
        <rect x="150" y="169" width="9" height="8" rx="1" fill="rgba(255,255,255,0.5)" />
        <rect x="162" y="169" width="9" height="8" rx="1" fill="rgba(255,255,255,0.5)" />
        {/* Mast */}
        <line x1="160" y1="165" x2="160" y2="120" stroke="white" strokeWidth="2" strokeLinecap="round" />
        {/* Flag */}
        <motion.path d="M 160 122 L 178 128 L 160 134 Z" fill="#f97316"
          animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '160px 128px' }} />
      </motion.g>

      {/* Sampling rod going into water */}
      <motion.g animate={{ y: [0, 15, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}>
        <line x1="220" y1="160" x2="220" y2="220" stroke="#8DC63F" strokeWidth="3" strokeLinecap="round" />
        <circle cx="220" cy="158" r="4" fill="#8DC63F" stroke="white" strokeWidth="1" />
        {/* Sample bottle at bottom */}
        <motion.rect x="215" y="218" width="10" height="14" rx="2" fill="rgba(255,255,255,0.8)" stroke="white" strokeWidth="1"
          animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.5, repeat: Infinity, delay: 1 }} />
      </motion.g>

      {/* Ripples around sampling point */}
      {[0, 1, 2].map(i => (
        <motion.ellipse key={i} cx="220" cy="205" rx="8" ry="2.5" fill="none" stroke="rgba(141,198,63,0.5)" strokeWidth="1.5"
          animate={{ rx: [8, 22], ry: [2.5, 6], opacity: [0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 + 1, ease: 'easeOut' }} />
      ))}

      {/* Buoys floating */}
      {[80, 250].map((x, i) => (
        <motion.g key={x} animate={{ y: [0, -4, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}>
          <circle cx={x} cy="198" r="5" fill="#f97316" stroke="white" strokeWidth="1.5" />
          <line x1={x} y1="193" x2={x} y2="187" stroke="white" strokeWidth="1.5" />
          <circle cx={x} cy="185" r="2" fill="white" />
        </motion.g>
      ))}

      {/* Water drops / splash */}
      {[0, 1, 2].map(i => (
        <motion.circle key={'drop' + i} cx={220} cy={200} r="2" fill="rgba(141,198,63,0.8)"
          animate={{ y: [0, -20, 0], opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 + 1.5, ease: 'easeOut' }} />
      ))}
    </svg>
  );
}