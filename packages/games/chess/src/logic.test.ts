import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { applyBotChessMove, generateBotChessMove } from './bot.js';
import {
  applyChessMove,
  createChessGame,
  getLegalMoves,
  resignChessGame,
  tickChessGame,
} from './logic.js';

const participants = [
  { id: 'p1', name: 'Alice', isBot: false },
  { id: 'p2', name: 'Bob', isBot: false },
];

describe('createChessGame', () => {
  it('creates initial position with white to move', () => {
    const state = createChessGame(participants);
    expect(state.phase).toBe('playing');
    expect(state.currentColor).toBe('w');
    expect(state.players).toHaveLength(2);
    expect(state.players[0]!.color).toBe('w');
    expect(state.players[1]!.color).toBe('b');
    expect(state.timeSettings.mainTimeMs).toBe(600_000);
    expect(state.timeSettings.incrementMs).toBe(5_000);
  });

  it('respects custom time settings', () => {
    const state = createChessGame(participants, { mainTimeSec: 300, incrementSec: 10 });
    expect(state.timeSettings.mainTimeMs).toBe(300_000);
    expect(state.timeSettings.incrementMs).toBe(10_000);
  });
});

describe('applyChessMove', () => {
  it('plays legal moves and switches turn', () => {
    let state = createChessGame(participants);
    const beforeWhite = state.players.find((p) => p.color === 'w')!.mainTimeMs;
    state = applyChessMove(state, 'p1', 'e2', 'e4', undefined, 1000);
    expect(state.currentColor).toBe('b');
    expect(state.lastMove?.san).toBe('e4');
    const afterWhite = state.players.find((p) => p.color === 'w')!.mainTimeMs;
    expect(afterWhite).toBeGreaterThan(beforeWhite - 2000);
  });

  it('rejects illegal moves', () => {
    const state = createChessGame(participants);
    const next = applyChessMove(state, 'p1', 'e2', 'e5');
    expect(next).toBe(state);
  });

  it('rejects out-of-turn moves', () => {
    const state = createChessGame(participants);
    const next = applyChessMove(state, 'p2', 'e7', 'e5');
    expect(next).toBe(state);
  });

  it('supports castling', () => {
    const chess = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    let state = createChessGame(participants);
    state = { ...state, fen: chess.fen(), currentColor: 'w' };
    state = applyChessMove(state, 'p1', 'e1', 'g1');
    expect(state.lastMove?.san).toBe('O-O');
  });

  it('supports promotion', () => {
    const chess = new Chess('8/4P3/8/8/8/8/8/4K2k w - - 0 1');
    let state = createChessGame(participants);
    state = { ...state, fen: chess.fen(), currentColor: 'w' };
    state = applyChessMove(state, 'p1', 'e7', 'e8', 'q');
    expect(state.fen).toContain('Q');
  });
});

describe('getLegalMoves', () => {
  it('returns moves for a selected piece', () => {
    const state = createChessGame(participants);
    const moves = getLegalMoves(state, 'e2');
    expect(moves.some((m) => m.to === 'e4')).toBe(true);
  });
});

describe('resignChessGame', () => {
  it('ends game with opponent winning', () => {
    const state = createChessGame(participants);
    const next = resignChessGame(state, 'p1');
    expect(next.phase).toBe('ended');
    expect(next.winnerId).toBe('p2');
    expect(next.endReason).toBe('resignation');
  });
});

describe('tickChessGame', () => {
  it('ends game on timeout', () => {
    let state = createChessGame(participants, { mainTimeSec: 1, incrementSec: 0 });
    state = {
      ...state,
      turnStartedAt: Date.now() - 5000,
      players: state.players.map((p) =>
        p.color === 'w' ? { ...p, mainTimeMs: 0 } : p,
      ),
    };
    const next = tickChessGame(state, Date.now());
    expect(next.phase).toBe('ended');
    expect(next.endReason).toBe('timeout');
    expect(next.winnerId).toBe('p2');
  });
});

describe('checkmate', () => {
  it('detects fool mate', () => {
    let state = createChessGame(participants);
    state = applyChessMove(state, 'p1', 'f2', 'f3');
    state = applyChessMove(state, 'p2', 'e7', 'e5');
    state = applyChessMove(state, 'p1', 'g2', 'g4');
    state = applyChessMove(state, 'p2', 'd8', 'h4');
    expect(state.phase).toBe('ended');
    expect(state.endReason).toBe('checkmate');
    expect(state.winnerId).toBe('p2');
  });
});

describe('bot', () => {
  it('generates a legal move', () => {
    const state = createChessGame(participants);
    const move = generateBotChessMove(state, 'medium');
    expect(move).not.toBeNull();
    const chess = new Chess(state.fen);
    expect(chess.move({ from: move!.from, to: move!.to, promotion: move!.promotion })).toBeTruthy();
  });

  it('applies bot move', () => {
    const state = createChessGame([
      { id: 'bot', name: 'Bot', isBot: true },
      { id: 'p2', name: 'Bob', isBot: false },
    ]);
    const next = applyBotChessMove(state, 'bot', 'easy');
    expect(next.lastMove).not.toBeNull();
    expect(next.currentColor).toBe('b');
  });
});
