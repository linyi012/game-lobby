import { emitWithAck } from '../../lib/emit-with-ack';

type Ack = { ok: boolean };

export function emitChessMove(from: string, to: string, promotion?: string) {
  return emitWithAck<Ack>('game:chess:move', { from, to, promotion });
}

export function emitChessResign() {
  return emitWithAck<Ack>('game:chess:resign', {});
}
