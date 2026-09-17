/**
 * Web Audio API Meditation Bell Synthesizer
 * Zero-dependency, offline-friendly harmonic chimes for Zen Focus Sessions.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a resonant singing-bowl chime with harmonic overtones and exponential decay
 */
function playTone(freq: number, duration: number, gainValue = 0.2, type: OscillatorType = 'sine') {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  // Gentle attack, smooth exponential decay
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(gainValue, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

/**
 * Play warm singing-bowl chime for session start
 */
export function playSessionStart(isMuted = false): void {
  if (isMuted) return;
  try {
    // 432Hz fundamental with soft harmonic
    playTone(432, 2.0, 0.18);
    setTimeout(() => {
      playTone(540, 2.2, 0.14);
    }, 150);
  } catch (err) {
    console.debug('Audio play failed:', err);
  }
}

/**
 * Play crisp gentle bell for step transition
 */
export function playStepTransition(isMuted = false): void {
  if (isMuted) return;
  try {
    playTone(648, 1.4, 0.16);
    setTimeout(() => {
      playTone(864, 1.2, 0.08);
    }, 80);
  } catch (err) {
    console.debug('Audio play failed:', err);
  }
}

/**
 * Play rich celebration chord for full session completion
 */
export function playSessionComplete(isMuted = false): void {
  if (isMuted) return;
  try {
    // Harmonious triad: 432Hz (Root), 540Hz (Major Third), 648Hz (Fifth)
    playTone(432, 3.5, 0.2);
    setTimeout(() => playTone(540, 3.2, 0.18), 120);
    setTimeout(() => playTone(648, 3.0, 0.15), 240);
    setTimeout(() => playTone(864, 2.8, 0.1), 380);
  } catch (err) {
    console.debug('Audio play failed:', err);
  }
}
