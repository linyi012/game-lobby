import { describe, expect, it } from 'vitest';
import {
  buildDeck,
  chooseWildFruit,
  computeFruitTotals,
  createHeartAttackGame,
  flipHeartAttackCard,
  isBellActive,
  redactHeartAttackState,
  slapHeartAttack,
} from './logic.js';

const players = [
  { id: 'p1', name: 'Alice', isBot: false },
  { id: 'p2', name: 'Bob', isBot: false },
];

describe('buildDeck', () => {
  it('builds 55 base cards without special', () => {
    expect(buildDeck(false)).toHaveLength(55);
    expect(buildDeck(false).every((c) => c.kind === 'normal')).toBe(true);
  });

  it('builds 62 cards with special', () => {
    const deck = buildDeck(true);
    expect(deck).toHaveLength(62);
    expect(deck.filter((c) => c.kind === 'wild')).toHaveLength(3);
    expect(deck.filter((c) => c.kind === 'double')).toHaveLength(2);
    expect(deck.filter((c) => c.kind === 'bomb')).toHaveLength(2);
  });
});

describe('createHeartAttackGame', () => {
  it('deals evenly and discards remainder', () => {
    const state = createHeartAttackGame(players, { useSpecialCards: false });
    const total = state.players.reduce((s, p) => s + p.hand.length, 0);
    expect(total).toBe(54);
    expect(state.discardCount).toBe(1);
    expect(state.phase).toBe('playing');
  });
});

describe('flip and totals', () => {
  it('updates fruit totals and bellActive', () => {
    let state = createHeartAttackGame(players);
    const idx = state.currentPlayerIndex;
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === idx
          ? {
              ...p,
              hand: [
                { kind: 'normal', fruit: 'cherry', count: 3 },
                { kind: 'normal', fruit: 'apple', count: 1 },
              ],
              handCount: 2,
            }
          : { ...p, hand: [{ kind: 'normal', fruit: 'apple', count: 1 }], handCount: 1 },
      ),
    };

    state = flipHeartAttackCard(state, state.players[idx]!.id);
    expect(state.fruitTotals.cherry).toBe(3);
    expect(state.bellActive).toBe(false);

    const turnIdx = state.currentPlayerIndex;
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === turnIdx
          ? {
              ...p,
              hand: [
                { kind: 'normal', fruit: 'cherry', count: 2 },
                { kind: 'normal', fruit: 'apple', count: 1 },
              ],
              handCount: 2,
            }
          : p,
      ),
    };

    state = flipHeartAttackCard(state, state.players[turnIdx]!.id);
    expect(state.fruitTotals.cherry).toBe(5);
    expect(state.bellActive).toBe(true);
    expect(state.phase).toBe('playing');
  });
});

describe('slap', () => {
  it('correct slap gives pile to slapper', () => {
    let state = createHeartAttackGame(players);
    state = {
      ...state,
      centerPile: [{ kind: 'normal', fruit: 'apple', count: 5 }],
      fruitTotals: { cherry: 0, strawberry: 0, lemon: 0, peach: 0, apple: 5 },
      bellActive: true,
    };
    const before = state.players[0]!.hand.length;
    state = slapHeartAttack(state, 'p1', 100);
    expect(state.centerPile).toHaveLength(0);
    expect(state.bellActive).toBe(false);
    expect(state.players[0]!.hand.length).toBe(before + 1);
    expect(state.lastAction?.correct).toBe(true);
  });

  it('wrong slap penalizes slapper', () => {
    let state = createHeartAttackGame(players);
    state = {
      ...state,
      centerPile: [{ kind: 'normal', fruit: 'apple', count: 3 }],
      fruitTotals: computeFruitTotals([{ kind: 'normal', fruit: 'apple', count: 3 }]),
      bellActive: false,
    };
    const before = state.players[1]!.hand.length;
    state = slapHeartAttack(state, 'p2', 200);
    expect(state.players[1]!.hand.length).toBe(before + 1);
    expect(state.lastAction?.correct).toBe(false);
  });

  it('resolves earliest slap when multiple timestamps', () => {
    let state = createHeartAttackGame(players);
    state = {
      ...state,
      centerPile: [{ kind: 'normal', fruit: 'lemon', count: 5 }],
      bellActive: true,
      fruitTotals: { cherry: 0, strawberry: 0, lemon: 5, peach: 0, apple: 0 },
    };
    state = slapHeartAttack(state, 'p2', 200);
    const p2Hand = state.players[1]!.hand.length;
    state = createHeartAttackGame(players);
    state = {
      ...state,
      centerPile: [{ kind: 'normal', fruit: 'lemon', count: 5 }],
      bellActive: true,
      fruitTotals: { cherry: 0, strawberry: 0, lemon: 5, peach: 0, apple: 0 },
    };
    state = slapHeartAttack(state, 'p1', 100);
    expect(state.players[0]!.hand.length).toBeGreaterThan(10);
    expect(state.players[1]!.hand.length).toBeLessThan(p2Hand);
  });
});

