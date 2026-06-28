import { emitWithAck } from '../../lib/emit-with-ack';

type Ack = { ok: boolean };

export function emitHeartAttackFlip() {
  return emitWithAck<Ack>('game:heartattack:flip', {});
}

export function emitHeartAttackSlap() {
  return emitWithAck<Ack>('game:heartattack:slap', {});
}

export function emitHeartAttackChooseWild(fruit: string) {
  return emitWithAck<Ack>('game:heartattack:choose_wild', { fruit });
}
