import type { AiDifficulty } from '@game-lobby/shared';
import type { GameParticipant } from '@game-lobby/game-core';
import { pickRandom, shouldBotMakeMistake } from '@game-lobby/game-core';

export type GoldMinerPhase =
  | 'level_intro'
  | 'playing'
  | 'turn_result'
  | 'level_end'
  | 'shop'
  | 'ended';

export type HookStage = 'swinging' | 'extending' | 'retracting';

export type ItemType =
  | 'gold_small'
  | 'gold_large'
  | 'diamond'
  | 'rock'
  | 'mystery_bag'
  | 'tnt'
  | 'pig';

export type ShopItemType = 'dynamite' | 'strength' | 'lucky';

export const FIELD_WIDTH = 800;
export const FIELD_HEIGHT = 600;
export const MINER_X = FIELD_WIDTH / 2;
export const MINER_Y = 60;

export const SHOP_PRICES: Record<ShopItemType, number> = {
  dynamite: 100,
  strength: 200,
  lucky: 150,
};

export const ITEM_LABELS: Record<ItemType, string> = {
  gold_small: '小金块',
  gold_large: '大金块',
  diamond: '钻石',
  rock: '石头',
  mystery_bag: '福袋',
  tnt: 'TNT',
  pig: '小猪',
};

export interface MineItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  value: number;
  weight: number;
  radius: number;
  vx?: number;
  collected: boolean;
}

export interface GoldMinerInventory {
  dynamite: number;
  strength: number;
  lucky: number;
}

export interface GoldMinerActiveBuffs {
  strengthUntilTurn?: number;
  luckyUntilTurn?: number;
}

export interface GoldMinerPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  totalScore: number;
  levelMoney: number;
  inventory: GoldMinerInventory;
  activeBuffs: GoldMinerActiveBuffs;
}

export interface GoldMinerHookState {
  angle: number;
  length: number;
  maxLength: number;
  attachedItemId: string | null;
  launchAngle: number | null;
}

export interface GoldMinerLastGrab {
  playerId: string;
  playerName: string;
  itemType: ItemType;
  value: number;
}

export interface GoldMinerStartOptions {
  maxLevels?: number;
  levelTimeLimitSec?: number;
  enableMovingPig?: boolean;
}

export interface GoldMinerGameState {
  phase: GoldMinerPhase;
  hookStage: HookStage;
  level: number;
  maxLevels: number;
  levelTarget: number;
  levelTimeLimitMs: number;
  levelStartedAt: number;
  turnOrder: string[];
  currentTurnIndex: number;
  currentPlayerId: string;
  turnNumber: number;
  hook: GoldMinerHookState;
  items: MineItem[];
  players: GoldMinerPlayerState[];
  phaseEndsAt: number;
  swingStartedAt: number;
  levelSeed: number;
  message: string;
  lastGrab: GoldMinerLastGrab | null;
  shopDoneIds: string[];
  winnerIds: string[];
  startOptions: GoldMinerStartOptions;
  enableMovingPig: boolean;
  swingAmplitude: number;
  swingOmega: number;
  lastTickAt: number;
}

const LEVEL_INTRO_MS = 3000;
const TURN_RESULT_MS = 1500;
const LEVEL_END_MS = 3000;
const SHOP_MS = 20000;
const MIN_HOOK_LEN = 40;
const EXTEND_SPEED = 0.28;
const RETRACT_BASE = 0.38;
const STRENGTH_MULT = 2;
const DEFAULT_MAX_LEVELS = 5;
const DEFAULT_LEVEL_TIME_SEC = 90;

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cloneState(state: GoldMinerGameState): GoldMinerGameState {
  return {
    ...state,
    hook: { ...state.hook },
    items: state.items.map((i) => ({ ...i })),
    players: state.players.map((p) => ({
      ...p,
      inventory: { ...p.inventory },
      activeBuffs: { ...p.activeBuffs },
    })),
    shopDoneIds: [...state.shopDoneIds],
    winnerIds: [...state.winnerIds],
    turnOrder: [...state.turnOrder],
    startOptions: { ...state.startOptions },
  };
}

