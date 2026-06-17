import { describe, expect, it } from 'vitest';
import {
  createDrawGuessGame,
  selectWord,
  tickDrawGuess,
  submitGuess,
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
});
