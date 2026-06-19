import { describe, expect, it } from 'vitest';
import {
  createActGuessGame,
  selectWord,
  tickActGuess,
  submitGuess,
  performerPass,
  performerConfirmCorrect,
  getConfirmableGuessers,
  redactActGuessState,
  canPlayerGuess,
  canPlayerSeeWord,
  type ActGuessGameState,
} from './logic.js';

const participants = [
  { id: 'p1', name: 'Alice', isBot: false },
  { id: 'p2', name: 'Bob', isBot: false },
  { id: 'p3', name: 'Carol', isBot: false },
  { id: 'p4', name: 'Dave', isBot: false },
] as const;

function makeState(now = 1_000_000, enableTeams = false): ActGuessGameState {
  const allPlayers = enableTeams
    ? [
        { id: 'p1', name: 'Alice', isSpectator: false },
        { id: 'p2', name: 'Bob', isSpectator: false },
        { id: 'p3', name: 'Carol', isSpectator: false },
        { id: 'p4', name: 'Dave', isSpectator: false },
      ]
    : [
        { id: 'p1', name: 'Alice', isSpectator: false },
        { id: 'p2', name: 'Bob', isSpectator: false },
      ];

  return createActGuessGame(
    (enableTeams ? participants : participants.slice(0, 2)).map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
    })),
    {
      wordPool: ['苹果', '香蕉', '西瓜', '猫', '狗'],
      categoryIds: ['daily'],
      allPlayers,
      enableTeams,
      teamAssignments: enableTeams
        ? { p1: 'A', p2: 'A', p3: 'B', p4: 'B' }
        : undefined,
    },
    now,
  );
}

function performingState(word = '苹果', enableTeams = false): ActGuessGameState {
  let state = makeState(0, enableTeams);
  if (!state.wordOptions.includes(word)) {
    state = { ...state, wordOptions: [word, ...state.wordOptions.slice(0, 2)] };
  }
  return selectWord(state, state.performerId, word, 0);
}

describe('createActGuessGame', () => {
  it('starts in word_select with 3 options', () => {
    const state = makeState();
    expect(state.phase).toBe('word_select');
    expect(state.wordOptions).toHaveLength(3);
    expect(state.performerOrder).toHaveLength(2);
    expect(state.teamScores).toBeNull();
    expect(state.turnPassedWords).toEqual([]);
  });

  it('builds interleaved performer order when teams enabled', () => {
    const state = makeState(0, true);
    expect(state.teams?.enabled).toBe(true);
    expect(state.performerOrder).toHaveLength(4);
    expect(state.teamScores).toEqual({ A: 0, B: 0 });
  });
});

describe('selectWord', () => {
  it('moves to performing phase', () => {
    const state = makeState();
    const word = state.wordOptions[0]!;
    const next = selectWord(state, state.performerId, word, 100);
    expect(next.phase).toBe('performing');
    expect(next.selectedWord).toBe(word);
  });
});

describe('submitGuess', () => {
  it('records guess without auto scoring', () => {
    const state = performingState();
    const guesser = state.activePlayerIds.find((id) => id !== state.performerId)!;
    const next = submitGuess(state, guesser, '苹果', 100);
    expect(next.guesses).toHaveLength(1);
    expect(next.guesses[0]?.correct).toBe(false);
    expect(next.scores[guesser]).toBe(0);
    expect(next.phase).toBe('performing');
  });

  it('rejects guess from opposing team', () => {
    const state = performingState('苹果', true);
    const performerTeam = state.teams!.assignments[state.performerId]!;
    const opponent = state.activePlayerIds.find(
      (id) => state.teams!.assignments[id] !== performerTeam,
    )!;
    expect(canPlayerGuess(state, opponent)).toBe(false);
    const next = submitGuess(state, opponent, '苹果', 100);
    expect(next.guesses).toHaveLength(0);
  });
});

describe('performerPass', () => {
  it('returns to word_select with same performer', () => {
    const state = performingState('苹果');
    const performerId = state.performerId;
    const next = performerPass(state, performerId, 100);
    expect(next.phase).toBe('word_select');
    expect(next.performerId).toBe(performerId);
    expect(next.turnPassedWords).toContain('苹果');
    expect(next.wordOptions).toHaveLength(3);
    expect(next.wordOptions).not.toContain('苹果');
  });

  it('rejects pass from non-performer', () => {
    const state = performingState();
    const guesser = state.activePlayerIds.find((id) => id !== state.performerId)!;
    const next = performerPass(state, guesser, 100);
    expect(next.phase).toBe('performing');
  });
});

describe('performerConfirmCorrect', () => {
  it('awards individual scores and ends round', () => {
    const state = performingState();
    const guesser = state.activePlayerIds.find((id) => id !== state.performerId)!;
    const next = performerConfirmCorrect(state, state.performerId, guesser, 100);
    expect(next.phase).toBe('round_end');
    expect(next.scores[guesser]).toBe(10);
    expect(next.scores[state.performerId]).toBe(5);
    expect(next.guesses.some((g) => g.correct && g.playerId === guesser)).toBe(true);
  });

  it('awards team scores when teams enabled', () => {
    const state = performingState('苹果', true);
    const performerTeam = state.teams!.assignments[state.performerId]!;
    const guesser = state.activePlayerIds.find(
      (id) => id !== state.performerId && state.teams!.assignments[id] === performerTeam,
    )!;
    const next = performerConfirmCorrect(state, state.performerId, guesser, 100);
    expect(next.phase).toBe('round_end');
    expect(next.teamScores![performerTeam]).toBeGreaterThan(0);
  });

  it('rejects confirm for opposing team member', () => {
    const state = performingState('苹果', true);
    const performerTeam = state.teams!.assignments[state.performerId]!;
    const opponent = state.activePlayerIds.find(
      (id) => state.teams!.assignments[id] !== performerTeam,
    )!;
    expect(getConfirmableGuessers(state)).not.toContain(opponent);
    const next = performerConfirmCorrect(state, state.performerId, opponent, 100);
    expect(next.phase).toBe('performing');
  });
});

describe('redactActGuessState', () => {
  it('hides word from guessers', () => {
    const state = performingState();
    const guesser = state.activePlayerIds.find((id) => id !== state.performerId)!;
    const redacted = redactActGuessState(state, guesser);
    expect(redacted.selectedWord).toBeNull();
  });

  it('shows word to performer', () => {
    const state = performingState();
    const redacted = redactActGuessState(state, state.performerId);
    expect(redacted.selectedWord).toBe('苹果');
  });

  it('shows word to opposing team in team mode', () => {
    const state = performingState('苹果', true);
    const performerTeam = state.teams!.assignments[state.performerId]!;
    const opponent = state.activePlayerIds.find(
      (id) => state.teams!.assignments[id] !== performerTeam,
    )!;
    expect(canPlayerSeeWord(state, opponent)).toBe(true);
    const redacted = redactActGuessState(state, opponent);
    expect(redacted.selectedWord).toBe('苹果');
  });
});

describe('tickActGuess', () => {
  it('ends game after all performers', () => {
    let state = makeState(0);
    for (let i = 0; i < state.performerOrder.length; i++) {
      const word = state.wordOptions[0] ?? '苹果';
      state = selectWord(state, state.performerId, word, 0);
      state = { ...state, phaseEndsAt: 0 };
      state = tickActGuess(state, 1);
      state = { ...state, phaseEndsAt: 0 };
      state = tickActGuess(state, 2);
    }
    expect(state.phase).toBe('ended');
  });
});
