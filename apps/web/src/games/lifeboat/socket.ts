import { getActiveSocket } from '../../lib/socket';
import type { LifeboatActionPayload, CombatSide } from '@game-lobby/game-engine';

export function emitLifeboatSupplyPick(cardIndex: number) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:lifeboat:supply_pick', { cardIndex }, resolve);
  });
}

export function emitLifeboatAction(action: LifeboatActionPayload) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:lifeboat:action', action, resolve);
  });
}

export function emitLifeboatRespond(accept: boolean) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:lifeboat:respond', { accept }, resolve);
  });
}

export function emitLifeboatCombatSupport(side: CombatSide) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:lifeboat:combat_support', { side }, resolve);
  });
}

export function emitLifeboatNavigationPick(cardIndex: number) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:lifeboat:navigation_pick', { cardIndex }, resolve);
  });
}

export function emitLifeboatPlaySupply(cardId: string, context: 'thirst' | 'combat' | 'special' = 'thirst') {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:lifeboat:play_supply', { cardId, context }, resolve);
  });
}

export function emitLifeboatSkipThirst() {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:lifeboat:skip_thirst', {}, resolve);
  });
}
