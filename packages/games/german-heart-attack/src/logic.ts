import type { AiDifficulty } from '@game-lobby/shared';
import type { GameParticipant } from '@game-lobby/game-core';
import { pickRandom, shouldBotMakeMistake, shuffle } from '@game-lobby/game-core';

export type Fruit = 'cherry' | 'strawberry' | 'lemon' | 'peach' | 'apple';
export type CardKind = 'normal' | 'wild' | 'double' | 'bomb';
export type HeartAttackPhase = 'playing' | 'ended';
export type HeartAttackStage = 'flipping' | 'choosing_fruit' | 'resolving_slap';

export const ALL_FRUITS: Fruit[] = ['cherry', 'strawberry', 'lemon', 'peach', 'apple'];

export const FRUIT_LABELS: Record<Fruit, string> = {
  cherry: '樱桃',
  strawberry: '草莓',
  lemon: '柠檬',
  peach: '桃子',
  apple: '苹果',
};

export const FRUIT_EMOJI: Record<Fruit, string> = {
  cherry: '🍒',
  strawberry: '🍓',
  lemon: '🍋',
  peach: '🍑',
  apple: '🍎',
};

export interface HeartAttackCard {
  kind: CardKind;
  fruit?: Fruit;
  count?: number;
  wildFruit?: Fruit;
}

export interface HeartAttackPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  hand: HeartAttackCard[];
  handCount: number;
}

export interface HeartAttackLastAction {
  type: 'flip' | 'slap' | 'wild' | 'bomb';
  playerId: string;
  playerName: string;
  correct?: boolean;
  card?: HeartAttackCard;
  fruitTotals?: Record<Fruit, number>;
}

export interface HeartAttackGameState {
  phase: HeartAttackPhase;
  stage: HeartAttackStage;
  players: HeartAttackPlayerState[];
  currentPlayerIndex: number;
  centerPile: HeartAttackCard[];
  discardCount: number;
  fruitTotals: Record<Fruit, number>;
  bellActive: boolean;
  pendingWild: HeartAttackCard | null;
  wildFlipperId: string | null;
  lastAction: HeartAttackLastAction | null;
  winnerId: string | null;
  message: string;
  useSpecialCards: boolean;
  slapQueue: { playerId: string; at: number }[];
}

export interface HeartAttackStartOptions {
  useSpecialCards?: boolean;
}

/** Standard Halli Galli distribution per fruit: 4×1, 3×2, 2×3, 1×4, 1×5 */
const FRUIT_COUNT_DISTRIBUTION: number[] = [1, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5];

export function emptyFruitTotals(): Record<Fruit, number> {
  return { cherry: 0, strawberry: 0, lemon: 0, peach: 0, apple: 0 };
}

export function computeFruitTotals(pile: HeartAttackCard[]): Record<Fruit, number> {
  const totals = emptyFruitTotals();
  for (const card of pile) {
    if (card.kind === 'normal' && card.fruit && card.count) {
      totals[card.fruit] += card.count;
    } else if (card.kind === 'double' && card.fruit && card.count) {
      totals[card.fruit] += card.count * 2;
    } else if (card.kind === 'wild' && card.wildFruit) {
      totals[card.wildFruit] += 1;
    }
  }
  return totals;
}

export function isBellActive(totals: Record<Fruit, number>): boolean {
  return ALL_FRUITS.some((f) => totals[f] === 5);
}

export function buildDeck(useSpecialCards: boolean): HeartAttackCard[] {
  const cards: HeartAttackCard[] = [];
  for (const fruit of ALL_FRUITS) {
    for (const count of FRUIT_COUNT_DISTRIBUTION) {
      cards.push({ kind: 'normal', fruit, count });
    }
  }
  if (useSpecialCards) {
    cards.push({ kind: 'wild' }, { kind: 'wild' }, { kind: 'wild' });
    cards.push({ kind: 'double', fruit: 'cherry', count: 2 });
    cards.push({ kind: 'double', fruit: 'apple', count: 3 });
    cards.push({ kind: 'bomb' }, { kind: 'bomb' });
  }
  return cards;
}

function clonePlayers(players: HeartAttackPlayerState[]): HeartAttackPlayerState[] {
  return players.map((p) => ({ ...p, hand: [...p.hand] }));
}

function nextPlayerIndex(players: HeartAttackPlayerState[], from: number): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (players[idx]!.hand.length > 0) return idx;
  }
  return from;
}

function endGame(state: HeartAttackGameState, winnerId: string): HeartAttackGameState {
  const winner = state.players.find((p) => p.id === winnerId);
  return {
    ...state,
    phase: 'ended',
    stage: 'flipping',
    winnerId,
    bellActive: false,
    message: `${winner?.name ?? '玩家'} 获胜！`,
  };
}