describe('wild and bomb', () => {
  it('wild enters choosing_fruit then resolves', () => {
    let state = createHeartAttackGame(players);
    const idx = state.currentPlayerIndex;
    const p = state.players[idx]!;
    p.hand = [{ kind: 'wild' }];
    state = { ...state, players: state.players.map((pl, i) => (i === idx ? { ...p } : pl)) };

    state = flipHeartAttackCard(state, p.id);
    expect(state.stage).toBe('choosing_fruit');

    state = chooseWildFruit(state, p.id, 'peach');
    expect(state.stage).toBe('flipping');
    expect(state.fruitTotals.peach).toBe(1);
    expect(state.centerPile[0]?.wildFruit).toBe('peach');
  });

  it('bomb clears center pile', () => {
    let state = createHeartAttackGame(players);
    const idx = state.currentPlayerIndex;
    const p = state.players[idx]!;
    p.hand = [{ kind: 'bomb' }];
    state = {
      ...state,
      centerPile: [{ kind: 'normal', fruit: 'apple', count: 2 }],
      fruitTotals: { cherry: 0, strawberry: 0, lemon: 0, peach: 0, apple: 2 },
      players: state.players.map((pl, i) => (i === idx ? { ...p } : pl)),
    };

    state = flipHeartAttackCard(state, p.id);
    expect(state.centerPile).toHaveLength(0);
    expect(state.fruitTotals.apple).toBe(0);
    expect(state.discardCount).toBeGreaterThan(0);
  });
});

describe('win condition', () => {
  it('empty hand after flip wins', () => {
    let state = createHeartAttackGame(players);
    const idx = state.currentPlayerIndex;
    const p = state.players[idx]!;
    p.hand = [{ kind: 'normal', fruit: 'apple', count: 1 }];
    state = { ...state, players: state.players.map((pl, i) => (i === idx ? { ...p } : pl)) };

    state = flipHeartAttackCard(state, p.id);
    expect(state.phase).toBe('ended');
    expect(state.winnerId).toBe(p.id);
  });
});

describe('redactHeartAttackState', () => {
  it('hides opponent hands', () => {
    const state = createHeartAttackGame(players);
    const redacted = redactHeartAttackState(state, 'p1');
    expect(redacted.players[0]!.hand.length).toBeGreaterThan(0);
    expect(redacted.players[1]!.hand).toHaveLength(0);
    expect(redacted.players[1]!.handCount).toBeGreaterThan(0);
  });
});

describe('isBellActive', () => {
  it('true only when a fruit equals 5', () => {
    expect(isBellActive({ cherry: 4, strawberry: 0, lemon: 0, peach: 0, apple: 0 })).toBe(false);
    expect(isBellActive({ cherry: 5, strawberry: 0, lemon: 0, peach: 0, apple: 0 })).toBe(true);
    expect(isBellActive({ cherry: 6, strawberry: 0, lemon: 0, peach: 0, apple: 0 })).toBe(false);
  });
});
