import { describe, expect, it } from 'vitest';
import {
  advanceFromReveal,
  advancePhaseOnTimeout,
  createScriptMurderGame,
  hostAdvancePhase,
  hostRevealClue,
  redactScriptMurderState,
  sendSpeech,
  submitVote,
} from './logic.js';
import { officialSampleContent } from '@game-lobby/script-murder-scripts';

const participants = [
  { id: 'p1', name: '甲', isBot: false },
  { id: 'p2', name: '乙', isBot: false },
  { id: 'p3', name: '丙', isBot: false },
  { id: 'p4', name: '丁', isBot: false },
];

function makeGame() {
  return createScriptMurderGame(participants, {
    scriptId: 'test-script',
    scriptTitle: '测试剧本',
    script: officialSampleContent,
    hostMemberId: 'p1',
  });
}

describe('createScriptMurderGame', () => {
  it('assigns all characters', () => {
    const state = makeGame();
    expect(state.players).toHaveLength(4);
    expect(new Set(state.players.map((p) => p.characterId)).size).toBe(4);
  });

  it('throws when player count mismatches', () => {
    expect(() =>
      createScriptMurderGame(participants.slice(0, 2), {
        scriptId: 'x',
        scriptTitle: 'x',
        script: officialSampleContent,
        hostMemberId: 'p1',
      }),
    ).toThrow();
  });
});

describe('phase flow', () => {
  it('allows speech in discussion', () => {
    let state = makeGame();
    while (state.phase !== 'discussion' && state.phase !== 'ended') {
      state = hostAdvancePhase(state, 'p1', Date.now());
    }
    if (state.phase !== 'discussion') return;
    const next = sendSpeech(state, 'p2', '我怀疑甲');
    expect(next.speeches.length).toBe(1);
  });

  it('advances on timeout when not paused', () => {
    const state = makeGame();
    const deadline = state.phaseDeadline!;
    const next = advancePhaseOnTimeout(state, deadline + 1);
    expect(next.currentPhaseIndex).toBe(1);
  });

  it('host can reveal clue', () => {
    const state = makeGame();
    const clueId = officialSampleContent.clues[0]!.id;
    const next = hostRevealClue(state, 'p1', clueId);
    expect(next.revealedClueIds).toContain(clueId);
  });
});

describe('redactScriptMurderState', () => {
  it('hides other players private scripts', () => {
    const state = makeGame();
    const redacted = redactScriptMurderState(state, 'p2');
    const myChar = state.players.find((p) => p.id === 'p2')!.characterId;
    const mine = redacted.script.characters.find((c) => c.id === myChar);
    const other = redacted.script.characters.find((c) => c.id !== myChar);
    expect(mine?.privateScript.length).toBeGreaterThan(0);
    expect(other?.privateScript).toBe('');
  });

  it('shows full script to host', () => {
    const state = makeGame();
    const redacted = redactScriptMurderState(state, 'p1');
    expect(redacted.script.characters.every((c) => c.privateScript.length > 0)).toBe(true);
  });
});

describe('vote', () => {
  it('records vote in vote phase', () => {
    let state = makeGame();
    while (state.phase !== 'vote' && state.phase !== 'ended') {
      state = hostAdvancePhase(state, 'p1', Date.now());
    }
    if (state.phase !== 'vote') return;
    const next = submitVote(state, 'p2', 'p3');
    expect(next.votes.p2).toBe('p3');
  });
});

describe('reveal continue', () => {
  it('advances after continue from reveal', () => {
    let state = makeGame();
    while (state.phase !== 'reveal' && state.phase !== 'ended') {
      state = hostAdvancePhase(state, 'p1', Date.now());
    }
    if (state.phase !== 'reveal' || !state.awaitingContinue) return;
    const next = advanceFromReveal(state, Date.now());
    expect(next.awaitingContinue).toBe(false);
  });
});
