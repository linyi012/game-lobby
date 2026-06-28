import { emitWithAck } from '../../lib/emit-with-ack';

type Ack = { ok: boolean };

export function emitChineseChessMove(from: string, to: string) {
  return emitWithAck<Ack>('game:xiangqi:move', { from, to });
}

export function emitChineseChessResign() {
  return emitWithAck<Ack>('game:xiangqi:resign', {});
}

export function emitChineseChessOfferDraw() {
  return emitWithAck<Ack>('game:xiangqi:offer_draw', {});
}

export function emitChineseChessRespondDraw(accept: boolean) {
  return emitWithAck<Ack>('game:xiangqi:respond_draw', { accept });
}