function emptyInventory(): GoldMinerInventory {
  return { dynamite: 0, strength: 0, lucky: 0 };
}

function levelTargetFor(level: number): number {
  return 350 + level * 650;
}

function swingOmegaFor(level: number): number {
  return 0.0018 + level * 0.00015;
}

export function computeSwingAngle(state: GoldMinerGameState, now: number): number {
  const elapsed = now - state.swingStartedAt;
  return state.swingAmplitude * Math.sin(state.swingOmega * elapsed);
}

export function hookTip(state: GoldMinerGameState): { x: number; y: number } {
  const angle = state.hook.angle;
  return {
    x: MINER_X + state.hook.length * Math.sin(angle),
    y: MINER_Y + state.hook.length * Math.cos(angle),
  };
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function findPlayer(state: GoldMinerGameState, id: string): GoldMinerPlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

function findItem(state: GoldMinerGameState, id: string): MineItem | undefined {
  return state.items.find((i) => i.id === id);
}

function currentPlayer(state: GoldMinerGameState): GoldMinerPlayerState | undefined {
  return findPlayer(state, state.currentPlayerId);
}

function advanceTurn(state: GoldMinerGameState): void {
  state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  if (state.currentTurnIndex === 0) state.turnNumber += 1;
  state.currentPlayerId = state.turnOrder[state.currentTurnIndex];
  state.hookStage = 'swinging';
  state.hook.length = MIN_HOOK_LEN;
  state.hook.attachedItemId = null;
  state.hook.launchAngle = null;
  state.swingStartedAt = state.lastTickAt;
}

function resolveMysteryValue(state: GoldMinerGameState, player: GoldMinerPlayerState): number {
  const rng = mulberry32(state.levelSeed + state.level * 997 + state.turnNumber * 13);
  const roll = rng();
  const lucky = player.activeBuffs.luckyUntilTurn === state.turnNumber;
  if (lucky) {
    if (roll < 0.35) return 600;
    if (roll < 0.65) return pickRandom([200, 300, 400, 500]);
    if (roll < 0.85) return pickRandom([80, 100, 120]);
    return pickRandom([11, 15, 20]);
  }
  if (roll < 0.15) return 600;
  if (roll < 0.4) return pickRandom([200, 300, 400]);
  if (roll < 0.7) return pickRandom([50, 80, 100]);
  return pickRandom([11, 15, 20]);
}

function applyGrab(state: GoldMinerGameState, player: GoldMinerPlayerState, item: MineItem): number {
  let value = item.value;
  if (item.type === 'mystery_bag') {
    value = resolveMysteryValue(state, player);
  } else if (item.type === 'tnt') {
    value = 0;
    state.message = `${player.name} 抓到了 TNT！`;
  } else if (item.type === 'pig') {
    value = 0;
    state.message = `${player.name} 抓到了小猪，一无所获`;
  }
  player.levelMoney += value;
  player.totalScore += value;
  state.lastGrab = {
    playerId: player.id,
    playerName: player.name,
    itemType: item.type,
    value,
  };
  if (item.type !== 'tnt' && item.type !== 'pig') {
    state.message = `${player.name} 获得 $${value}（${ITEM_LABELS[item.type]}）`;
  }
  return value;
}

function isLevelComplete(state: GoldMinerGameState, now: number): boolean {
  if (state.players.some((p) => p.levelMoney >= state.levelTarget)) return true;
  if (now - state.levelStartedAt >= state.levelTimeLimitMs) return true;
  if (state.turnOrder.length <= 1) return false;
  const roundsNeeded = Math.max(2, state.turnOrder.length);
  if (state.turnNumber > roundsNeeded) return true;
  return false;
}

function rankWinners(players: GoldMinerPlayerState[]): string[] {
  const sorted = [...players].sort((a, b) => b.totalScore - a.totalScore);
  if (sorted.length === 0) return [];
  const top = sorted[0].totalScore;
  return sorted.filter((p) => p.totalScore === top).map((p) => p.id);
}

function generateLevelItems(
  level: number,
  seed: number,
  enableMovingPig: boolean,
): MineItem[] {
  const rng = mulberry32(seed + level * 7919);
  const items: MineItem[] = [];
  let id = 0;
  const nextId = () => `item-${level}-${id++}`;

  const counts = {
    gold_small: 4 + level,
    gold_large: 2 + Math.floor(level / 2),
    diamond: Math.min(2, 1 + Math.floor(level / 3)),
    rock: 3 + level,
    mystery_bag: 2 + Math.floor(level / 2),
    tnt: Math.floor(level / 2),
    pig: enableMovingPig ? 1 + Math.floor(level / 3) : 0,
  };

  const place = (type: ItemType, value: number, weight: number, radius: number, extra?: Partial<MineItem>) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = 80 + rng() * (FIELD_WIDTH - 160);
      const y = 160 + rng() * (FIELD_HEIGHT - 200);
      const overlap = items.some((it) => dist(x, y, it.x, it.y) < it.radius + radius + 8);
      if (!overlap) {
        items.push({
          id: nextId(),
          type,
          x,
          y,
          value,
          weight,
          radius,
          collected: false,
          ...extra,
        });
        return;
      }
    }
  };

  for (let i = 0; i < counts.gold_small; i++) {
    place('gold_small', 50 + Math.floor(rng() * 51), 1, 18);
  }
  for (let i = 0; i < counts.gold_large; i++) {
    place('gold_large', 200 + Math.floor(rng() * 301), 3, 32);
  }
  for (let i = 0; i < counts.diamond; i++) {
    place('diamond', 600, 0.5, 14);
  }
  for (let i = 0; i < counts.rock; i++) {
    place('rock', 11 + Math.floor(rng() * 10), 5, 26);
  }
  for (let i = 0; i < counts.mystery_bag; i++) {
    place('mystery_bag', 0, 2, 20);
  }
  for (let i = 0; i < counts.tnt; i++) {
    place('tnt', 0, 1, 16);
  }
  for (let i = 0; i < counts.pig; i++) {
    place('pig', 0, 2, 22, { vx: (rng() > 0.5 ? 1 : -1) * (0.04 + rng() * 0.03) });
  }

  return items;
}

