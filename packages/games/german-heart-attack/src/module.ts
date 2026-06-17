import type { GameModule } from '@game-lobby/game-core';
import {
  chooseWildFruit,
  flipHeartAttackCard,
  generateBotShouldSlap,
  generateBotWildChoice,
  slapHeartAttack,
  redactHeartAttackState,
  createHeartAttackGame,
  type HeartAttackGameState,
  type HeartAttackStartOptions,
} from './logic.js';

export type { HeartAttackStartOptions } from './logic.js';

export const heartAttackModule: GameModule<HeartAttackGameState, HeartAttackStartOptions> = {
  gameType: 'german_heart_attack',

  create(participants, options = {}) {
    return createHeartAttackGame(participants, options);
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  projectState(state, viewerId) {
    return redactHeartAttackState(state, viewerId);
  },

  runBotTurn(state, ctx) {
    const member = ctx.roomPlayers.find((p) => p.id === ctx.playerId);
    if (!member?.botDifficulty || state.phase !== 'playing') return null;

    if (state.stage === 'choosing_fruit' && state.wildFlipperId === ctx.playerId) {
      const fruit = generateBotWildChoice(state);
      return chooseWildFruit(state, ctx.playerId, fruit);
    }

    if (state.bellActive && generateBotShouldSlap(state, member.botDifficulty)) {
      return slapHeartAttack(state, ctx.playerId, Date.now());
    }

    const current = state.players[state.currentPlayerIndex];
    if (
      state.stage === 'flipping' &&
      current?.id === ctx.playerId &&
      current.isBot &&
      !state.bellActive
    ) {
      return flipHeartAttackCard(state, ctx.playerId);
    }

    if (state.stage === 'flipping' && current?.id === ctx.playerId && current.isBot) {
      return flipHeartAttackCard(state, ctx.playerId);
    }

    return null;
  },
};
