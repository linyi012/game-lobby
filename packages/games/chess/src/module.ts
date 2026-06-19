import type { GameModule } from '@game-lobby/game-core';
import { applyBotChessMove } from './bot.js';
import {
  createChessGame,
  applyChessMove,
  resignChessGame,
  getCurrentPlayerId,
  type ChessGameState,
  type ChessStartOptions,
} from './logic.js';

export type { ChessStartOptions } from './logic.js';

export const chessModule: GameModule<ChessGameState, ChessStartOptions> = {
  gameType: 'chess',

  create(participants, options = {}) {
    return createChessGame(participants, options);
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  runBotTurn(state, ctx) {
    const currentId = getCurrentPlayerId(state);
    if (state.phase !== 'playing' || currentId !== ctx.playerId) return null;

    const member = ctx.roomPlayers.find((p) => p.id === ctx.playerId);
    if (!member?.botDifficulty) return null;

    return applyBotChessMove(state, ctx.playerId, member.botDifficulty);
  },

  insufficientPlayersHint() {
    return '可添加电脑，或将多余玩家设为旁观。';
  },
};

export { createChessGame, applyChessMove, resignChessGame, getCurrentPlayerId, getLegalMoves } from './logic.js';
export { generateBotChessMove, applyBotChessMove } from './bot.js';
export { tickChessGame } from './timer.js';
