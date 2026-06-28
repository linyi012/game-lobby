import { emitWithAck } from '../../lib/emit-with-ack';

type Ack = { ok: boolean };

export function emitGoPlay(x: number, y: number) {
  return emitWithAck<Ack>('game:go:play', { x, y });
}

export function emitGoPass() {
  return emitWithAck<Ack>('game:go:pass', {});
}

export function emitGoResign() {
  return emitWithAck<Ack>('game:go:resign', {});
}