function startLevel(state: GoldMinerGameState, now: number): void {
  state.level += 1;
  state.levelTarget = levelTargetFor(state.level);
  state.levelStartedAt = now;
  state.turnNumber = 1;
  state.currentTurnIndex = 0;
  state.currentPlayerId = state.turnOrder[0];
  state.items = generateLevelItems(state.level, state.levelSeed, state.enableMovingPig);
  state.hookStage = 'swinging';
  state.hook = {
    angle: 0,
    length: MIN_HOOK_LEN,
    maxLength: 520,
    attachedItemId: null,
    launchAngle: null,
  };
  state.swingAmplitude = 1.25;
  state.swingOmega = swingOmegaFor(state.level);
  state.swingStartedAt = now;
  state.lastGrab = null;
  state.shopDoneIds = [];
  for (const p of state.players) {
    p.levelMoney = 0;
    p.activeBuffs = {};
  }
  state.phase = 'level_intro';
  state.phaseEndsAt = now + LEVEL_INTRO_MS;
  state.message = `第 ${state.level} 关 — 目标 $${state.levelTarget}`;
}

function finishGame(state: GoldMinerGameState): void {
  state.phase = 'ended';
  state.winnerIds = rankWinners(state.players);
  const names = state.players
    .filter((p) => state.winnerIds.includes(p.id))
    .map((p) => p.name)
    .join('、');
  state.message = `游戏结束！${names} 获胜`;
}

function beginShop(state: GoldMinerGameState, now: number): void {
  state.phase = 'shop';
  state.phaseEndsAt = now + SHOP_MS;
  state.shopDoneIds = [];
  state.message = '商店开放 — 购买道具或点击完成';
}

function finishShop(state: GoldMinerGameState, now: number): void {
  if (state.level >= state.maxLevels) {
    finishGame(state);
    return;
  }
  startLevel(state, now);
}

function allShopDone(state: GoldMinerGameState): boolean {
  return state.players.every((p) => state.shopDoneIds.includes(p.id));
}

