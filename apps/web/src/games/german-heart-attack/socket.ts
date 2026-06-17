import { getActiveSocket } from '../../lib/socket';
import type { Fruit } from '@game-lobby/game-engine';

export function emitHeartAttackFlip() {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:heartattack:flip', {}, resolve);
  });
}

export function emitHeartAttackSlap() {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:heartattack:slap', {}, resolve);
  });
}

export function emitHeartAttackChooseWild(fruit: Fruit) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:heartattack:choose_wild', { fruit }, resolve);
  });
}
