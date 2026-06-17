import { describe, expect, it } from 'vitest';
import {
  createDrawGuessGame,
  selectWord,
  tickDrawGuess,
  submitGuess,
  submitPainterHint,
  revealPainterChar,
  redactDrawGuessState,
  type DrawGuessGameState,
} from './logic.js';

const participants = [
  { id: 'p1', name: 'Alice', isBot: false, isSpectator: false },
  { id: 'p2', name: 'Bob', isBot: false, isSpectator: false },
  { id: 'p3', name: 'Carol', isBot: false, isSpectator: true },
] as const;

function makeState(now = 1_000_000): DrawGuessGameState {
  return createDrawGuessGame(
    participants.filter((p) => !p.isSpectator),
    {
      wordPool: ['苹果', '香蕉', '西瓜', '猫', '狗'],
      categoryIds: ['daily'],
      allPlayers: participants.map((p) => ({
        id: p.id,
        name: p.name,
        isSpectator: !!p.isSpectator,
      })),
    },
    now,
  );
}

function drawingState(word = '苹果'): DrawGuessGameState {
  let state = makeState(0);
  if (!state.wordOptions.includes(word)) {
    state = { ...state, wordOptions: [word, ...state.wordOptions.slice(0, 2)] };
  }
  return selectWord(state, state.painterId, word, 0);
}

describe('createDrawGuessGame', () => {
  it('starts in word_select with 3 options', () => {
    const state = makeState();
    expect(state.phase).toBe('word_select');
    expect(state.wordOptions).toHaveLength(3);
    expect(state.painterOrder).toHaveLength(2);
  });
});

describe('selectWord and tick', () => {
  it('auto-selects on word_select timeout', () => {
    const state = makeState(0);
    const after = tickDrawGuess(state, state.wordSelectDurationMs + 1);
    expect(after.phase).toBe('drawing');
    expect(after.selectedWord).toBeTruthy();
  });

  it('ends drawing on timeout', () => {
    let state = makeState(0);
    const word = state.wordOptions[0]!;
    state = selectWord(state, state.painterId, word, 0);
    const after = tickDrawGuess(state, state.drawDurationMs + 1);
    expect(after.phase).toBe('round_end');
    expect(after.selectedWord).toBe(word);
  });
});

describe('submitGuess', () => {
  it('awards first guesser 10 and painter 5', () => {
    let state = makeState(0);
    const word = state.wordOptions[0]!;
    state = selectWord(state, state.painterId, word, 0);
    const guesser = state.activePlayerIds.find((id) => id !== state.painterId)!;
    state = submitGuess(state, guesser, word, 100);
    expect(state.scores[guesser]).toBe(10);
    expect(state.scores[state.painterId]).toBe(5);
  });

  it('rejects wrong guess', () => {
    let state = makeState(0);
    const word = state.wordOptions[0]!;
    state = selectWord(state, state.painterId, word, 0);
    const guesser = state.activePlayerIds.find((id) => id !== state.painterId)!;
    state = submitGuess(state, guesser, '错误答案', 100);
    expect(state.guessedIds).toHaveLength(0);
  });
});

describe('redactDrawGuessState', () => {
  it('hides correct guesses from players who have not guessed', () => {
    let state = makeState(0);
    const word = state.wordOptions[0]!;
    state = selectWord(state, state.painterId, word, 0);
    const guesser = state.activePlayerIds.find((id) => id !== state.painterId)!;
    state = submitGuess(state, guesser, word, 100);

    const painterView = redactDrawGuessState(state, state.painterId);
    expect(painterView.guesses.some((g) => g.correct)).toBe(true);

    const otherId = state.painterId;
    const redacted = redactDrawGuessState(state, otherId);
    expect(redacted.guesses.some((g) => g.correct && g.playerId === guesser)).toBe(true);
  });

  it('shows answer to players who have guessed during drawing', () => {
    const threePlayers = [
      { id: 'p1', name: 'Alice', isBot: false, isSpectator: false },
      { id: 'p2', name: 'Bob', isBot: false, isSpectator: false },
      { id: 'p3', name: 'Carol', isBot: false, isSpectator: false },
    ];
    let state = createDrawGuessGame(
      threePlayers,
      {
        wordPool: ['苹果', '香蕉', '西瓜'],
        allPlayers: threePlayers.map((p) => ({
          id: p.id,
          name: p.name,
          isSpectator: false,
        })),
      },
      0,
    );
    state = selectWord(state, state.painterId, '苹果', 0);
    const guesser = state.activePlayerIds.find((id) => id !== state.painterId)!;
    const waitingGuesser = state.activePlayerIds.find(
      (id) => id !== state.painterId && id !== guesser,
    )!;
    state = submitGuess(state, guesser, '苹果', 100);

    expect(state.phase).toBe('drawing');
    const guesserView = redactDrawGuessState(state, guesser);
    expect(guesserView.selectedWord).toBe('苹果');

    const waitingView = redactDrawGuessState(state, waitingGuesser);
    expect(waitingView.selectedWord).toBeNull();
  });
});

