/**
 * Voice channel sound effects
 * Generates short synthetic tones for join/leave/PTT feedback
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Silently fail if audio context isn't available
  }
}

/** Two rising tones — user joined */
export function playJoinSound() {
  playTone(440, 0.12, 'sine', 0.12);
  setTimeout(() => playTone(587, 0.15, 'sine', 0.12), 80);
}

/** Two falling tones — user left */
export function playLeaveSound() {
  playTone(587, 0.12, 'sine', 0.1);
  setTimeout(() => playTone(440, 0.15, 'sine', 0.1), 80);
}

/** Very short blip — PTT activated */
export function playPTTActivateSound() {
  playTone(660, 0.06, 'sine', 0.1);
}

/** Very short lower blip — PTT deactivated */
export function playPTTDeactivateSound() {
  playTone(440, 0.06, 'sine', 0.08);
}
