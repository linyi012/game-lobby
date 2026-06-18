let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.08) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

export function unlockAudio() {
  void getCtx();
}

export function playNightSound() {
  tone(180, 0.4, 'triangle');
}

export function playDaySound() {
  tone(440, 0.15);
  setTimeout(() => tone(554, 0.2), 120);
}

export function playVoteSound() {
  tone(320, 0.1, 'square');
}

export function playDeathSound() {
  tone(120, 0.5, 'sawtooth', 0.1);
}

export function playVictorySound() {
  [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.25), i * 150));
}