describe('submitPainterHint', () => {
  it('adds text hint and decrements remaining', () => {
    const state = drawingState();
    const after = submitPainterHint(state, state.painterId, '是一种水果', 100);
    expect(after.painterHints).toHaveLength(1);
    expect(after.painterHints[0]?.type).toBe('text');
    expect(after.painterHints[0]?.text).toBe('是一种水果');
    expect(after.hintsRemaining).toBe(2);
    expect(after.message).toBe('画家发布了提示');
  });

  it('rejects hint equal to answer', () => {
    const state = drawingState('苹果');
    const after = submitPainterHint(state, state.painterId, '苹果', 100);
    expect(after.painterHints).toHaveLength(0);
    expect(after.hintsRemaining).toBe(3);
  });

  it('rejects non-painter and wrong phase', () => {
    const state = drawingState();
    const guesser = state.activePlayerIds.find((id) => id !== state.painterId)!;
    expect(submitPainterHint(state, guesser, '提示', 100).painterHints).toHaveLength(0);
    expect(submitPainterHint(makeState(), state.painterId, '提示', 100).painterHints).toHaveLength(0);
  });
});

describe('revealPainterChar', () => {
  it('reveals selected index and updates wordHint', () => {
    const state = drawingState('苹果');
    const after = revealPainterChar(state, state.painterId, 1, 100);
    expect(after.revealedIndices).toEqual([1]);
    expect(after.wordHint).toBe('_ 果');
    expect(after.painterHints[0]?.type).toBe('reveal');
    expect(after.hintsRemaining).toBe(2);
  });

  it('rejects duplicate and invalid index', () => {
    let state = drawingState('苹果');
    state = revealPainterChar(state, state.painterId, 1, 100);
    expect(revealPainterChar(state, state.painterId, 1, 200).revealedIndices).toEqual([1]);
    expect(revealPainterChar(state, state.painterId, 99, 200).revealedIndices).toEqual([1]);
    expect(revealPainterChar(state, state.painterId, -1, 200).revealedIndices).toEqual([1]);
  });

  it('cannot reveal all characters', () => {
    let state = drawingState('苹果');
    state = revealPainterChar(state, state.painterId, 0, 100);
    expect(state.revealedIndices).toEqual([0]);
    expect(revealPainterChar(state, state.painterId, 1, 200).revealedIndices).toEqual([0]);
  });

  it('cannot reveal any character for single-char word', () => {
    const state = drawingState('猫');
    expect(revealPainterChar(state, state.painterId, 0, 100).revealedIndices).toHaveLength(0);
  });
});

describe('hint quota', () => {
  it('exhausts shared quota for text and reveal', () => {
    let state = drawingState('苹果');
    state = submitPainterHint(state, state.painterId, '提示1', 100);
    state = submitPainterHint(state, state.painterId, '提示2', 200);
    state = revealPainterChar(state, state.painterId, 0, 300);
    expect(state.hintsRemaining).toBe(0);
    expect(submitPainterHint(state, state.painterId, '提示4', 400).painterHints).toHaveLength(3);
    expect(revealPainterChar(state, state.painterId, 1, 400).revealedIndices).toEqual([0]);
  });

  it('resets hints on new round', () => {
    let state = drawingState('苹果');
    state = submitPainterHint(state, state.painterId, '提示', 100);
    state = tickDrawGuess(state, state.drawDurationMs + 1);
    state = tickDrawGuess(state, state.phaseEndsAt + 1);
    expect(state.hintsRemaining).toBe(3);
    expect(state.painterHints).toHaveLength(0);
    expect(state.revealedIndices).toHaveLength(0);
  });
});
