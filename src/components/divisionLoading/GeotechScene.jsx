import React from 'react';
import { motion } from 'framer-motion';

/**
 * Detailed cable percussion drilling rig scene.
 * Semi-realistic side elevation with:
 *  - Tripod mast with proper cross-bracing and winch
 *  - Rotating drill string with casing tubes
 *  - Driller figure in orange hi-vis vest, white hard hat, gloves
 *  - Dust/spoil particles, ground surface
 */
export default function GeotechScene({ color = '#2E5A1A' }) {
  const accent = '#8DC63F';
  const steel = '#94a3b8';
  const darkSteel = '#475569';
  const hiVis = '#f97316';
  const hiVisDark = '#ea580c';
  const skin = '#fde68a';
  const hatColor = '#f8fafc';

  return (
    <svg viewBox="0 0 280 270" className="w-full h-full drop-shadow-2xl">
      {/* === Ground surface === */}
      <motion.line x1="15" y1="218" x2="265" y2="218" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeDasharray="6 4"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.1 }} />
      <motion.ellipse cx="140" cy="220" rx="16" ry="4" fill="rgba(0,0,0,0.45)"
        initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.4, delay: 0.9 }} style={{ transformOrigin: '140px 220px' }} />

      {/* === Rig base / platform === */}
      <motion.g initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
        <rect x="100" y="212" width="80" height="8" rx="2" fill={darkSteel} stroke="white" strokeWidth="1" />
        <rect x="105" y="208" width="70" height="5" rx="1" fill={steel} stroke="white" strokeWidth="0.8" />
        {/* Bolts */}
        {[108, 120, 160, 172].map(x => (
          <circle key={x} cx={x} cy="216" r="1.2" fill="#1e293b" />
        ))}
      </motion.g>

      {/* === Tripod mast (left leg) === */}
      <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }} style={{ transformOrigin: '140px 212px' }}>
        {/* Left leg */}
        <line x1="100" y1="212" x2="134" y2="40" stroke={steel} strokeWidth="5" strokeLinecap="round" />
        <line x1="100" y1="212" x2="134" y2="40" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        {/* Right leg */}
        <line x1="180" y1="212" x2="146" y2="40" stroke={steel} strokeWidth="5" strokeLinecap="round" />
        <line x1="180" y1="212" x2="146" y2="40" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        {/* Rear support leg (darker, behind) */}
        <line x1="140" y1="212" x2="140" y2="40" stroke={darkSteel} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
        {/* Cross-bracing */}
        {[195, 165, 135, 105, 75, 50].map((y, i) => (
          <g key={y}>
            <line x1={100 + (134 - 100) * (212 - y) / 172} y1={y} x2={180 - (180 - 146) * (212 - y) / 172} y2={y} stroke={steel} strokeWidth="2" opacity="0.8" strokeLinecap="round" />
            {i < 5 && (
              <>
                <line x1={100 + (134 - 100) * (212 - y) / 172} y1={y} x2={180 - (180 - 146) * (212 - (y - 30)) / 172} y2={y - 30} stroke={steel} strokeWidth="1.5" opacity="0.5" />
                <line x1={180 - (180 - 146) * (212 - y) / 172} y1={y} x2={100 + (134 - 100) * (212 - (y - 30)) / 172} y2={y - 30} stroke={steel} strokeWidth="1.5" opacity="0.5" />
              </>
            )}
          </g>
        ))}
        {/* Mast top cap */}
        <rect x="130" y="32" width="20" height="10" rx="2" fill={steel} stroke="white" strokeWidth="1" />
        {/* Crown sheave (pulley at top) */}
        <motion.g style={{ transformOrigin: '140px 38px' }} animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: 1 }}>
          <circle cx="140" cy="38" r="7" fill="none" stroke={steel} strokeWidth="2.5" />
          <circle cx="140" cy="38" r="7" fill="none" stroke="white" strokeWidth="0.8" opacity="0.5" />
          <circle cx="140" cy="38" r="2" fill={darkSteel} />
          <line x1="133" y1="38" x2="147" y2="38" stroke="white" strokeWidth="1" opacity="0.6" />
        </motion.g>
      </motion.g>

      {/* === Winch / control box === */}
      <motion.g initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.6 }}>
        <rect x="155" y="200" width="22" height="14" rx="2" fill={darkSteel} stroke="white" strokeWidth="1" />
        <rect x="158" y="203" width="16" height="8" rx="1" fill={steel} />
        <motion.circle cx="166" cy="207" r="3" fill="none" stroke={accent} strokeWidth="1.5"
          style={{ transformOrigin: '166px 207px' }} animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: 1 }} />
        <circle cx="166" cy="207" r="1" fill={accent} />
      </motion.g>

      {/* === Drill cable === */}
      <motion.line x1="140" y1="44" x2="140" y2="95" stroke={accent} strokeWidth="2.5"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.3, delay: 1.0 }} />

      {/* === Traveling block + drill string (reciprocating) === */}
      <motion.g animate={{ y: [0, 30, 8, 30, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2, times: [0, 0.3, 0.5, 0.75, 1] }}>
        {/* Traveling block */}
        <rect x="133" y="93" width="14" height="10" rx="2" fill={steel} stroke="white" strokeWidth="1" />
        <circle cx="140" cy="98" r="2" fill={darkSteel} />
        {/* Drill string ( rods ) */}
        <line x1="140" y1="103" x2="140" y2="200" stroke={steel} strokeWidth="6" strokeLinecap="round" />
        <line x1="140" y1="103" x2="140" y2="200" stroke="white" strokeWidth="1.5" opacity="0.3" />
        {/* Casing tube (wider, around drill string) */}
        <rect x="135" y="170" width="10" height="40" rx="1" fill={darkSteel} stroke="white" strokeWidth="0.8" opacity="0.7" />
        {/* Drill bit (rotating) */}
        <motion.g style={{ transformOrigin: '140px 202px' }} animate={{ rotate: 360 }} transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}>
          <polygon points="131,198 149,198 140,212" fill={darkSteel} stroke="white" strokeWidth="1.2" />
          <line x1="140" y1="198" x2="140" y2="210" stroke="white" strokeWidth="1" opacity="0.6" />
          <circle cx="140" cy="201" r="2" fill={accent} opacity="0.8" />
        </motion.g>
      </motion.g>

      {/* === Rotary table / ground collar === */}
      <motion.g initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.4, delay: 0.8 }} style={{ transformOrigin: '140px 210px' }}>
        <motion.ellipse cx="140" cy="210" rx="22" ry="5" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear', delay: 1 }} style={{ transformOrigin: '140px 210px' }} />
        <ellipse cx="140" cy="210" rx="11" ry="2.5" fill="rgba(0,0,0,0.35)" />
      </motion.g>

      {/* === Spoil / cuttings emerging === */}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <motion.circle key={'spoil' + i} cx={140} cy={208} r="2.5" fill={i % 2 === 0 ? '#a16207' : accent}
          animate={{ x: [0, 20 - i * 4, 24 - i * 5, 0], y: [0, -14 - i * 2, -26 - i * 3, 0], opacity: [0, 0.9, 0.7, 0], scale: [0.4, 1, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.22 + 1.4, ease: 'easeOut' }} />
      ))}

      {/* === Driller figure in orange PPE === */}
      <motion.g initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7, duration: 0.5, ease: 'easeOut' }}>
        {/* Slight body sway */}
        <motion.g animate={{ rotate: [0, -3, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} style={{ transformOrigin: '215px 170px' }}>
          {/* === Hard hat (white) === */}
          <ellipse cx="215" cy="152" rx="9" ry="2" fill={hatColor} />
          <path d="M 206 152 Q 215 142 224 152 L 224 154 L 206 154 Z" fill={hatColor} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
          {/* Hat brim front */}
          <rect x="204" y="152" width="22" height="2.5" rx="1" fill="#e2e8f0" stroke="rgba(0,0,0,0.1)" strokeWidth="0.4" />
          {/* Hat ridge */}
          <line x1="215" y1="143" x2="215" y2="151" stroke="rgba(0,0,0,0.12)" strokeWidth="0.8" />
          {/* === Head === */}
          <circle cx="215" cy="158" r="5" fill={skin} stroke="rgba(0,0,0,0.1)" strokeWidth="0.4" />
          {/* Ear === */}
          <ellipse cx="221" cy="159" rx="1.5" ry="2" fill={skin} stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
          {/* Neck */}
          <rect x="213" y="162" width="4" height="4" fill={skin} />

          {/* === Hi-vis vest (orange) === */}
          <path d="M 206 166 L 224 166 L 227 192 L 203 192 Z" fill={hiVis} stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
          {/* Reflective strips */}
          <line x1="204" y1="176" x2="226" y2="176" stroke="white" strokeWidth="2" opacity="0.95" />
          <line x1="205" y1="183" x2="225" y2="183" stroke="white" strokeWidth="1.5" opacity="0.8" />
          {/* Vest zipper */}
          <line x1="215" y1="166" x2="215" y2="192" stroke={hiVisDark} strokeWidth="0.6" opacity="0.5" />

          {/* === Arms (orange sleeves) === */}
          {/* Left arm reaching toward control lever */}
          <motion.line x1="208" y1="174" x2="196" y2="184" stroke={hiVis} strokeWidth="4.5" strokeLinecap="round"
            animate={{ x2: [196, 191, 196], y2: [184, 181, 184] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
          {/* Left glove */}
          <motion.circle cx="196" cy="184" r="2.8" fill={skin} stroke="rgba(0,0,0,0.15)" strokeWidth="0.4"
            animate={{ cx: [196, 191, 196], cy: [184, 181, 184] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
          {/* Right arm */}
          <line x1="222" y1="174" x2="232" y2="188" stroke={hiVis} strokeWidth="4.5" strokeLinecap="round" />
          {/* Right glove */}
          <circle cx="232" cy="189" r="2.8" fill={skin} stroke="rgba(0,0,0,0.15)" strokeWidth="0.4" />

          {/* === Legs (dark work trousers) === */}
          <line x1="211" y1="192" x2="208" y2="214" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" />
          <line x1="219" y1="192" x2="222" y2="214" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" />
          {/* Steel-toe boots */}
          <ellipse cx="207" cy="216" rx="4.5" ry="2" fill="#0f172a" stroke="rgba(0,0,0,0.3)" strokeWidth="0.4" />
          <ellipse cx="223" cy="216" rx="4.5" ry="2" fill="#0f172a" stroke="rgba(0,0,0,0.3)" strokeWidth="0.4" />
          {/* Boot toe cap highlight */}
          <ellipse cx="204" cy="215" rx="2" ry="1" fill={steel} opacity="0.4" />
          <ellipse cx="226" cy="215" rx="2" ry="1" fill={steel} opacity="0.4" />
        </motion.g>
      </motion.g>

      {/* === Control lever === */}
      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.4 }}>
        <rect x="186" y="208" width="16" height="7" rx="1.5" fill={darkSteel} stroke="white" strokeWidth="0.8" />
        <line x1="194" y1="208" x2="194" y2="186" stroke={steel} strokeWidth="2.5" strokeLinecap="round" />
        <motion.line x1="194" y1="186" x2="200" y2="180" stroke={accent} strokeWidth="3.5" strokeLinecap="round"
          animate={{ x2: [200, 206, 200], y2: [180, 178, 180] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
        <motion.circle cx="200" cy="180" r="3.5" fill={accent} stroke="white" strokeWidth="1"
          animate={{ cx: [200, 206, 200], cy: [180, 178, 180] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
      </motion.g>

      {/* === Dust particles === */}
      {[0, 1, 2, 3, 4].map(i => (
        <motion.circle key={'dust' + i} cx={90 + i * 10} cy={216} r="1.8" fill="rgba(255,255,255,0.4)"
          animate={{ y: [0, -16, -3], opacity: [0, 0.6, 0], scale: [0.4, 1, 0.4] }}
          transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.18 + 1.6, ease: 'easeOut' }} />
      ))}
    </svg>
  );
}