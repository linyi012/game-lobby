import { Chess, type Square } from 'chess.js';
import type { AiDifficulty } from '@game-lobby/shared';
import { pickRandom, shouldBotMakeMistake } from '@game-lobby/game-core';
import type { ChessGameState, ChessPromotion } from './logic.js';
import { applyChessMove } from './logic.js';

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function materialGain(chess: Chess, from: Square, to: Square, promotion?: ChessPromotion): number {
  const board = chess.board();
  let gain = 0;
  for (const row of board) {
    for (const piece of row) {
      if (piece && piece.square === to) {
        gain = PIECE_VALUES[piece.type] ?? 0;
      }
    }
  }
  if (promotion) gain += PIECE_VALUES[promotion] ?? 0;
  return gain;
}

function scoreMove(
  chess: Chess,
  from: Square,
  to: Square,
  promotion: ChessPromotion | undefined,
  difficulty: AiDifficulty,
): number {
  const clone = new Chess(chess.fen());
  let move;
  try {
    move = clone.move({ from, to, promotion });
  } catch {
    return -Infinity;
  }
  if (!move) return -Infinity;

  let score = materialGain(chess, from, to, promotion);
  if (clone.isCheckmate()) score += 10000;
  else if (clone.inCheck()) score += 50;

  if (difficulty !== 'easy') {
    const centerBonus = ['d4', 'e4', 'd5', 'e5'].includes(to) ? 8 : 0;
    score += centerBonus;
  }

  if (difficulty === 'hard' || difficulty === 'expert') {
    const opponentMoves = clone.moves({ verbose: true });
    let worstReply = 0;
    for (const reply of opponentMoves) {
      const replyClone = new Chess(clone.fen());
      try {
        replyClone.move({
          from: reply.from,
          to: reply.to,
          promotion: reply.promotion as ChessPromotion | undefined,
        });
      } catch {
        continue;
      }
      if (replyClone.isCheckmate()) worstReply = Math.max(worstReply, -10000);
      else {
        const captured = materialGain(clone, reply.from, reply.to, reply.promotion as ChessPromotion);
        worstReply = Math.max(worstReply, captured);
      }
    }
    score -= worstReply * (difficulty === 'expert' ? 1.2 : 0.8);
  }

  return score;
}

export function generateBotChessMove(
  state: ChessGameState,
  difficulty: AiDifficulty,
): { from: string; to: string; promotion?: ChessPromotion } | null {
  const chess = new Chess(state.fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  if (shouldBotMakeMistake(difficulty)) {
    const m = pickRandom(moves);
    return m
      ? {
          from: m.from,
          to: m.to,
          promotion: m.promotion as ChessPromotion | undefined,
        }
      : null;
  }

  let best = moves[0]!;
  let bestScore = -Infinity;
  for (const m of moves) {
    const s = scoreMove(
      chess,
      m.from,
      m.to,
      m.promotion as ChessPromotion | undefined,
      difficulty,
    );
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }

  return {
    from: best.from,
    to: best.to,
    promotion: best.promotion as ChessPromotion | undefined,
  };
}

export function applyBotChessMove(
  state: ChessGameState,
  playerId: string,
  difficulty: AiDifficulty,
): ChessGameState {
  const move = generateBotChessMove(state, difficulty);
  if (!move) return state;
  return applyChessMove(state, playerId, move.from, move.to, move.promotion);
}
