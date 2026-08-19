import React from 'react';
import { motion } from 'framer-motion';

/**
 * High-detail Geotechnical loading scene — a driller in orange PPE (hi-vis
 * jacket + white hard hat) operating a cable percussion drilling rig.
 *
 * Rebuilt to match the approved AI video preview: driller as the hero figure,
 * orange hi-vis jacket with reflective bands, white hard hat with GC green
 * stripe, gloves, steel-toe boots; rig with mast, winch, rotating drill string
 * entering a borehole, spoil cuttings and dust.
 */
export default function GeotechScene({ color = '#2E5A1A' }) {
  const accent = '#8DC63F';
  const steel = '#94a3b8';
  const darkSteel = '#475569';
  const hiVis = '#f97316';
  const hiVisDark = '#c2410c';
  const hiVisLight = '#fb923c';
  const skin = '#e8b88a';
  const hatColor = '#f8fafc';
  const trouser = '#1e293b';

  return (
    <svg viewBox="0 0 320 290" className="w-full h-full drop-shadow-2xl">
      <defs>
        <linearGradient id="geo-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
        </linearGradient>
        <linearGradient id="geo-hat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="geo-vest" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hiVisLight} />
          <stop offset="55%" stopColor={hiVis} />
          <stop offset="100%" stopColor={hiVisDark} />
        </linearGradient>
      </defs>

      {/* === Ground surface === */}
      <motion.line x1="20" y1="232" x2="300" y2="232" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeDasharray="7 5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.1 }} />
      <rect x="20" y="232" width="280" height="40" fill="url(#geo-ground)" />
      {/* Ground texture pebbles */}
      {[40, 78, 130, 175, 215, 260, 290].map((x, i) => (
        <ellipse key={i} cx={x} cy={236 + (i % 2) * 2} rx={2 + (i % 3)} ry="1.2" fill="rgba(255,255,255,0.12)" />
      ))}

      {/* === Borehole ring === */}
      <motion.ellipse cx="150" cy="232" rx="20" ry="5" fill="rgba(0,0,0,0.5)"
        initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.4, delay: 0.9 }} style={{ transformOrigin: '150px 232px' }} />
      <ellipse cx="150" cy="232" rx="9" ry="2.2" fill="#000" opacity="0.7" />

      {/* === Rig base / platform === */}
      <motion.g initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
        <rect x="108" y="224" width="84" height="9" rx="2" fill={darkSteel} stroke="white" strokeWidth="1" />
        <rect x="113" y="219" width="74" height="6" rx="1" fill={steel} stroke="white" strokeWidth="0.8" />
        {[116, 130, 170, 184].map(x => <circle key={x} cx={x} cy="228.5" r="1.3" fill="#0f172a" />)}
      </motion.g>

      {/* === Tripod mast === */}
      <motion.g initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }} style={{ transformOrigin: '150px 224px' }}>
        {/* Rear support leg */}
        <line x1="150" y1="224" x2="150" y2="44" stroke={darkSteel} strokeWidth="3.5" strokeLinecap="round" opacity="0.55" />
        {/* Left leg */}
        <line x1="108" y1="224" x2="144" y2="44" stroke={steel} strokeWidth="5.5" strokeLinecap="round" />
        <line x1="108" y1="224" x2="144" y2="44" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
        {/* Right leg */}
        <line x1="192" y1="224" x2="156" y2="44" stroke={steel} strokeWidth="5.5" strokeLinecap="round" />
        <line x1="192" y1="224" x2="156" y2="44" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
        {/* Cross-bracing */}
        {[205, 175, 145, 115, 85, 55].map((y, i) => {
          const lx = 108 + (144 - 108) * (224 - y) / 180;
          const rx = 192 - (192 - 156) * (224 - y) / 180;
          return (
            <g key={y}>
              <line x1={lx} y1={y} x2={rx} y2={y} stroke={steel} strokeWidth="2.2" opacity="0.85" strokeLinecap="round" />
              {i < 5 && <>
                <line x1={lx} y1={y} x2={rx - (rx - lx) * 0.12} y2={y - 30} stroke={steel} strokeWidth="1.6" opacity="0.5" />
                <line x1={rx} y1={y} x2={lx + (rx - lx) * 0.12} y2={y - 30} stroke={steel} strokeWidth="1.6" opacity="0.5" />
              </>}
            </g>
          );
        })}
        {/* Mast top cap */}
        <rect x="140" y="36" width="20" height="10" rx="2" fill={steel} stroke="white" strokeWidth="1" />
        {/* Crown sheave (pulley) */}
        <motion.g style={{ transformOrigin: '150px 42px' }} animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: 1 }}>
          <circle cx="150" cy="42" r="7.5" fill="none" stroke={steel} strokeWidth="2.8" />
          <circle cx="150" cy="42" r="7.5" fill="none" stroke="white" strokeWidth="0.9" opacity="0.5" />
          <circle cx="150" cy="42" r="2.2" fill={darkSteel} />
          <line x1="142.5" y1="42" x2="157.5" y2="42" stroke="white" strokeWidth="1" opacity="0.6" />
        </motion.g>
      </motion.g>

      {/* === Winch / control box === */}
      <motion.g initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.6 }}>
        <rect x="168" y="212" width="24" height="15" rx="2" fill={darkSteel} stroke="white" strokeWidth="1" />
        <rect x="171" y="215" width="18" height="9" rx="1" fill={steel} />
        <motion.circle cx="180" cy="219.5" r="3.2" fill="none" stroke={accent} strokeWidth="1.6"
          style={{ transformOrigin: '180px 219.5px' }} animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: 1 }} />
        <circle cx="180" cy="219.5" r="1.1" fill={accent} />
      </motion.g>

      {/* === Drill cable === */}
      <motion.line x1="150" y1="48" x2="150" y2="104" stroke={accent} strokeWidth="2.8"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.3, delay: 1.0 }} />

      {/* === Traveling block + drill string (reciprocating) === */}
      <motion.g animate={{ y: [0, 28, 6, 28, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2, times: [0, 0.3, 0.5, 0.75, 1] }}>
        <rect x="142" y="102" width="16" height="11" rx="2" fill={steel} stroke="white" strokeWidth="1" />
        <circle cx="150" cy="107.5" r="2.2" fill={darkSteel} />
        {/* Drill string */}
        <line x1="150" y1="113" x2="150" y2="214" stroke={steel} strokeWidth="6.5" strokeLinecap="round" />
        <line x1="150" y1="113" x2="150" y2="214" stroke="white" strokeWidth="1.6" opacity="0.3" />
        {/* Casing tube */}
        <rect x="145" y="182" width="10" height="44" rx="1" fill={darkSteel} stroke="white" strokeWidth="0.8" opacity="0.7" />
        {/* Drill bit (rotating) */}
        <motion.g style={{ transformOrigin: '150px 216px' }} animate={{ rotate: 360 }} transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}>
          <polygon points="140,212 160,212 150,228" fill={darkSteel} stroke="white" strokeWidth="1.2" />
          <line x1="150" y1="212" x2="150" y2="226" stroke="white" strokeWidth="1" opacity="0.6" />
          <circle cx="150" cy="215" r="2.2" fill={accent} opacity="0.85" />
        </motion.g>
      </motion.g>

      {/* === Rotary table / ground collar === */}
      <motion.g initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.4, delay: 0.8 }} style={{ transformOrigin: '150px 224px' }}>
        <motion.ellipse cx="150" cy="224" rx="24" ry="5.5" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear', delay: 1 }} style={{ transformOrigin: '150px 224px' }} />
      </motion.g>

      {/* === Spoil / cuttings emerging === */}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <motion.circle key={'spoil' + i} cx={150} cy={222} r="2.6" fill={i % 2 === 0 ? '#a16207' : accent}
          animate={{ x: [0, 22 - i * 4, 26 - i * 5, 0], y: [0, -15 - i * 2, -28 - i * 3, 0], opacity: [0, 0.95, 0.7, 0], scale: [0.4, 1, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.22 + 1.4, ease: 'easeOut' }} />
      ))}

      {/* === Driller figure (hero — orange PPE) === */}
      <motion.g initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7, duration: 0.5, ease: 'easeOut' }}>
        <motion.g animate={{ rotate: [0, -2.5, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} style={{ transformOrigin: '248px 188px' }}>
          {/* Shadow */}
          <ellipse cx="248" cy="248" rx="20" ry="3.5" fill="rgba(0,0,0,0.4)" />

          {/* === Hard hat (white, with GC green stripe) === */}
          <ellipse cx="248" cy="166" rx="11" ry="2.2" fill="url(#geo-hat)" />
          <path d="M 237 166 Q 248 153 259 166 L 259 168.5 L 237 168.5 Z" fill="url(#geo-hat)" stroke="rgba(0,0,0,0.18)" strokeWidth="0.5" />
          {/* Hat brim */}
          <rect x="235" y="166" width="26" height="3" rx="1.2" fill="#e2e8f0" stroke="rgba(0,0,0,0.12)" strokeWidth="0.4" />
          {/* GC green stripe on hat */}
          <rect x="244" y="155" width="8" height="2.2" rx="0.5" fill={color} />
          {/* Hat ridge */}
          <line x1="248" y1="154" x2="248" y2="165" stroke="rgba(0,0,0,0.14)" strokeWidth="0.8" />

          {/* === Head === */}
          <circle cx="248" cy="173" r="5.5" fill={skin} stroke="rgba(0,0,0,0.12)" strokeWidth="0.4" />
          {/* Ear defender */}
          <ellipse cx="255" cy="174" rx="2" ry="2.6" fill="#334155" stroke="rgba(0,0,0,0.2)" strokeWidth="0.3" />
          {/* Neck */}
          <rect x="246" y="177" width="4.5" height="4" fill={skin} />

          {/* === Hi-vis jacket (orange) === */}
          <path d="M 237 181 L 259 181 L 263 212 L 233 212 Z" fill="url(#geo-vest)" stroke="rgba(0,0,0,0.18)" strokeWidth="0.6" />
          {/* Reflective strips (silver) */}
          <rect x="234" y="193" width="29" height="2.4" rx="0.5" fill="#f1f5f9" opacity="0.95" />
          <rect x="235" y="201" width="27" height="1.8" rx="0.5" fill="#e2e8f0" opacity="0.85" />
          {/* Jacket zipper */}
          <line x1="248" y1="181" x2="248" y2="212" stroke={hiVisDark} strokeWidth="0.7" opacity="0.6" />
          {/* Collar */}
          <path d="M 237 181 L 248 184 L 259 181" fill="none" stroke={hiVisDark} strokeWidth="1" opacity="0.5" />

          {/* === Arms (orange sleeves) === */}
          {/* Left arm reaching toward control lever */}
          <motion.line x1="240" y1="189" x2="224" y2="200" stroke={hiVis} strokeWidth="5" strokeLinecap="round"
            animate={{ x2: [224, 218, 224], y2: [200, 197, 200] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
          <motion.circle cx="224" cy="200" r="3" fill={skin} stroke="rgba(0,0,0,0.18)" strokeWidth="0.4"
            animate={{ cx: [224, 218, 224], cy: [200, 197, 200] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
          {/* Right arm (on hip) */}
          <line x1="256" y1="189" x2="268" y2="206" stroke={hiVis} strokeWidth="5" strokeLinecap="round" />
          <circle cx="268" cy="207" r="3" fill={skin} stroke="rgba(0,0,0,0.18)" strokeWidth="0.4" />

          {/* === Legs (dark work trousers) === */}
          <line x1="243" y1="212" x2="239" y2="246" stroke={trouser} strokeWidth="5.5" strokeLinecap="round" />
          <line x1="253" y1="212" x2="257" y2="246" stroke={trouser} strokeWidth="5.5" strokeLinecap="round" />
          {/* Knee pad highlight */}
          <ellipse cx="241" cy="230" rx="2.5" ry="1.6" fill="#334155" opacity="0.6" />
          <ellipse cx="255" cy="230" rx="2.5" ry="1.6" fill="#334155" opacity="0.6" />
          {/* Steel-toe boots */}
          <ellipse cx="237" cy="248" rx="5" ry="2.2" fill="#0f172a" stroke="rgba(0,0,0,0.3)" strokeWidth="0.4" />
          <ellipse cx="259" cy="248" rx="5" ry="2.2" fill="#0f172a" stroke="rgba(0,0,0,0.3)" strokeWidth="0.4" />
          {/* Boot toe cap highlight (steel toe) */}
          <ellipse cx="233" cy="247" rx="2.2" ry="1" fill={steel} opacity="0.5" />
          <ellipse cx="263" cy="247" rx="2.2" ry="1" fill={steel} opacity="0.5" />
        </motion.g>
      </motion.g>

      {/* === Control lever === */}
      <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.4 }}>
        <rect x="214" y="222" width="18" height="8" rx="1.5" fill={darkSteel} stroke="white" strokeWidth="0.8" />
        <line x1="223" y1="222" x2="223" y2="198" stroke={steel} strokeWidth="2.8" strokeLinecap="round" />
        <motion.line x1="223" y1="198" x2="230" y2="192" stroke={accent} strokeWidth="3.8" strokeLinecap="round"
          animate={{ x2: [230, 236, 230], y2: [192, 190, 192] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
        <motion.circle cx="230" cy="192" r="3.8" fill={accent} stroke="white" strokeWidth="1"
          animate={{ cx: [230, 236, 230], cy: [192, 190, 192] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
      </motion.g>

      {/* === Dust particles === */}
      {[0, 1, 2, 3, 4].map(i => (
        <motion.circle key={'dust' + i} cx={100 + i * 11} cy={230} r="1.9" fill="rgba(255,255,255,0.45)"
          animate={{ y: [0, -18, -4], opacity: [0, 0.65, 0], scale: [0.4, 1, 0.4] }}
          transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.18 + 1.6, ease: 'easeOut' }} />
      ))}
    </svg>
  );
}