function retractSpeed(state: GoldMinerGameState, weight: number): number {
  const player = currentPlayer(state);
  let speed = RETRACT_BASE / Math.max(0.5, weight);
  if (player?.activeBuffs.strengthUntilTurn === state.turnNumber) {
    speed *= STRENGTH_MULT;
  }
  return speed;
}

function checkCollision(state: GoldMinerGameState): MineItem | null {
  const tip = hookTip(state);
  for (const item of state.items) {
    if (item.collected) continue;
    if (dist(tip.x, tip.y, item.x, item.y) <= item.radius + 6) {
      return item;
    }
  }
  return null;
}

function movePigs(state: GoldMinerGameState, dt: number): void {
  for (const item of state.items) {
    if (item.type !== 'pig' || item.collected || item.vx == null) continue;
    item.x += item.vx * dt;
    if (item.x < 60 || item.x > FIELD_WIDTH - 60) {
      item.vx = -item.vx;
      item.x = Math.max(60, Math.min(FIELD_WIDTH - 60, item.x));
    }
  }
}

function tickPlaying(state: GoldMinerGameState, now: number, dt: number): void {
  movePigs(state, dt);

  if (state.hookStage === 'swinging') {
    state.hook.angle = computeSwingAngle(state, now);
    return;
  }

  if (state.hookStage === 'extending') {
    state.hook.length += EXTEND_SPEED * dt;
    const hit = checkCollision(state);
    if (hit) {
      hit.collected = true;
      state.hook.attachedItemId = hit.id;
      state.hookStage = 'retracting';
      if (hit.type === 'tnt') {
        state.message = `${currentPlayer(state)?.name ?? ''} 钩到了 TNT！快使用炸药或小心收回`;
      }
      return;
    }
    if (state.hook.length >= state.hook.maxLength) {
      state.hookStage = 'retracting';
    }
    return;
  }

  if (state.hookStage === 'retracting') {
    const attached = state.hook.attachedItemId
      ? findItem(state, state.hook.attachedItemId)
      : null;
    const weight = attached?.weight ?? 1;
    state.hook.length -= retractSpeed(state, weight) * dt;

    if (state.hook.length <= MIN_HOOK_LEN) {
      state.hook.length = MIN_HOOK_LEN;
      const player = currentPlayer(state);
      if (attached && player) {
        applyGrab(state, player, attached);
        state.phase = 'turn_result';
        state.phaseEndsAt = now + TURN_RESULT_MS;
      } else {
        advanceTurn(state);
        if (isLevelComplete(state, now)) {
          state.phase = 'level_end';
          state.phaseEndsAt = now + LEVEL_END_MS;
          const leader = [...state.players].sort((a, b) => b.levelMoney - a.levelMoney)[0];
          state.message = `第 ${state.level} 关结束！${leader.name} 本关最高 $${leader.levelMoney}`;
        }
      }
    }
  }
}

export function createGoldMinerGame(
  participants: GameParticipant[],
  options: GoldMinerStartOptions = {},
): GoldMinerGameState {
  const now = Date.now();
  const maxLevels = options.maxLevels ?? DEFAULT_MAX_LEVELS;
  const levelTimeLimitMs = (options.levelTimeLimitSec ?? DEFAULT_LEVEL_TIME_SEC) * 1000;
  const enableMovingPig = options.enableMovingPig ?? true;
  const levelSeed = Math.floor(Math.random() * 1_000_000);

  const players: GoldMinerPlayerState[] = participants.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    totalScore: 0,
    levelMoney: 0,
    inventory: emptyInventory(),
    activeBuffs: {},
  }));

  const turnOrder = players.map((p) => p.id);

  const state: GoldMinerGameState = {
    phase: 'level_intro',
    hookStage: 'swinging',
    level: 0,
    maxLevels,
    levelTarget: 0,
    levelTimeLimitMs,
    levelStartedAt: now,
    turnOrder,
    currentTurnIndex: 0,
    currentPlayerId: turnOrder[0],
    turnNumber: 1,
    hook: {
      angle: 0,
      length: MIN_HOOK_LEN,
      maxLength: 520,
      attachedItemId: null,
      launchAngle: null,
    },
    items: [],
    players,
    phaseEndsAt: now + LEVEL_INTRO_MS,
    swingStartedAt: now,
    levelSeed,
    message: '游戏开始',
    lastGrab: null,
    shopDoneIds: [],
    winnerIds: [],
    startOptions: { ...options },
    enableMovingPig,
    swingAmplitude: 1.25,
    swingOmega: swingOmegaFor(1),
    lastTickAt: now,
  };

  startLevel(state, now);
  return state;
}