function withNextTurn(
  state: HeartAttackGameState,
  players: HeartAttackPlayerState[],
  extras: Partial<HeartAttackGameState>,
): HeartAttackGameState {
  const currentIdx = state.currentPlayerIndex;
  const nextIdx = nextPlayerIndex(players, currentIdx);
  const nextPlayer = players[nextIdx];
  const message =
    extras.message ??
    (extras.bellActive ? '拍铃！某种水果合计为 5' : `${nextPlayer?.name ?? '玩家'} 请翻牌`);
  return {
    ...state,
    ...extras,
    players,
    currentPlayerIndex: nextIdx,
    stage: 'flipping',
    message,
  };
}

export function createHeartAttackGame(
  participants: GameParticipant[],
  options: HeartAttackStartOptions = {},
): HeartAttackGameState {
  const useSpecialCards = options.useSpecialCards ?? false;
  const deck = shuffle(buildDeck(useSpecialCards));
  const n = participants.length;
  const perPlayer = Math.floor(deck.length / n);
  const dealCount = perPlayer * n;
  const toDeal = deck.slice(0, dealCount);
  const discardCount = deck.length - dealCount;

  const players: HeartAttackPlayerState[] = participants.map((p, i) => {
    const hand = toDeal.slice(i * perPlayer, (i + 1) * perPlayer);
    return { id: p.id, name: p.name, isBot: p.isBot, hand, handCount: hand.length };
  });

  const first = players[0]!;
  return {
    phase: 'playing',
    stage: 'flipping',
    players,
    currentPlayerIndex: 0,
    centerPile: [],
    discardCount,
    fruitTotals: emptyFruitTotals(),
    bellActive: false,
    pendingWild: null,
    wildFlipperId: null,
    lastAction: null,
    winnerId: null,
    message: `${first.name} 请翻牌`,
    useSpecialCards,
    slapQueue: [],
  };
}

export function flipHeartAttackCard(
  state: HeartAttackGameState,
  playerId: string,
): HeartAttackGameState {
  if (state.phase !== 'playing' || state.stage === 'choosing_fruit') return state;

  const current = state.players[state.currentPlayerIndex];
  if (!current || current.id !== playerId) {
    return { ...state, message: '还没轮到你' };
  }
  if (current.hand.length === 0) return state;

  const players = clonePlayers(state.players);
  const player = players[state.currentPlayerIndex]!;
  const card = player.hand.shift()!;
  player.handCount = player.hand.length;

  if (card.kind === 'wild') {
    return {
      ...state,
      players,
      stage: 'choosing_fruit',
      pendingWild: { ...card },
      wildFlipperId: player.id,
      lastAction: {
        type: 'wild',
        playerId: player.id,
        playerName: player.name,
        card: { ...card },
      },
      message: `${player.name} 翻出万能水果，请选择计入哪种水果`,
    };
  }

  if (card.kind === 'bomb') {
    const discarded = state.centerPile.length;
    const discardCount = state.discardCount + discarded;
    const lastAction: HeartAttackLastAction = {
      type: 'bomb',
      playerId: player.id,
      playerName: player.name,
      card: { ...card },
    };
    if (player.hand.length === 0) {
      return endGame(
        {
          ...state,
          players,
          centerPile: [],
          discardCount,
          fruitTotals: emptyFruitTotals(),
          bellActive: false,
          lastAction,
        },
        player.id,
      );
    }
    return withNextTurn(state, players, {
      centerPile: [],
      discardCount,
      fruitTotals: emptyFruitTotals(),
      bellActive: false,
      lastAction,
      message: `${player.name} 翻出炸弹！中央牌堆清空`,
    });
  }

  const centerPile = [...state.centerPile, card];
  const fruitTotals = computeFruitTotals(centerPile);
  const bellActive = isBellActive(fruitTotals);
  const lastAction: HeartAttackLastAction = {
    type: 'flip',
    playerId: player.id,
    playerName: player.name,
    card: { ...card },
    fruitTotals: { ...fruitTotals },
  };

  if (player.hand.length === 0) {
    return endGame(
      { ...state, players, centerPile, fruitTotals, bellActive, lastAction },
      player.id,
    );
  }

  return withNextTurn(state, players, {
    centerPile,
    fruitTotals,
    bellActive,
    lastAction,
  });
}

