import type { GameModule } from '@game-lobby/game-core';
import {
  createDrawGuessGame,
  redactDrawGuessState,
  type DrawGuessGameState,
  type DrawGuessStartOptions,
} from './logic.js';

export type { DrawGuessStartOptions } from './logic.js';

export const drawGuessModule: GameModule<DrawGuessGameState, DrawGuessStartOptions> = {
  gameType: 'draw_guess',

  create(participants, options = {}) {
    return createDrawGuessGame(participants, options);
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  projectState(state, viewerId) {
    return redactDrawGuessState(state, viewerId);
  },

  insufficientPlayersHint() {
    return '你画我猜至少需要 2 名玩家';
  },
};
