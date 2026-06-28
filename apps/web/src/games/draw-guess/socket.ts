import { emitWithAck } from '../../lib/emit-with-ack';
import type { DrawStroke } from '@game-lobby/game-engine';
import { getActiveSocket } from '../../lib/socket';

type Ack = { ok: boolean };

export function emitSelectWord(word: string) {
  return emitWithAck<Ack>('game:draw-guess:select-word', { word });
}

export function emitStroke(strokes: DrawStroke[]) {
  return emitWithAck<Ack>('game:draw-guess:stroke', { strokes });
}

export function emitClearCanvas() {
  return emitWithAck<Ack>('game:draw-guess:clear', {});
}

export function emitGuess(text: string) {
  return emitWithAck<Ack>('game:draw-guess:guess', { text });
}

export function emitPainterHint(text: string) {
  return emitWithAck<Ack>('game:draw-guess:hint', { text });
}

export function emitRevealChar(index: number) {
  return emitWithAck<Ack>('game:draw-guess:reveal-char', { index });
}

export function onStrokeDelta(handler: (payload: { strokes: DrawStroke[] }) => void) {
  const s = getActiveSocket();
  if (!s) return () => {};
  s.on('game:draw-guess:stroke-delta', handler);
  return () => s.off('game:draw-guess:stroke-delta', handler);
}
