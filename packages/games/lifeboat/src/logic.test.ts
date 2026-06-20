import { describe, expect, it } from 'vitest';
import { withMockRandom, FOUR_PLAYERS } from '@game-lobby/game-core';
import {
  createLifeboatGame,
  pickSupply,
  submitAction,
  respondToRequest,
  resolveCombat,
  redactLifeboatState,
  pickNavigation,
  skipThirst,
} from './logic.js';
import { CHARACTER_BY_ID } from './characters.js';

describe('createLifeboatGame', () => {
  it('creates game with 4 players in supply draft', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], () => {
      const state = createLifeboatGame([...FOUR_PLAYERS]);
      expect(state.players).toHaveLength(4);
      expect(state.phase).toBe('supply_draft');
      expect(state.supplyDraft).not.toBeNull();
      expect(state.seagullCount).toBe(0);
      const charIds = new Set(state.players.map((p) => p.characterId));
      expect(charIds.size).toBe(4);
    });
  });

  it('assigns distinct love and hate targets', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], () => {
      const state = createLifeboatGame([...FOUR_PLAYERS]);
      for (const p of state.players) {
        expect(p.loveCharacterId).not.toBe(p.characterId);
        expect(p.hateCharacterId).not.toBe(p.characterId);
        expect(p.loveCharacterId).not.toBe(p.hateCharacterId);
      }
    });
  });
});

describe('pickSupply', () => {
  it('adds picked card to player hand', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4], () => {
      let state = createLifeboatGame([...FOUR_PLAYERS]);
      const picker = state.players[state.supplyDraft!.pickerPlayerIndex]!;
      const before = picker.hand.length;
      state = pickSupply(state, picker.id, 0);
      const after = state.players.find((p) => p.id === picker.id)!;
      expect(after.hand.length).toBe(before + 1);
      expect(after.handCount).toBe(after.hand.length);
    });
  });
});

describe('submitAction', () => {
  it('row adds card to rowing pile and marks thirst', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], () => {
      let state = createLifeboatGame([...FOUR_PLAYERS]);
      while (state.phase === 'supply_draft' && state.supplyDraft) {
        const picker = state.players[state.supplyDraft.pickerPlayerIndex]!;
        state = pickSupply(state, picker.id, 0);
      }
      expect(state.phase).toBe('action');
      const actor = state.players.filter((p) => !p.isDead).sort((a, b) => a.seatIndex - b.seatIndex)[0]!;
      const navBefore = state.navigationDeck.length;
      state = submitAction(state, actor.id, { type: 'row' });
      expect(state.rowingPile.length).toBeGreaterThan(0);
      expect(state.navigationDeck.length).toBeLessThanOrEqual(navBefore);
      const actorAfter = state.players.find((p) => p.id === actor.id)!;
      expect(actorAfter.thirstPending).toBe(true);
    });
  });

  it('kid steal does not enter pending response', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], () => {
      let state = createLifeboatGame([...FOUR_PLAYERS]);
      while (state.phase === 'supply_draft' && state.supplyDraft) {
        const picker = state.players[state.supplyDraft.pickerPlayerIndex]!;
        state = pickSupply(state, picker.id, 0);
      }
      const kid = state.players.find((p) => p.characterId === 'kid');
      if (!kid) return;
      while (state.phase === 'action') {
        const sorted = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
        const actor = sorted[state.actionPlayerIndex];
        if (!actor) break;
        if (actor.id === kid.id) {
          const target = state.players.find((p) => p.id !== kid.id && !p.isDead)!;
          target.hand.push({ id: 'test-jewel', kind: 'jewelry', points: 1 });
          target.handCount = target.hand.length;
          state = submitAction(state, kid.id, { type: 'steal', targetPlayerId: target.id });
          expect(state.phase).not.toBe('pending_response');
          return;
        }
        state = submitAction(state, actor.id, { type: 'pass' });
      }
    });
  });
});

describe('combat', () => {
  it('defender wins when stronger and attacker takes damage', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4], () => {
      const state = createLifeboatGame([...FOUR_PLAYERS]);
      const captain = state.players.find((p) => p.characterId === 'captain');
      const kid = state.players.find((p) => p.characterId === 'kid');
      if (!captain || !kid) return;
      const combatState = {
        ...state,
        phase: 'combat' as const,
        combat: {
          attackerId: kid.id,
          defenderId: captain.id,
          reason: 'steal' as const,
          supports: {},
          resolved: false,
        },
      };
      const next = resolveCombat(combatState);
      expect(next.combat).toBeNull();
      const loser = next.players.find((p) => p.id === kid.id)!;
      expect(loser.damage).toBeGreaterThan(0);
    });
  });
});

describe('redactLifeboatState', () => {
  it('hides other players hands', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4], () => {
      const state = createLifeboatGame([...FOUR_PLAYERS]);
      state.players[0]!.hand.push({ id: 'x', kind: 'water', points: 0 });
      state.players[0]!.handCount = 1;
      const redacted = redactLifeboatState(state, state.players[1]!.id);
      const self = redacted.players.find((p) => p.id === state.players[0]!.id)!;
      expect(self.hand).toHaveLength(0);
      expect(self.handCount).toBe(1);
    });
  });
});

describe('seagull end', () => {
  it('ends game at 4 seagulls', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4], () => {
      let state = createLifeboatGame([...FOUR_PLAYERS]);
      state.seagullCount = 4;
      state = pickNavigation(
        {
          ...state,
          phase: 'navigation_pick',
          navigatorId: state.players[0]!.id,
          navigationChoices: [{ id: 'n1', label: '海鸥', effects: [{ type: 'seagull', delta: 0 }] }],
          rowingPile: [{ id: 'n1', label: '海鸥', effects: [{ type: 'seagull', delta: 0 }] }],
        },
        state.players[0]!.id,
        0,
      );
      expect(state.phase).toBe('ended');
      expect(state.scores).not.toBeNull();
    });
  });
});

describe('skipThirst', () => {
  it('applies damage when no water', () => {
    withMockRandom([0.1, 0.2, 0.3, 0.4], () => {
      const state = createLifeboatGame([...FOUR_PLAYERS]);
      const pid = state.players[0]!.id;
      const thirsty = {
        ...state,
        phase: 'thirst_resolve' as const,
        thirstQueue: [pid],
      };
      const next = skipThirst(thirsty, pid);
      expect(next.players.find((p) => p.id === pid)!.damage).toBe(1);
    });
  });
});
