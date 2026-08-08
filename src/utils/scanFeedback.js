// Audio + haptic feedback for scanning — uses Web Audio API for beeps
// and the Vibration API for haptics. No external dependencies.

let audioCtx = null;

function getAudioCtx() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) { return null; }
  }
  // Resume if suspended (mobile browsers require user gesture)
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep(freq, duration, type = 'sine', volume = 0.25, delay = 0) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = type;
  const t = ctx.currentTime + delay;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/** Success — recognised item: bright double-ping + short haptic */
export function playSuccess() {
  beep(880, 0.08, 'sine', 0.25, 0);
  beep(1320, 0.12, 'sine', 0.25, 0.08);
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(80);
}

/** Error — unknown item: low buzz + double haptic */
export function playError() {
  beep(220, 0.18, 'square', 0.18, 0);
  beep(180, 0.22, 'square', 0.18, 0.12);
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([120, 40, 120]);
}

/** Confirmation — action saved: pleasant triad */
export function playConfirm() {
  beep(660, 0.08, 'sine', 0.2, 0);
  beep(880, 0.08, 'sine', 0.2, 0.07);
  beep(1100, 0.12, 'sine', 0.2, 0.14);
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60);
}