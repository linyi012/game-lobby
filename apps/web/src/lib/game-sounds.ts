let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.12,
  attack = 0.01,
  release = 0.08,
) {
  const ac = ctx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ac.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration + release);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + release + 0.05);
}

function noiseBurst(duration: number, volume = 0.06) {
  const ac = ctx();
  const bufferSize = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0)!;
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const gain = ac.createGain();
  const t = ac.currentTime;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(gain);
  gain.connect(ac.destination);
  src.start(t);
}

/** Soft card slide when a tile is drawn from the deck. */
export function playDrawSound() {
  noiseBurst(0.07, 0.05);
  tone(320, 0.04, 'triangle', 0.07);
}

/** Short positive chime on a correct guess. */
export function playGuessCorrect() {
  tone(523, 0.1, 'sine', 0.1);
  setTimeout(() => tone(659, 0.12, 'sine', 0.09), 70);
}

/** Low buzz on a wrong guess. */
export function playGuessWrong() {
  tone(180, 0.14, 'sawtooth', 0.07);
  tone(140, 0.18, 'triangle', 0.05);
}

/** Click when placing a Joker. */
export function playPlaceJoker() {
  tone(440, 0.05, 'square', 0.06);
  tone(330, 0.07, 'triangle', 0.05);
}

/** Subtle tick when a new turn begins. */
export function playTurnSound() {
  tone(392, 0.06, 'sine', 0.05);
}