export function tickGoldMiner(state: GoldMinerGameState, now: number): GoldMinerGameState {
  if (state.phase === 'ended') return state;

  const next = cloneState(state);
  const dt = Math.min(200, Math.max(1, now - next.lastTickAt));
  next.lastTickAt = now;

  if (next.phase === 'level_intro' && now >= next.phaseEndsAt) {
    next.phase = 'playing';
    next.message = `${findPlayer(next, next.currentPlayerId)?.name ?? ''} 的回合`;
    return next;
  }

  if (next.phase === 'playing') {
    tickPlaying(next, now, dt);
    return next;
  }

  if (next.phase === 'turn_result' && now >= next.phaseEndsAt) {
    advanceTurn(next);
    if (isLevelComplete(next, now)) {
      next.phase = 'level_end';
      next.phaseEndsAt = now + LEVEL_END_MS;
      const leader = [...next.players].sort((a, b) => b.levelMoney - a.levelMoney)[0];
      next.message = `第 ${next.level} 关结束！${leader.name} 本关最高 $${leader.levelMoney}`;
    } else {
      next.phase = 'playing';
      next.message = `${findPlayer(next, next.currentPlayerId)?.name ?? ''} 的回合`;
    }
    return next;
  }

  if (next.phase === 'level_end' && now >= next.phaseEndsAt) {
    if (next.level >= next.maxLevels) {
      finishGame(next);
    } else {
      beginShop(next, now);
    }
    return next;
  }

  if (next.phase === 'shop') {
    if (now >= next.phaseEndsAt || allShopDone(next)) {
      finishShop(next, now);
    }
    return next;
  }

  return next;
}

export function launchHook(state: GoldMinerGameState, playerId: string, now: number): GoldMinerGameState {
  if (state.phase !== 'playing') return state;
  if (state.hookStage !== 'swinging') return state;
  if (state.currentPlayerId !== playerId) return state;

  let next = applyShopBuffsOnTurn(state, playerId);
  next = cloneState(next);
  next.hookStage = 'extending';
  next.hook.launchAngle = computeSwingAngle(next, now);
  next.hook.angle = next.hook.launchAngle;
  next.lastTickAt = now;
  return next;
}

export function useDynamite(state: GoldMinerGameState, playerId: string): GoldMinerGameState {
  if (state.phase !== 'playing') return state;
  if (state.hookStage !== 'retracting') return state;
  if (state.currentPlayerId !== playerId) return state;
  if (!state.hook.attachedItemId) return state;

  const player = findPlayer(state, playerId);
  if (!player || player.inventory.dynamite < 1) return state;

  const next = cloneState(state);
  const p = findPlayer(next, playerId)!;
  p.inventory.dynamite -= 1;
  next.hook.attachedItemId = null;
  next.message = `${p.name} 使用炸药丢弃了附着物`;
  return next;
}

export function buyShopItem(
  state: GoldMinerGameState,
  playerId: string,
  item: ShopItemType,
): GoldMinerGameState {
  if (state.phase !== 'shop') return state;
  if (state.shopDoneIds.includes(playerId)) return state;

  const player = findPlayer(state, playerId);
  if (!player) return state;

  const price = SHOP_PRICES[item];
  if (player.totalScore < price) return state;

  const next = cloneState(state);
  const p = findPlayer(next, playerId)!;
  p.totalScore -= price;
  p.inventory[item] += 1;
  next.message = `${p.name} 购买了${item === 'dynamite' ? '炸药' : item === 'strength' ? '力量药水' : '幸运草'}`;
  return next;
}

