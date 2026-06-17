import { getActiveSocket } from '../../lib/socket';
import type { DrawStroke } from '@game-lobby/game-engine';

export function emitSelectWord(word: string) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:draw-guess:select-word', { word }, resolve);
  });
}

export function emitStroke(strokes: DrawStroke[]) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:draw-guess:stroke', { strokes }, resolve);
  });
}

export function emitClearCanvas() {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:draw-guess:clear', {}, resolve);
  });
}

export function emitGuess(text: string) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:draw-guess:guess', { text }, resolve);
  });
}

export function emitPainterHint(text: string) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:draw-guess:hint', { text }, resolve);
  });
}

export function emitRevealChar(index: number) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:draw-guess:reveal-char', { index }, resolve);
  });
}

export function onStrokeDelta(handler: (payload: { strokes: DrawStroke[] }) => void) {
  const s = getActiveSocket();
  if (!s) return () => {};
  s.on('game:draw-guess:stroke-delta', handler);
  return () => s.off('game:draw-guess:stroke-delta', handler);
}
