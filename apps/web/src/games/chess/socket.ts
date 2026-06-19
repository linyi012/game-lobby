import { getActiveSocket } from '../../lib/socket';
import type { ChessPromotion } from '@game-lobby/game-engine';

export function emitChessMove(from: string, to: string, promotion?: ChessPromotion) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:chess:move', { from, to, promotion }, resolve);
  });
}

export function emitChessResign() {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:chess:resign', {}, resolve);
  });
}
