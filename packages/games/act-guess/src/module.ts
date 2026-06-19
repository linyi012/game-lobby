import type { GameModule } from '@game-lobby/game-core';
import {
  createActGuessGame,
  redactActGuessState,
  type ActGuessGameState,
  type ActGuessStartOptions,
} from './logic.js';

export type { ActGuessStartOptions } from './logic.js';

export const actGuessModule: GameModule<ActGuessGameState, ActGuessStartOptions> = {
  gameType: 'act_guess',

  create(participants, options = {}) {
    return createActGuessGame(participants, options);
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  projectState(state, viewerId) {
    return redactActGuessState(state, viewerId);
  },

  insufficientPlayersHint() {
    return '你比画我猜至少需要 2 名玩家';
  },
};
