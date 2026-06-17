import { describe, it, expect } from 'vitest';
import { FOUR_PLAYERS, withMockRandom } from '@game-lobby/game-core/test/helpers';
import {
  advanceFromReveal,
  createUndercoverGame,
  endUndercoverSpeaking,
  redactUndercoverState,
  sendUndercoverSpeech,
  submitUndercoverVote,
} from './logic.js';

const PAIR_SOURCE = {
  categoryIds: ['food'],
  userPairPackIds: [],
  roomExtraPairs: [],
};

function describeRound(state: ReturnType<typeof createUndercoverGame>) {
  let s = state;
  const alive = s.players.filter((p) => p.isAlive);
  for (const p of alive) {
    s = sendUndercoverSpeech(s, p.id, '一条描述');
    s = endUndercoverSpeaking(s, p.id);
  }
  return s;
}

describe('undercover logic', () => {
  it('rejects speech from wrong player', () => {
    withMockRandom([0.1, 0.2, 0.3], () => {
      const state = createUndercoverGame([...FOUR_PLAYERS], ['苹果', '梨'], PAIR_SOURCE);
      const alive = state.players.filter((p) => p.isAlive);
      const wrongId = alive[1]!.id;
      const next = sendUndercoverSpeech(state, wrongId, 'hint');
      expect(next.speeches).toHaveLength(0);
    });
  });

  it('rejects speech containing own word', () => {
    withMockRandom([0.1, 0.2, 0.3], () => {
      let state = createUndercoverGame([...FOUR_PLAYERS], ['苹果', '梨'], PAIR_SOURCE);
      const speaker = state.players.filter((p) => p.isAlive)[0]!;
      if (!speaker.word) return;
      const next = sendUndercoverSpeech(state, speaker.id, `我喜欢${speaker.word}`);
      expect(next.speeches).toHaveLength(0);
    });
  });

  it('advances to vote after all players end speaking', () => {
    withMockRandom([0.1, 0.2, 0.3], () => {
      const state = createUndercoverGame([...FOUR_PLAYERS], ['苹果', '梨'], PAIR_SOURCE);
      const after = describeRound(state);
      expect(after.phase).toBe('vote');
    });
  });

  it('ends with civilian win when undercover is eliminated', () => {
    withMockRandom([0.1, 0.2, 0.3], () => {
      let state = describeRound(createUndercoverGame([...FOUR_PLAYERS], ['苹果', '梨'], PAIR_SOURCE));
      const undercover = state.players.find((p) => p.isUndercover)!;
      const alive = state.players.filter((p) => p.isAlive);
      for (const p of alive) {
        state = submitUndercoverVote(state, p.id, undercover.id);
        if (state.phase === 'reveal') break;
      }
      expect(state.phase).toBe('reveal');
      expect(state.winner).toBe('civilian');
      state = advanceFromReveal(state);
      expect(state.phase).toBe('ended');
    });
  });

  it('handles tie vote without elimination', () => {
    withMockRandom([0.1, 0.2, 0.3], () => {
      let state = describeRound(createUndercoverGame([...FOUR_PLAYERS], ['苹果', '梨'], PAIR_SOURCE));
      const alive = state.players.filter((p) => p.isAlive);
      const [a, b, c, d] = alive;
      state = submitUndercoverVote(state, a!.id, b!.id);
      state = submitUndercoverVote(state, b!.id, a!.id);
      state = submitUndercoverVote(state, c!.id, d!.id);
      state = submitUndercoverVote(state, d!.id, c!.id);
      expect(state.phase).toBe('reveal');
      expect(state.lastEliminated).toBeNull();
      expect(state.gameContinues).toBe(true);
    });
  });

  it('redacts secrets from other players', () => {
    withMockRandom([0.1, 0.2, 0.3], () => {
      const state = createUndercoverGame([...FOUR_PLAYERS], ['苹果', '梨'], PAIR_SOURCE);
      const viewer = state.players[0]!;
      const other = state.players[1]!;
      const otherView = redactUndercoverState(state, other.id);
      const selfView = redactUndercoverState(state, viewer.id);
      expect(otherView.civilianWord).toBe('');
      expect(otherView.players.find((p) => p.id === viewer.id)?.word).toBeNull();
      expect(selfView.players.find((p) => p.id === viewer.id)?.word).toBe(viewer.word);
    });
  });

  it('preserves speech history across in-game rounds', () => {
    withMockRandom([0.1, 0.2, 0.3], () => {
      let state = describeRound(createUndercoverGame([...FOUR_PLAYERS], ['苹果', '梨'], PAIR_SOURCE));
      const alive = state.players.filter((p) => p.isAlive);
      const target = alive[0]!;
      for (const p of alive) {
        state = submitUndercoverVote(state, p.id, target.id);
        if (state.phase === 'reveal') break;
      }
      const speechCountBefore = state.speeches.length;
      expect(speechCountBefore).toBeGreaterThan(0);
      state = advanceFromReveal(state);
      expect(state.round).toBe(2);
      expect(state.speeches).toHaveLength(speechCountBefore);
    });
  });

  it('rejects vote in describe phase', () => {
    withMockRandom([0.1], () => {
      const state = createUndercoverGame([...FOUR_PLAYERS], ['苹果', '梨'], PAIR_SOURCE);
      const target = state.players[0]!.id;
      expect(submitUndercoverVote(state, state.players[1]!.id, target)).toBe(state);
    });
  });
});
