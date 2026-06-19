export {
  createChessGame,
  applyChessMove,
  resignChessGame,
  getCurrentPlayerId,
  getLegalMoves,
  deductElapsedTime,
  tickChessGame,
  type ChessGameState,
  type ChessPlayerState,
  type ChessColor,
  type ChessPhase,
  type ChessPromotion,
  type ChessEndReason,
  type ChessLastMove,
  type ChessMoveOption,
  type ChessTimeSettings,
  type ChessStartOptions,
} from './logic.js';
export { generateBotChessMove, applyBotChessMove } from './bot.js';
export { chessModule } from './module.js';
