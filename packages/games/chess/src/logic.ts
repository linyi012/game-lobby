import { Chess, type Square } from 'chess.js';
import { applyIncrementAfterMove, deductElapsedTime } from './timer.js';

export type ChessColor = 'w' | 'b';
export type ChessPhase = 'playing' | 'ended';
export type ChessPromotion = 'q' | 'r' | 'b' | 'n';
export type ChessEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'resignation'
  | 'timeout'
  | null;

export interface ChessPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  color: ChessColor;
  mainTimeMs: number;
}

export interface ChessTimeSettings {
  mainTimeMs: number;
  incrementMs: number;
}

export interface ChessLastMove {
  from: string;
  to: string;
  san: string;
  promotion?: ChessPromotion;
}

export interface ChessMoveOption {
  from: string;
  to: string;
  san: string;
  promotion?: ChessPromotion;
}

export interface ChessGameState {
  phase: ChessPhase;
  fen: string;
  players: ChessPlayerState[];
  currentColor: ChessColor;
  turnStartedAt: number;
  timeSettings: ChessTimeSettings;
  lastMove: ChessLastMove | null;
  winnerId: string | null;
  endReason: ChessEndReason;
  message: string;
}

export interface ChessStartOptions {
  mainTimeSec?: number;
  incrementSec?: number;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function colorLabel(color: ChessColor): string {
  return color === 'w' ? '白方' : '黑方';
}

function findPlayerById(state: ChessGameState, id: string): ChessPlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

function findPlayerByColor(state: ChessGameState, color: ChessColor): ChessPlayerState | undefined {
  return state.players.find((p) => p.color === color);
}

function resolveGameOver(
  state: ChessGameState,
  chess: Chess,
  mover: ChessPlayerState,
): ChessGameState {
  if (!chess.isGameOver()) {
    const next = findPlayerByColor(state, state.currentColor);
    return {
      ...state,
      message: chess.inCheck()
        ? `${next?.name ?? colorLabel(state.currentColor)} 被将军`
        : `轮到 ${next?.name ?? colorLabel(state.currentColor)}`,
    };
  }

  if (chess.isCheckmate()) {
    return {
      ...state,
      phase: 'ended',
      winnerId: mover.id,
      endReason: 'checkmate',
      message: `${mover.name} 将杀获胜`,
    };
  }

  if (chess.isStalemate()) {
    return {
      ...state,
      phase: 'ended',
      winnerId: null,
      endReason: 'stalemate',
      message: '逼和',
    };
  }

  return {
    ...state,
    phase: 'ended',
    winnerId: null,
    endReason: 'draw',
    message: '和棋',
  };
}

export function createChessGame(
  participants: { id: string; name: string; isBot: boolean }[],
  options: ChessStartOptions = {},
): ChessGameState {
  const active = participants.slice(0, 2);
  const white = active[0]!;
  const black = active[1]!;
  const mainTimeMs = (options.mainTimeSec ?? 600) * 1000;
  const incrementMs = (options.incrementSec ?? 5) * 1000;
  const now = Date.now();

  const players: ChessPlayerState[] = [
    { id: white.id, name: white.name, isBot: white.isBot, color: 'w', mainTimeMs },
    { id: black.id, name: black.name, isBot: black.isBot, color: 'b', mainTimeMs },
  ];

  return {
    phase: 'playing',
    fen: INITIAL_FEN,
    players,
    currentColor: 'w',
    turnStartedAt: now,
    timeSettings: { mainTimeMs, incrementMs },
    lastMove: null,
    winnerId: null,
    endReason: null,
    message: `${white.name}（白）先行`,
  };
}

export function getLegalMoves(state: ChessGameState, from?: string): ChessMoveOption[] {
  if (state.phase !== 'playing') return [];

  const chess = new Chess(state.fen);
  const moves = from
    ? chess.moves({ square: from as Square, verbose: true })
    : chess.moves({ verbose: true });

  return moves.map((m) => ({
    from: m.from,
    to: m.to,
    san: m.san,
    promotion: m.promotion as ChessPromotion | undefined,
  }));
}

export function applyChessMove(
  state: ChessGameState,
  playerId: string,
  from: string,
  to: string,
  promotion?: ChessPromotion,
  now = Date.now(),
): ChessGameState {
  if (state.phase !== 'playing') return state;

  const player = findPlayerById(state, playerId);
  if (!player || player.color !== state.currentColor) return state;

  const chess = new Chess(state.fen);
  const moveInput: { from: Square; to: Square; promotion?: ChessPromotion } = {
    from: from as Square,
    to: to as Square,
  };
  if (promotion) moveInput.promotion = promotion;

  let move;
  try {
    move = chess.move(moveInput);
  } catch {
    return state;
  }
  if (!move) return state;

  let next = applyIncrementAfterMove(state, player.color, now);
  next = {
    ...next,
    fen: chess.fen(),
    lastMove: {
      from: move.from,
      to: move.to,
      san: move.san,
      promotion: move.promotion as ChessPromotion | undefined,
    },
  };

  return resolveGameOver(next, chess, player);
}

export function resignChessGame(state: ChessGameState, playerId: string): ChessGameState {
  if (state.phase !== 'playing') return state;

  const player = findPlayerById(state, playerId);
  if (!player) return state;

  const winner = state.players.find((p) => p.id !== playerId);
  return {
    ...state,
    phase: 'ended',
    winnerId: winner?.id ?? null,
    endReason: 'resignation',
    message: `${player.name} 认输，${winner?.name ?? '对手'} 获胜`,
  };
}

export function getCurrentPlayerId(state: ChessGameState): string | null {
  return findPlayerByColor(state, state.currentColor)?.id ?? null;
}

export { deductElapsedTime, tickChessGame } from './timer.js';
