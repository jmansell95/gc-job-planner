import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * DivisionLoadingScreen — full-screen animated splash shown when entering
 * the Geotechnical drilling division. Features a detailed animated SVG of
 * a driller in orange hi-vis PPE and a hard hat operating a cable percussion
 * drilling rig: the derrick erects, the crown pulley spins, the drill string
 * drives into the ground with a rotating bit, spoil spirals out of the hole,
 * and the driller works a control lever — all over a ~3.8s progress fill.
 */
export default function DivisionLoadingScreen({ division, onComplete, duration = 3800 }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 30);
    return () => clearInterval(interval);
  }, [duration, onComplete]);

  const divColor = division?.color || '#2E5A1A';
  const divName = division?.name || 'Geotechnical';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(155deg, ${divColor} 0%, ${divColor}cc 40%, #0a120a 100%)` }}
    >
      {/* Ambient glow */}
      <motion.div
        className="absolute w-[28rem] h-[28rem] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(141,198,63,0.22) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0.65, 0.4] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Scene */}
      <div className="relative w-72 h-72 mb-6 z-10">
        <svg viewBox="0 0 280 270" className="w-full h-full drop-shadow-2xl">
          {/* === Ground === */}
          <motion.line
            x1="20" y1="215" x2="260" y2="215"
            stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5 5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          />
          {/* Borehole opening (dark circle in ground) */}
          <motion.ellipse
            cx="140" cy="216" rx="14" ry="4"
            fill="rgba(0,0,0,0.5)"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.4, delay: 0.9 }}
            style={{ transformOrigin: '140px 216px' }}
          />

          {/* === Derrick tower — erects from ground === */}
          <motion.g
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
            style={{ transformOrigin: '140px 215px' }}
          >
            {/* Tower legs (A-frame) */}
            <line x1="100" y1="215" x2="132" y2="45" stroke="white" strokeWidth="4" strokeLinecap="round" />
            <line x1="180" y1="215" x2="148" y2="45" stroke="white" strokeWidth="4" strokeLinecap="round" />
            {/* Sub-legs (base spread) */}
            <line x1="100" y1="215" x2="92" y2="215" stroke="white" strokeWidth="4" strokeLinecap="round" />
            <line x1="180" y1="215" x2="188" y2="215" stroke="white" strokeWidth="4" strokeLinecap="round" />
            {/* Horizontal cross-braces */}
            {[188, 158, 128, 98, 68].map(y => (
              <line key={y} x1={100 + (132 - 100) * (215 - y) / 170} y1={y}
                x2={180 - (180 - 148) * (215 - y) / 170} y2={y}
                stroke="white" strokeWidth="2" opacity="0.75" strokeLinecap="round" />
            ))}
            {/* X braces between horizontals */}
            <line x1="103" y1="188" x2="173" y2="158" stroke="white" strokeWidth="1.5" opacity="0.4" />
            <line x1="177" y1="188" x2="107" y2="158" stroke="white" strokeWidth="1.5" opacity="0.4" />
            <line x1="108" y1="158" x2="168" y2="128" stroke="white" strokeWidth="1.5" opacity="0.4" />
            <line x1="172" y1="158" x2="112" y2="128" stroke="white" strokeWidth="1.5" opacity="0.4" />
            <line x1="113" y1="128" x2="167" y2="98" stroke="white" strokeWidth="1.5" opacity="0.4" />
            <line x1="167" y1="128" x2="113" y2="98" stroke="white" strokeWidth="1.5" opacity="0.4" />
            <line x1="117" y1="98" x2="163" y2="68" stroke="white" strokeWidth="1.5" opacity="0.4" />
            <line x1="163" y1="98" x2="117" y2="68" stroke="white" strokeWidth="1.5" opacity="0.4" />

            {/* Crown block (top pulley housing) */}
            <rect x="130" y="38" width="20" height="12" rx="2" fill="white" />
            {/* Crown pulley — slowly rotating */}
            <motion.g
              style={{ transformOrigin: '140px 44px' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: 1 }}
            >
              <circle cx="140" cy="44" r="5" fill={divColor} stroke="white" strokeWidth="1.5" />
              <line x1="140" y1="40" x2="140" y2="48" stroke="white" strokeWidth="1.5" />
              <line x1="136" y1="44" x2="144" y2="44" stroke="white" strokeWidth="1.5" />
            </motion.g>
          </motion.g>

          {/* === Cable from crown to traveling block === */}
          <motion.line
            x1="140" y1="50" x2="140" y2="100"
            stroke="#8DC63F" strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.0 }}
          />

          {/* === Traveling block + drill string — drives down and retracts === */}
          <motion.g
            animate={{ y: [0, 35, 12, 35, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 1.2, times: [0, 0.3, 0.5, 0.75, 1] }}
          >
            {/* Traveling block housing */}
            <rect x="133" y="98" width="14" height="10" rx="2" fill="#8DC63F" stroke="white" strokeWidth="1" />
            {/* Kelly bar / drill string */}
            <line x1="140" y1="108" x2="140" y2="200" stroke="#8DC63F" strokeWidth="5" strokeLinecap="round" />
            <line x1="140" y1="108" x2="140" y2="200" stroke="white" strokeWidth="1" opacity="0.3" />
            {/* Drill bit — rotating fast */}
            <motion.g
              style={{ transformOrigin: '140px 206px' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
            >
              <polygon points="131,200 149,200 140,214" fill="#8DC63F" stroke="white" strokeWidth="1.2" />
              <line x1="140" y1="200" x2="140" y2="212" stroke="white" strokeWidth="1" opacity="0.6" />
              <circle cx="140" cy="203" r="2" fill="white" opacity="0.5" />
            </motion.g>
          </motion.g>

          {/* === Rotary table at ground level — rotating === */}
          <motion.g
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.4, delay: 0.8 }}
            style={{ transformOrigin: '140px 212px' }}
          >
            <motion.ellipse
              cx="140" cy="212" rx="20" ry="5"
              fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear', delay: 1 }}
              style={{ transformOrigin: '140px 212px' }}
            />
            <ellipse cx="140" cy="212" rx="10" ry="2.5" fill="rgba(0,0,0,0.3)" />
          </motion.g>

          {/* === Spoil spiraling up from the borehole === */}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <motion.circle
              key={'spoil' + i}
              cx={140}
              cy={210}
              r="2.5"
              fill={i % 2 === 0 ? '#a16207' : '#8DC63F'}
              animate={{
                x: [0, 18 - i * 3, 22 - i * 4, 0],
                y: [0, -12 - i * 2, -24 - i * 3, 0],
                opacity: [0, 0.9, 0.7, 0],
                scale: [0.4, 1, 0.8, 0.4]
              }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                delay: i * 0.25 + 1.4,
                ease: 'easeOut'
              }}
            />
          ))}

          {/* === Man in orange PPE + hard hat — walks in and operates lever === */}
          <motion.g
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6, ease: 'easeOut' }}
          >
            {/* Hard hat (yellow) with slight tilt */}
            <motion.g
              animate={{ rotate: [0, -4, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
              style={{ transformOrigin: '215px 155px' }}
            >
              <path d="M 205 158 Q 215 146 225 158 L 225 161 L 205 161 Z" fill="#facc15" stroke="white" strokeWidth="0.6" />
              <rect x="203" y="160" width="24" height="2.5" rx="1" fill="#eab308" />
              <line x1="215" y1="148" x2="215" y2="152" stroke="#eab308" strokeWidth="1" />
            </motion.g>
            {/* Head (skin tone) */}
            <circle cx="215" cy="166" r="5.5" fill="#fde68a" stroke="white" strokeWidth="0.5" />
            {/* Neck */}
            <line x1="215" y1="171" x2="215" y2="175" stroke="#fde68a" strokeWidth="2.5" />

            {/* === Orange hi-vis torso (PPE jacket) === */}
            <path d="M 207 175 L 223 175 L 225 196 L 205 196 Z" fill="#f97316" stroke="white" strokeWidth="0.8" />
            {/* Reflective strips on torso */}
            <line x1="205" y1="184" x2="225" y2="184" stroke="white" strokeWidth="1.5" opacity="0.9" />
            <line x1="206" y1="190" x2="224" y2="190" stroke="white" strokeWidth="1.2" opacity="0.7" />

            {/* Left arm — reaches toward control lever, pumps back and forth */}
            <motion.line
              x1="208" y1="180" x2="196" y2="186"
              stroke="#f97316" strokeWidth="3.5" strokeLinecap="round"
              animate={{ x2: [196, 191, 196], y2: [186, 183, 186] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            />
            {/* Left hand */}
            <motion.circle
              cx="196" cy="186" r="2.5" fill="#fde68a" stroke="white" strokeWidth="0.4"
              animate={{ cx: [196, 191, 196], cy: [186, 183, 186] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            />

            {/* Right arm — on hip / resting */}
            <line x1="222" y1="180" x2="230" y2="192" stroke="#f97316" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="230" cy="193" r="2.5" fill="#fde68a" stroke="white" strokeWidth="0.4" />

            {/* Legs (dark work trousers) */}
            <line x1="212" y1="196" x2="210" y2="214" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            <line x1="218" y1="196" x2="220" y2="214" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            {/* Work boots */}
            <ellipse cx="209" cy="215" rx="4" ry="2" fill="#0f172a" />
            <ellipse cx="221" cy="215" rx="4" ry="2" fill="#0f172a" />
          </motion.g>

          {/* === Control lever stand — beside the man === */}
          <motion.g
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.4 }}
          >
            {/* Stand base */}
            <rect x="188" y="210" width="14" height="6" rx="1" fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
            {/* Lever post */}
            <line x1="195" y1="210" x2="195" y2="188" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" />
            {/* Lever handle — pumps with the man's hand */}
            <motion.line
              x1="195" y1="188" x2="200" y2="182"
              stroke="#8DC63F" strokeWidth="3" strokeLinecap="round"
              animate={{ x2: [200, 205, 200], y2: [182, 180, 182] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            />
            <motion.circle
              cx="200" cy="182" r="3" fill="#8DC63F" stroke="white" strokeWidth="1"
              animate={{ cx: [200, 205, 200], cy: [182, 180, 182] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            />
          </motion.g>

          {/* === Dust particles at ground === */}
          {[0, 1, 2, 3].map(i => (
            <motion.circle
              key={'dust' + i}
              cx={95 + i * 12}
              cy={218}
              r="1.8"
              fill="rgba(255,255,255,0.45)"
              animate={{
                y: [0, -14, -2],
                opacity: [0, 0.6, 0],
                scale: [0.4, 1, 0.4]
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                delay: i * 0.2 + 1.6,
                ease: 'easeOut'
              }}
            />
          ))}
        </svg>
      </div>

      {/* Division name */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xl font-extrabold text-white tracking-tight mb-1 z-10"
      >
        Entering {divName}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-white/60 font-medium mb-6 z-10"
      >
        Ground Investigation Specialists
      </motion.p>

      {/* Progress bar */}
      <div className="w-56 h-1.5 bg-white/15 rounded-full overflow-hidden z-10">
        <div
          className="h-full bg-gradient-to-r from-[#8DC63F] to-white rounded-full transition-all duration-75 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-white/40 font-semibold mt-2 tabular-nums z-10">{Math.round(progress)}%</p>
    </motion.div>
  );
}