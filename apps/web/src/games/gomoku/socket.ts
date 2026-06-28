import { emitWithAck } from '../../lib/emit-with-ack';

type Ack = { ok: boolean };

export function emitGomokuPlace(row: number, col: number) {
  return emitWithAck<Ack>('game:gomoku:place', { row, col });
}