export function skipShop(state: GoldMinerGameState, playerId: string): GoldMinerGameState {
  if (state.phase !== 'shop') return state;
  if (state.shopDoneIds.includes(playerId)) return state;

  const next = cloneState(state);
  next.shopDoneIds.push(playerId);
  const p = findPlayer(next, playerId);
  if (p) next.message = `${p.name} 完成购物`;

  if (allShopDone(next)) {
    finishShop(next, next.lastTickAt);
  }
  return next;
}

export function applyShopBuffsOnTurn(state: GoldMinerGameState, playerId: string): GoldMinerGameState {
  const player = findPlayer(state, playerId);
  if (!player) return state;

  const next = cloneState(state);
  const p = findPlayer(next, playerId)!;

  if (p.inventory.strength > 0 && p.activeBuffs.strengthUntilTurn !== state.turnNumber) {
    p.inventory.strength -= 1;
    p.activeBuffs.strengthUntilTurn = state.turnNumber;
  }
  if (p.inventory.lucky > 0 && p.activeBuffs.luckyUntilTurn !== state.turnNumber) {
    p.inventory.lucky -= 1;
    p.activeBuffs.luckyUntilTurn = state.turnNumber;
  }
  return next;
}

/** Best item to aim for at current angle (for bots). */
export function scoreItemAtAngle(
  state: GoldMinerGameState,
  angle: number,
  item: MineItem,
): number {
  if (item.collected) return -1;
  const dx = item.x - MINER_X;
  const dy = item.y - MINER_Y;
  const itemAngle = Math.atan2(dx, dy);
  const diff = Math.abs(itemAngle - angle);
  const anglePenalty = diff * 200;
  let value = item.value;
  if (item.type === 'mystery_bag') value = 150;
  if (item.type === 'diamond') value = 600;
  if (item.type === 'tnt' || item.type === 'pig' || item.type === 'rock') value = -50;
  return value - anglePenalty - item.weight * 10;
}

export function generateBotLaunch(
  state: GoldMinerGameState,
  difficulty: AiDifficulty,
): GoldMinerGameState | null {
  if (state.phase !== 'playing' || state.hookStage !== 'swinging') return null;
  const angle = computeSwingAngle(state, state.lastTickAt);
  let bestScore = -Infinity;
  for (const item of state.items) {
    const s = scoreItemAtAngle(state, angle, item);
    if (s > bestScore) bestScore = s;
  }
  const threshold = difficulty === 'easy' ? 80 : difficulty === 'medium' ? 120 : difficulty === 'hard' ? 160 : 200;
  if (shouldBotMakeMistake(difficulty) && Math.random() < 0.25) {
    return launchHook(state, state.currentPlayerId, state.lastTickAt);
  }
  if (bestScore >= threshold) {
    return launchHook(state, state.currentPlayerId, state.lastTickAt);
  }
  return null;
}

export function generateBotShop(
  state: GoldMinerGameState,
  playerId: string,
  difficulty: AiDifficulty,
): GoldMinerGameState {
  let s = state;
  const player = findPlayer(s, playerId);
  if (!player) return s;

  const buyOrder: ShopItemType[] =
    difficulty === 'easy'
      ? ['dynamite', 'strength', 'lucky']
      : ['strength', 'lucky', 'dynamite'];

  for (const item of buyOrder) {
    if (player.totalScore >= SHOP_PRICES[item] * 2) {
      const next = buyShopItem(s, playerId, item);
      if (next !== s) s = next;
    }
  }
  return skipShop(s, playerId);
}

export function generateBotDynamite(state: GoldMinerGameState, playerId: string): GoldMinerGameState | null {
  if (state.hookStage !== 'retracting' || !state.hook.attachedItemId) return null;
  const attached = findItem(state, state.hook.attachedItemId);
  const player = findPlayer(state, playerId);
  if (!attached || !player || player.inventory.dynamite < 1) return null;
  if (attached.type === 'rock' || attached.type === 'tnt' || attached.weight >= 3) {
    return useDynamite(state, playerId);
  }
  return null;
}
