import { describe, expect, it } from 'vitest';
import type { WerewolfRole } from './logic.js';
import {
  advanceFromDayAnnounce,
  advanceWerewolfFromReveal,
  createWerewolfGame,
  redactWerewolfState,
  submitDayVote,
  submitGuardProtect,
  submitWolfVote,
  validateRoleBoard,
  type WerewolfGameState,
} from './logic.js';

function participants(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `玩家${i}`,
    isBot: false,
  }));
}

function forceRoles(state: WerewolfGameState, roles: WerewolfRole[]) {
  return {
    ...state,
    players: state.players.map((p, i) => ({ ...p, role: roles[i] ?? p.role })),
  };
}

function ROLE_PRESET_6(): WerewolfRole[] {
  return ['werewolf', 'werewolf', 'seer', 'hunter', 'villager', 'villager'];
}

describe('validateRoleBoard', () => {
  it('rejects mismatched counts', () => {
    const r = validateRoleBoard(ROLE_PRESET_6(), 5);
    expect(r.ok).toBe(false);
  });

  it('rejects too few wolves', () => {
    const roles: WerewolfRole[] = ['werewolf', 'villager', 'villager', 'villager', 'villager', 'villager'];
    const r = validateRoleBoard(roles, 6);
    expect(r.ok).toBe(false);
  });

  it('accepts simple 6 board', () => {
    const r = validateRoleBoard(ROLE_PRESET_6(), 6);
    expect(r.ok).toBe(true);
  });
});

describe('createWerewolfGame', () => {
  it('starts at night wolf phase', () => {
    const state = createWerewolfGame(participants(6), { rolePreset: 'simple_6' });
    expect(state.phase).toBe('night_wolf');
    expect(state.players).toHaveLength(6);
  });
});

describe('wolf vote and night resolve', () => {
  it('resolves wolf kill after all wolves vote', () => {
    let state = createWerewolfGame(participants(6), { rolePreset: 'simple_6' });
    state = forceRoles(state, [
      'werewolf',
      'werewolf',
      'seer',
      'hunter',
      'villager',
      'villager',
    ]);
    const wolves = state.players.filter((p) => p.role === 'werewolf');
    const target = state.players.find((p) => p.role === 'villager')!;
    state = submitWolfVote(state, wolves[0]!.id, target.id);
    state = submitWolfVote(state, wolves[1]!.id, target.id);
    expect(state.nightState.wolfKillTarget).toBe(target.id);
    expect(state.phase).toBe('night_seer');
  });
});

describe('guard blocks wolf kill', () => {
  it('prevents death when guard protects target', () => {
    let state = createWerewolfGame(participants(6), {
      rolePreset: 'custom',
      customRoles: ['werewolf', 'werewolf', 'guard', 'villager', 'villager', 'villager'],
    });
    state = forceRoles(state, [
      'werewolf',
      'werewolf',
      'guard',
      'villager',
      'villager',
      'villager',
    ]);
    const wolves = state.players.filter((p) => p.role === 'werewolf');
    const guard = state.players.find((p) => p.role === 'guard')!;
    const target = state.players.find((p) => p.role === 'villager')!;
    state = submitWolfVote(state, wolves[0]!.id, target.id);
    state = submitWolfVote(state, wolves[1]!.id, target.id);
    state = {
      ...state,
      phase: 'night_guard',
      nightState: { ...state.nightState, wolfKillTarget: target.id },
    };
    state = submitGuardProtect(state, guard.id, target.id);
    expect(state.phase).toBe('day_announce');
    expect(state.nightDeaths).toHaveLength(0);
  });
});

describe('day vote tie', () => {
  it('eliminates nobody on tie', () => {
    let state = createWerewolfGame(participants(6), { rolePreset: 'simple_6' });
    state = {
      ...state,
      phase: 'day_vote',
      players: state.players.map((p) => ({ ...p, role: 'villager' as const })),
    };
    state = forceRoles(state, [
      'werewolf',
      'werewolf',
      'seer',
      'hunter',
      'villager',
      'villager',
    ]);
    state = submitDayVote(state, 'p0', 'p2');
    state = submitDayVote(state, 'p1', 'p3');
    state = submitDayVote(state, 'p2', 'p0');
    state = submitDayVote(state, 'p3', 'p1');
    state = submitDayVote(state, 'p4', 'p0');
    state = submitDayVote(state, 'p5', 'p1');
    expect(state.phase).toBe('reveal');
    expect(state.lastEliminated).toBeNull();
    expect(state.gameContinues).toBe(true);
  });
});

describe('redactWerewolfState', () => {
  it('hides other roles from villager', () => {
    const state = createWerewolfGame(participants(6), { rolePreset: 'simple_6' });
    const redacted = redactWerewolfState(state, state.players[4]!.id);
    const me = redacted.players.find((p) => p.id === state.players[4]!.id);
    const other = redacted.players.find((p) => p.id !== state.players[4]!.id);
    expect(me?.role).not.toBe('unknown');
    expect(other?.role).toBe('unknown');
  });

  it('shows all roles when ended', () => {
    let state = createWerewolfGame(participants(6), { rolePreset: 'simple_6' });
    state = { ...state, phase: 'ended', winner: 'village' };
    const redacted = redactWerewolfState(state, 'p0');
    expect(redacted.players.every((p) => p.role !== 'unknown')).toBe(true);
  });
});

describe('win condition', () => {
  it('village wins when all wolves dead', () => {
    let state = createWerewolfGame(participants(6), { rolePreset: 'simple_6' });
    state = forceRoles(state, [
      'werewolf',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ]);
    state = {
      ...state,
      phase: 'day_vote',
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, isAlive: false } : { ...p, isAlive: true },
      ),
    };
    const wolves = state.players.filter((p) => p.isAlive && p.role === 'werewolf');
    expect(wolves).toHaveLength(0);
    state = { ...state, winner: 'village', gameContinues: false, phase: 'reveal' };
    state = advanceWerewolfFromReveal(state);
    expect(state.phase).toBe('ended');
    expect(state.winner).toBe('village');
  });
});

describe('advanceWerewolfFromReveal', () => {
  it('moves to ended when game does not continue', () => {
    let state = createWerewolfGame(participants(6), { rolePreset: 'simple_6' });
    state = {
      ...state,
      phase: 'reveal',
      gameContinues: false,
      winner: 'village',
    };
    state = advanceWerewolfFromReveal(state);
    expect(state.phase).toBe('ended');
  });
});

describe('day announce', () => {
  it('enters discuss phase', () => {
    let state = createWerewolfGame(participants(6), { rolePreset: 'simple_6' });
    state = { ...state, phase: 'day_announce' };
    state = advanceFromDayAnnounce(state);
    expect(state.phase).toBe('day_discuss');
  });
});
