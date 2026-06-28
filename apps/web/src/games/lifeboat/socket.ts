import { emitWithAck } from '../../lib/emit-with-ack';
import type { LifeboatActionPayload, CombatSide } from '@game-lobby/game-engine';

type Ack = { ok: boolean };

export function emitLifeboatSupplyPick(cardIndex: number) {
  return emitWithAck<Ack>('game:lifeboat:supply_pick', { cardIndex });
}

export function emitLifeboatAction(action: LifeboatActionPayload) {
  return emitWithAck<Ack>('game:lifeboat:action', action);
}

export function emitLifeboatRespond(accept: boolean) {
  return emitWithAck<Ack>('game:lifeboat:respond', { accept });
}

export function emitLifeboatCombatSupport(side: CombatSide) {
  return emitWithAck<Ack>('game:lifeboat:combat_support', { side });
}

export function emitLifeboatNavigationPick(cardIndex: number) {
  return emitWithAck<Ack>('game:lifeboat:navigation_pick', { cardIndex });
}

export function emitLifeboatPlaySupply(
  cardId: string,
  context: 'thirst' | 'combat' | 'special' = 'thirst',
) {
  return emitWithAck<Ack>('game:lifeboat:play_supply', { cardId, context });
}

export function emitLifeboatSkipThirst() {
  return emitWithAck<Ack>('game:lifeboat:skip_thirst', {});
}
