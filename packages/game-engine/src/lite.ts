import type { GameType } from '@game-lobby/shared';
import { getGameModule } from './registry.js';

export function isGameEnded(gameType: GameType, state: unknown): boolean {
  return getGameModule(gameType).isEnded(state);
}

export function projectGameState(
  gameType: GameType,
  state: unknown,
  viewerId: string | null,
): unknown {
  const mod = getGameModule(gameType);
  if (mod.projectState) {
    return mod.projectState(state, viewerId);
  }
  return state;
}
