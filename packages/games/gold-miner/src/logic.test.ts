import { describe, expect, it } from 'vitest';
import {
  buyShopItem,
  computeSwingAngle,
  createGoldMinerGame,
  launchHook,
  skipShop,
  tickGoldMiner,
  useDynamite,
  type GoldMinerGameState,
} from './logic.js';

const p1 = { id: 'p1', name: 'Alice', isBot: false };
const p2 = { id: 'p2', name: 'Bob', isBot: false };

function advanceToPlaying(state: GoldMinerGameState, now: number): GoldMinerGameState {
  return tickGoldMiner(state, now + 5000);
}

describe('createGoldMinerGame', () => {
  it('creates initial level with items and players', () => {
    const state = createGoldMinerGame([p1, p2], { maxLevels: 3 });
    expect(state.players).toHaveLength(2);
    expect(state.items.length).toBeGreaterThan(5);
    expect(state.level).toBe(1);
    expect(state.phase).toBe('level_intro');
  });
});

describe('computeSwingAngle', () => {
  it('varies over time', () => {
    const state = createGoldMinerGame([p1, p2]);
    const a1 = computeSwingAngle(state, state.swingStartedAt + 500);
    const a2 = computeSwingAngle(state, state.swingStartedAt + 1500);
    expect(a1).not.toBe(a2);
  });
});

describe('launchHook', () => {
  it('rejects wrong player', () => {
    const state = advanceToPlaying(createGoldMinerGame([p1, p2]), Date.now());
    const next = launchHook(state, 'p2', Date.now());
    expect(next).toBe(state);
  });

  it('starts extending for current player', () => {
    const now = Date.now();
    const state = advanceToPlaying(createGoldMinerGame([p1, p2]), now);
    const next = launchHook(state, 'p1', now + 100);
    expect(next.hookStage).toBe('extending');
    expect(next.hook.launchAngle).not.toBeNull();
  });
});

describe('useDynamite', () => {
  it('requires inventory and attached item', () => {
    const now = Date.now();
    let state = advanceToPlaying(createGoldMinerGame([p1, p2]), now);
    state = launchHook(state, 'p1', now + 100);
    expect(useDynamite(state, 'p1')).toBe(state);
  });

  it('clears attachment when dynamite available', () => {
    const now = Date.now();
    let state = advanceToPlaying(createGoldMinerGame([p1, p2]), now);
    state.players[0].inventory.dynamite = 1;
    state.hookStage = 'retracting';
    state.hook.attachedItemId = state.items[0].id;
    state.items[0].collected = true;
    const next = useDynamite(state, 'p1');
    expect(next.hook.attachedItemId).toBeNull();
    expect(next.players[0].inventory.dynamite).toBe(0);
  });
});

describe('shop', () => {
  it('rejects purchase when insufficient funds', () => {
    const now = Date.now();
    let state = createGoldMinerGame([p1, p2], { maxLevels: 1 });
    state.phase = 'shop';
    state.players[0].totalScore = 50;
    const next = buyShopItem(state, 'p1', 'dynamite');
    expect(next).toBe(state);
  });

  it('deducts score on purchase', () => {
    let state = createGoldMinerGame([p1, p2]);
    state.phase = 'shop';
    state.players[0].totalScore = 500;
    const next = buyShopItem(state, 'p1', 'strength');
    expect(next.players[0].totalScore).toBe(300);
    expect(next.players[0].inventory.strength).toBe(1);
  });

  it('tracks shop done and advances', () => {
    let state = createGoldMinerGame([p1, p2], { maxLevels: 2 });
    state.phase = 'shop';
    state.level = 1;
    let next = skipShop(state, 'p1');
    expect(next.shopDoneIds).toContain('p1');
    next = skipShop(next, 'p2');
    expect(next.phase).toBe('level_intro');
    expect(next.level).toBe(2);
  });
});

describe('solo play', () => {
  it('supports a single participant', () => {
    const state = createGoldMinerGame([p1], { maxLevels: 1 });
    expect(state.players).toHaveLength(1);
    expect(state.turnOrder).toEqual(['p1']);
  });
});

describe('tickGoldMiner', () => {
  it('transitions from level_intro to playing', () => {
    const now = Date.now();
    const state = createGoldMinerGame([p1, p2]);
    const next = tickGoldMiner(state, now + 4000);
    expect(next.phase).toBe('playing');
  });
});