export function chooseWildFruit(
  state: HeartAttackGameState,
  playerId: string,
  fruit: Fruit,
): HeartAttackGameState {
  if (state.phase !== 'playing' || state.stage !== 'choosing_fruit') return state;
  if (state.wildFlipperId !== playerId || !state.pendingWild) return state;
  if (!ALL_FRUITS.includes(fruit)) return state;

  const card: HeartAttackCard = { ...state.pendingWild, wildFruit: fruit };
  const centerPile = [...state.centerPile, card];
  const fruitTotals = computeFruitTotals(centerPile);
  const bellActive = isBellActive(fruitTotals);
  const players = clonePlayers(state.players);
  const flipperIdx = players.findIndex((p) => p.id === playerId);
  const player = players[flipperIdx]!;

  const lastAction: HeartAttackLastAction = {
    type: 'wild',
    playerId: player.id,
    playerName: player.name,
    card: { ...card },
    fruitTotals: { ...fruitTotals },
  };

  if (player.hand.length === 0) {
    return endGame(
      {
        ...state,
        players,
        centerPile,
        fruitTotals,
        bellActive,
        pendingWild: null,
        wildFlipperId: null,
        lastAction,
      },
      player.id,
    );
  }

  return withNextTurn(state, players, {
    centerPile,
    fruitTotals,
    bellActive,
    pendingWild: null,
    wildFlipperId: null,
    lastAction,
    message: bellActive
      ? `${player.name} 选择 ${FRUIT_LABELS[fruit]}，拍铃！`
      : `${player.name} 选择 ${FRUIT_LABELS[fruit]}`,
  });
}

export function slapHeartAttack(
  state: HeartAttackGameState,
  playerId: string,
  atMs: number,
): HeartAttackGameState {
  if (state.phase !== 'playing' || state.stage === 'choosing_fruit') return state;

  const slapper = state.players.find((p) => p.id === playerId);
  if (!slapper) return state;

  if (state.stage === 'resolving_slap' && state.slapQueue.length > 0) {
    const earliest = [...state.slapQueue].sort((a, b) => a.at - b.at)[0]!;
    if (earliest.playerId !== playerId) return state;
  }

  const queue =
    state.stage === 'resolving_slap'
      ? [...state.slapQueue, { playerId, at: atMs }]
      : [{ playerId, at: atMs }];

  if (state.bellActive && state.centerPile.length === 0) {
    return { ...state, slapQueue: queue, stage: 'resolving_slap' };
  }

  const winner = queue.sort((a, b) => a.at - b.at)[0]!;
  const winnerPlayer = state.players.find((p) => p.id === winner.playerId);
  if (!winnerPlayer) return state;

  const correct = state.bellActive;
  const pile = [...state.centerPile];

  if (!correct && pile.length === 0) {
    return {
      ...state,
      slapQueue: [],
      stage: 'flipping',
      lastAction: {
        type: 'slap',
        playerId: winnerPlayer.id,
        playerName: winnerPlayer.name,
        correct: false,
      },
      message: '拍铃错误，但中央没有牌',
    };
  }

  const players = clonePlayers(state.players);
  const recipient = players.find((p) => p.id === winner.playerId)!;
  recipient.hand.push(...pile);
  recipient.handCount = recipient.hand.length;

  const lastAction: HeartAttackLastAction = {
    type: 'slap',
    playerId: winnerPlayer.id,
    playerName: winnerPlayer.name,
    correct,
  };

  const message = correct
    ? `${winnerPlayer.name} 拍铃正确，收走 ${pile.length} 张牌`
    : `${winnerPlayer.name} 拍铃错误，收走 ${pile.length} 张牌`;

  return {
    ...state,
    players,
    centerPile: [],
    fruitTotals: emptyFruitTotals(),
    bellActive: false,
    stage: 'flipping',
    slapQueue: [],
    lastAction,
    message,
  };
}

export function cardLabel(card: HeartAttackCard): string {
  if (card.kind === 'wild') return card.wildFruit ? `万能→${FRUIT_EMOJI[card.wildFruit]}` : '万能';
  if (card.kind === 'bomb') return '炸弹';
  if (card.kind === 'double' && card.fruit && card.count) {
    return `${FRUIT_EMOJI[card.fruit]}×${card.count} 双倍`;
  }
  if (card.fruit && card.count) return `${FRUIT_EMOJI[card.fruit]}×${card.count}`;
  return '?';
}

/** Pick the fruit that brings a total closest to 5 without exceeding when possible. */
export function pickBestWildFruit(totals: Record<Fruit, number>): Fruit {
  let best: Fruit = 'cherry';
  let bestScore = -1;
  for (const fruit of ALL_FRUITS) {
    const next = totals[fruit] + 1;
    const score = next === 5 ? 100 : next < 5 ? next : -next;
    if (score > bestScore) {
      bestScore = score;
      best = fruit;
    }
  }
  return best;
}

export function generateBotWildChoice(state: HeartAttackGameState): Fruit {
  return pickBestWildFruit(state.fruitTotals);
}

export function generateBotShouldSlap(
  state: HeartAttackGameState,
  difficulty: AiDifficulty,
): boolean {
  if (state.bellActive) return true;
  return shouldBotMakeMistake(difficulty);
}

export function redactHeartAttackState(
  state: HeartAttackGameState,
  viewerId: string | null,
): HeartAttackGameState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (viewerId != null && p.id === viewerId) {
        return { ...p, handCount: p.hand.length };
      }
      return { ...p, hand: [], handCount: p.hand.length };
    }),
  };
}
