import type { GameModule } from '@game-lobby/game-core';
import {
  advanceFromReveal,
  createUndercoverGame,
  endUndercoverSpeaking,
  pickPairFromPool,
  redactUndercoverState,
  sendUndercoverSpeech,
  submitUndercoverVote,
  type UndercoverGameState,
  type UndercoverStartOptions,
} from './logic.js';

export type { UndercoverStartOptions } from './logic.js';

export const undercoverModule: GameModule<UndercoverGameState, UndercoverStartOptions> = {
  gameType: 'undercover',

  create(participants, options) {
    const pairPool = options.pairPool ?? [];
    const pair = pickPairFromPool(pairPool);
    return createUndercoverGame(participants, pair, {
      categoryIds: options.categoryIds ?? [],
      userPairPackIds: options.userPairPackIds ?? [],
      roomExtraPairs: options.roomExtraPairs ?? [],
    });
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  projectState(state, viewerId) {
    return redactUndercoverState(state, viewerId);
  },
};

export {
  advanceFromReveal,
  createUndercoverGame,
  endUndercoverSpeaking,
  pickPairFromPool,
  redactUndercoverState,
  sendUndercoverSpeech,
  submitUndercoverVote,
};
