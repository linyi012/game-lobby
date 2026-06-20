import type { GameModule } from '@game-lobby/game-core';
import { defaultResolveJoinRole } from '@game-lobby/game-core';
import type { RoomDetail } from '@game-lobby/shared';
import {
  createLifeboatGame,
  redactLifeboatState,
  type LifeboatGameState,
  type LifeboatStartOptions,
} from './logic.js';

export type { LifeboatStartOptions } from './logic.js';

export const lifeboatModule: GameModule<LifeboatGameState, LifeboatStartOptions> = {
  gameType: 'lifeboat',

  create(participants, options = {}) {
    return createLifeboatGame(participants, options);
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  projectState(state, viewerId) {
    return redactLifeboatState(state, viewerId);
  },

  insufficientPlayersHint() {
    return '怒海求生至少需要 4 名玩家';
  },

  resolveJoinRole(ctx) {
    return defaultResolveJoinRole(ctx);
  },

  canAddBot(room: RoomDetail) {
    return { ok: false as const, message: '怒海求生不支持电脑玩家' };
  },
};
