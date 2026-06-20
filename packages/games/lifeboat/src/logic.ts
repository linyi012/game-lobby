import type { GameParticipant } from '@game-lobby/game-core';
import { shuffle } from '@game-lobby/game-core';
import {
  ALL_CHARACTERS,
  CHARACTER_BY_ID,
  CHARACTER_LABELS,
  type CharacterId,
} from './characters.js';
import {
  buildNavigationDeck,
  buildSupplyDeck,
  supplyCardLabel,
  type NavigationCard,
  type SupplyCard,
} from './cards.js';

export type LifeboatPhase =
  | 'supply_draft'
  | 'action'
  | 'pending_response'
  | 'combat'
  | 'navigation_pick'
  | 'thirst_resolve'
  | 'ended';

export type LifeboatActionType = 'row' | 'swap' | 'steal' | 'special' | 'pass';

export type CombatSide = 'attacker' | 'defender' | 'none';

export interface LifeboatPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  characterId: CharacterId;
  seatIndex: number;
  damage: number;
  maxHp: number;
  strength: number;
  hand: SupplyCard[];
  handCount: number;
  faceUp: SupplyCard[];
  isUnconscious: boolean;
  isDead: boolean;
  loveCharacterId: CharacterId;
  hateCharacterId: CharacterId;
  thirstPending: boolean;
  hasParasol: boolean;
}

export interface SupplyDraftState {
  cards: SupplyCard[];
  pickerPlayerIndex: number;
}

export interface PendingRequest {
  type: 'swap' | 'steal';
  initiatorId: string;
  targetId: string;
  supplyCardId?: string;
}

export interface CombatState {
  attackerId: string;
  defenderId: string;
  reason: 'swap' | 'steal';
  supports: Record<string, CombatSide>;
  resolved: boolean;
}

export interface LifeboatLastAction {
  type: string;
  playerId: string;
  playerName: string;
  detail?: string;
}

export interface LifeboatScoreEntry {
  playerId: string;
  playerName: string;
  characterId: CharacterId;
  supplyPoints: number;
  survivalPoints: number;
  lovePoints: number;
  hatePoints: number;
  bonusPoints: number;
  total: number;
  loveCharacterId: CharacterId;
  hateCharacterId: CharacterId;
}

export interface LifeboatGameState {
  phase: LifeboatPhase;
  round: number;
  players: LifeboatPlayerState[];
  supplyDeck: SupplyCard[];
  supplyDiscard: SupplyCard[];
  navigationDeck: NavigationCard[];
  rowingPile: NavigationCard[];
  seagullCount: number;
  supplyDraft: SupplyDraftState | null;
  actionPlayerIndex: number;
  pendingRequest: PendingRequest | null;
  combat: CombatState | null;
  thirstQueue: string[];
  navigatorId: string | null;
  navigationChoices: NavigationCard[];
  lastAction: LifeboatLastAction | null;
  message: string;
  scores: LifeboatScoreEntry[] | null;
  winnerIds: string[] | null;
}

export interface LifeboatStartOptions {
  includeExpansions?: boolean;
}

export interface LifeboatActionPayload {
  type: LifeboatActionType;
  targetPlayerId?: string;
  supplyCardId?: string;
  specialCardId?: string;
}

function clonePlayers(players: LifeboatPlayerState[]): LifeboatPlayerState[] {
  return players.map((p) => ({
    ...p,
    hand: [...p.hand],
    faceUp: [...p.faceUp],
  }));
}

function cloneState(state: LifeboatGameState): LifeboatGameState {
  return {
    ...state,
    players: clonePlayers(state.players),
    supplyDeck: [...state.supplyDeck],
    supplyDiscard: [...state.supplyDiscard],
    navigationDeck: [...state.navigationDeck],
    rowingPile: [...state.rowingPile],
    supplyDraft: state.supplyDraft
      ? { cards: [...state.supplyDraft.cards], pickerPlayerIndex: state.supplyDraft.pickerPlayerIndex }
      : null,
    pendingRequest: state.pendingRequest ? { ...state.pendingRequest } : null,
    combat: state.combat
      ? { ...state.combat, supports: { ...state.combat.supports } }
      : null,
    thirstQueue: [...state.thirstQueue],
    navigationChoices: [...state.navigationChoices],
    scores: state.scores ? state.scores.map((s) => ({ ...s })) : null,
    winnerIds: state.winnerIds ? [...state.winnerIds] : null,
  };
}

function sortedBySeat(players: LifeboatPlayerState[]): LifeboatPlayerState[] {
  return [...players].sort((a, b) => a.seatIndex - b.seatIndex);
}

function getPlayer(state: LifeboatGameState, playerId: string): LifeboatPlayerState | undefined {
  return state.players.find((p) => p.id === playerId);
}

function getPlayerIndex(state: LifeboatGameState, playerId: string): number {
  return state.players.findIndex((p) => p.id === playerId);
}

function livingPlayers(state: LifeboatGameState): LifeboatPlayerState[] {
  return state.players.filter((p) => !p.isDead);
}

function consciousPlayers(state: LifeboatGameState): LifeboatPlayerState[] {
  return state.players.filter((p) => !p.isDead && !p.isUnconscious);
}

function canAct(player: LifeboatPlayerState): boolean {
  return !player.isDead && !player.isUnconscious;
}

function applyDamageToPlayer(player: LifeboatPlayerState, amount: number): void {
  if (player.isDead) return;
  player.damage += amount;
  if (player.damage >= player.maxHp) {
    player.isUnconscious = true;
  }
  if (player.damage > player.maxHp) {
    player.isDead = true;
    player.isUnconscious = false;
  }
}

function healPlayer(player: LifeboatPlayerState, amount: number): void {
  if (player.isDead) return;
  player.damage = Math.max(0, player.damage - amount);
  if (player.damage < player.maxHp) {
    player.isUnconscious = false;
  }
}

function discardAllCards(player: LifeboatPlayerState, discard: SupplyCard[]): void {
  discard.push(...player.hand, ...player.faceUp);
  player.hand = [];
  player.faceUp = [];
  player.hasParasol = false;
}

function combatBonus(player: LifeboatPlayerState): number {
  const cards = [...player.hand, ...player.faceUp];
  return cards.reduce((sum, c) => sum + (c.combatBonus ?? 0), 0);
}

function isAdjacentToGentleman(state: LifeboatGameState, player: LifeboatPlayerState): boolean {
  const sorted = sortedBySeat(livingPlayers(state));
  const idx = sorted.findIndex((p) => p.id === player.id);
  if (idx < 0) return false;
  const left = sorted[idx - 1];
  const right = sorted[idx + 1];
  return left?.characterId === 'gentleman' || right?.characterId === 'gentleman';
}

function computeSideStrength(
  state: LifeboatGameState,
  sidePlayerIds: string[],
): number {
  let total = 0;
  for (const id of sidePlayerIds) {
    const p = getPlayer(state, id);
    if (!p || p.isDead) continue;
    let str = p.strength + combatBonus(p);
    const def = CHARACTER_BY_ID[p.characterId];
    if (def.ladyAdjacentBonus && isAdjacentToGentleman(state, p)) {
      str += 1;
    }
    total += str;
  }
  return total;
}

function assignLoveHateProperly(players: LifeboatPlayerState[]): void {
  const charIds = players.map((p) => p.characterId);
  for (const player of players) {
    const others = charIds.filter((c) => c !== player.characterId);
    const shuffled = shuffle([...others]);
    player.loveCharacterId = shuffled[0] ?? player.characterId;
    player.hateCharacterId = shuffled.find((c) => c !== player.loveCharacterId) ?? player.characterId;
  }
}

function findNavigator(state: LifeboatGameState): LifeboatPlayerState | null {
  const sorted = sortedBySeat(consciousPlayers(state));
  if (sorted.length === 0) return null;
  return sorted[sorted.length - 1] ?? null;
}

function checkGameEnd(state: LifeboatGameState): LifeboatGameState {
  const alive = livingPlayers(state);
  if (state.seagullCount >= 4 || alive.length === 0) {
    return finalizeScores(state);
  }
  return state;
}

function finalizeScores(state: LifeboatGameState): LifeboatGameState {
  const next = cloneState(state);
  next.phase = 'ended';
  next.message = '游戏结束，正在计分';

  const scores: LifeboatScoreEntry[] = [];
  for (const p of next.players) {
    const allCards = [...p.hand, ...p.faceUp];
    const supplyPoints = allCards.reduce((s, c) => s + c.points, 0);
    const survivalPoints = p.isDead ? 0 : 1;
    const loveTarget = next.players.find((x) => x.characterId === p.loveCharacterId);
    const hateTarget = next.players.find((x) => x.characterId === p.hateCharacterId);
    const lovePoints = loveTarget && !loveTarget.isDead ? 1 : 0;
    const hatePoints = hateTarget && hateTarget.isDead ? 1 : 0;
    const bonusPoints = !p.isDead ? (CHARACTER_BY_ID[p.characterId].survivalBonus ?? 0) : 0;
    const total = supplyPoints + survivalPoints + lovePoints + hatePoints + bonusPoints;
    scores.push({
      playerId: p.id,
      playerName: p.name,
      characterId: p.characterId,
      supplyPoints,
      survivalPoints,
      lovePoints,
      hatePoints,
      bonusPoints,
      total,
      loveCharacterId: p.loveCharacterId,
      hateCharacterId: p.hateCharacterId,
    });
  }

  scores.sort((a, b) => b.total - a.total);
  next.scores = scores;
  const maxScore = scores[0]?.total ?? 0;
  next.winnerIds = scores.filter((s) => s.total === maxScore).map((s) => s.playerId);
  next.message = `游戏结束！最高分 ${maxScore} 分`;
  return next;
}

function startSupplyDraft(state: LifeboatGameState): LifeboatGameState {
  const next = cloneState(state);
  const n = livingPlayers(next).length;
  if (n === 0) return checkGameEnd(next);

  const bow = sortedBySeat(livingPlayers(next))[0];
  if (!bow) return checkGameEnd(next);

  const drawCount = Math.min(n, next.supplyDeck.length);
  if (drawCount === 0) {
    next.phase = 'action';
    next.actionPlayerIndex = 0;
    next.message = '物资耗尽，进入行动阶段';
    return next;
  }

  const cards = next.supplyDeck.splice(0, drawCount);
  next.supplyDraft = { cards, pickerPlayerIndex: getPlayerIndex(next, bow.id) };
  next.phase = 'supply_draft';
  next.message = `${bow.name} 正在挑选物资`;
  return next;
}

function advanceToNextActionPlayer(state: LifeboatGameState): LifeboatGameState {
  const next = cloneState(state);
  const sorted = sortedBySeat(livingPlayers(next));
  const current = sorted[next.actionPlayerIndex];
  if (!current) {
    return beginNavigationPhase(next);
  }
  next.message = `${current.name} 的行动回合`;
  return next;
}

function beginNavigationPhase(state: LifeboatGameState): LifeboatGameState {
  const next = cloneState(state);
  const navigator = findNavigator(next);
  if (!navigator) {
    return checkGameEnd(finalizeScores(next));
  }

  next.navigatorId = navigator.id;
  next.phase = 'navigation_pick';

  if (next.rowingPile.length === 0) {
    if (next.navigationDeck.length === 0) {
      next.message = '无航海牌可执行';
      return advanceRound(next);
    }
    const card = next.navigationDeck.shift()!;
    return resolveNavigationCard(next, card);
  }

  const captain = next.players.find((p) => p.characterId === 'captain' && !p.isDead);
  const canSeeAll = captain && (navigator.characterId === 'captain' || CHARACTER_BY_ID.captain.seesAllRowing);
  next.navigationChoices = canSeeAll ? [...next.rowingPile] : [...next.rowingPile];
  next.message = `${navigator.name} 选择航海牌`;
  return next;
}

function advanceRound(state: LifeboatGameState): LifeboatGameState {
  let next = cloneState(state);
  next.round += 1;
  next.actionPlayerIndex = 0;
  next = checkGameEnd(next);
  if (next.phase === 'ended') return next;
  return startSupplyDraft(next);
}

function resolveNavigationCard(state: LifeboatGameState, card: NavigationCard): LifeboatGameState {
  let next = cloneState(state);
  next.lastAction = {
    type: 'navigation',
    playerId: next.navigatorId ?? '',
    playerName: getPlayer(next, next.navigatorId ?? '')?.name ?? '',
    detail: card.label,
  };

  for (const effect of card.effects) {
    if (effect.type === 'seagull') {
      next.seagullCount = Math.max(0, next.seagullCount + effect.delta);
    } else if (effect.type === 'overboard') {
      const victim = next.players.find((p) => p.characterId === effect.characterId && !p.isDead);
      if (victim) {
        const hasPreserver =
          victim.hand.some((c) => c.kind === 'life_preserver') ||
          victim.faceUp.some((c) => c.kind === 'life_preserver');
        if (!hasPreserver && !CHARACTER_BY_ID[victim.characterId].overboardImmune) {
          applyDamageToPlayer(victim, 1);
        }
        discardAllCards(victim, next.supplyDiscard);
      }
    } else if (effect.type === 'thirst_resolve' || effect.type === 'extra_thirst') {
      const thirsty = next.players.filter((p) => p.thirstPending && !p.isDead);
      next.thirstQueue = thirsty.map((p) => p.id);
      if (next.thirstQueue.length > 0) {
        next.phase = 'thirst_resolve';
        next.message = '口渴结算：请打出淡水或扣血';
        return next;
      }
    }
  }

  next = checkGameEnd(next);
  if (next.phase === 'ended') return next;
  return advanceRound(next);
}

export function createLifeboatGame(
  participants: GameParticipant[],
  _options: LifeboatStartOptions = {},
): LifeboatGameState {
  const shuffledChars = shuffle([...ALL_CHARACTERS]).slice(0, participants.length);
  const players: LifeboatPlayerState[] = participants.map((p, i) => {
    const char = shuffledChars[i]!;
    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      characterId: char.id,
      seatIndex: i,
      damage: 0,
      maxHp: char.maxHp,
      strength: char.strength,
      hand: [],
      handCount: 0,
      faceUp: [],
      isUnconscious: false,
      isDead: false,
      loveCharacterId: char.id,
      hateCharacterId: char.id,
      thirstPending: false,
      hasParasol: false,
    };
  });

  assignLoveHateProperly(players);

  const supplyDeck = shuffle(buildSupplyDeck());
  const navigationDeck = shuffle(buildNavigationDeck());

  const state: LifeboatGameState = {
    phase: 'supply_draft',
    round: 1,
    players,
    supplyDeck,
    supplyDiscard: [],
    navigationDeck,
    rowingPile: [],
    seagullCount: 0,
    supplyDraft: null,
    actionPlayerIndex: 0,
    pendingRequest: null,
    combat: null,
    thirstQueue: [],
    navigatorId: null,
    navigationChoices: [],
    lastAction: null,
    message: '游戏开始，挑选物资',
    scores: null,
    winnerIds: null,
  };

  return startSupplyDraft(state);
}

export function pickSupply(
  state: LifeboatGameState,
  playerId: string,
  cardIndex: number,
): LifeboatGameState {
  if (state.phase !== 'supply_draft' || !state.supplyDraft) return state;
  const picker = state.players[state.supplyDraft.pickerPlayerIndex];
  if (!picker || picker.id !== playerId || !canAct(picker)) return state;
  if (cardIndex < 0 || cardIndex >= state.supplyDraft.cards.length) return state;

  const next = cloneState(state);
  const draft = next.supplyDraft!;
  const picked = draft.cards.splice(cardIndex, 1)[0]!;
  const pickerNext = next.players[state.supplyDraft.pickerPlayerIndex]!;
  pickerNext.hand.push(picked);
  pickerNext.handCount = pickerNext.hand.length;

  next.lastAction = {
    type: 'supply_pick',
    playerId: pickerNext.id,
    playerName: pickerNext.name,
    detail: supplyCardLabel(picked),
  };

  if (draft.cards.length === 0) {
    const living = livingPlayers(next);
    const currentIdx = living.findIndex((p) => p.id === pickerNext.id);
    const nextPicker = living[(currentIdx + 1) % living.length];
    if (!nextPicker) {
      next.supplyDraft = null;
      next.phase = 'action';
      next.actionPlayerIndex = 0;
      next.message = '进入行动阶段';
      return advanceToNextActionPlayer(next);
    }
    const drawCount = Math.min(living.length, next.supplyDeck.length);
    if (drawCount === 0) {
      next.supplyDraft = null;
      next.phase = 'action';
      next.actionPlayerIndex = 0;
      return advanceToNextActionPlayer(next);
    }
    const cards = next.supplyDeck.splice(0, drawCount);
    next.supplyDraft = { cards, pickerPlayerIndex: getPlayerIndex(next, nextPicker.id) };
    next.message = `${nextPicker.name} 正在挑选物资`;
    return next;
  }

  const living = sortedBySeat(livingPlayers(next));
  const currentIdx = living.findIndex((p) => p.id === pickerNext.id);
  const nextPicker = living[(currentIdx + 1) % living.length];
  if (nextPicker) {
    draft.pickerPlayerIndex = getPlayerIndex(next, nextPicker.id);
    next.message = `${nextPicker.name} 正在挑选物资`;
  }
  return next;
}

function finishActionTurn(state: LifeboatGameState): LifeboatGameState {
  const next = cloneState(state);
  const sorted = sortedBySeat(livingPlayers(next));
  next.actionPlayerIndex += 1;
  if (next.actionPlayerIndex >= sorted.length) {
    return beginNavigationPhase(next);
  }
  return advanceToNextActionPlayer(next);
}

export function submitAction(
  state: LifeboatGameState,
  playerId: string,
  action: LifeboatActionPayload,
): LifeboatGameState {
  if (state.phase !== 'action') return state;
  const sorted = sortedBySeat(livingPlayers(state));
  const actor = sorted[state.actionPlayerIndex];
  if (!actor || actor.id !== playerId || !canAct(actor)) return state;

  if (action.type === 'pass') {
    const next = cloneState(state);
    next.lastAction = { type: 'pass', playerId: actor.id, playerName: actor.name };
    return finishActionTurn(next);
  }

  if (action.type === 'row') {
    const next = cloneState(state);
    if (next.navigationDeck.length < 2) {
      if (next.navigationDeck.length === 1) {
        next.rowingPile.push(next.navigationDeck.shift()!);
      }
    } else {
      const a = next.navigationDeck.shift()!;
      const b = next.navigationDeck.shift()!;
      next.rowingPile.push(a);
      next.navigationDeck.push(b);
    }
    const actorNext = getPlayer(next, playerId)!;
    actorNext.thirstPending = true;
    next.lastAction = { type: 'row', playerId: actor.id, playerName: actor.name, detail: '划船' };
    return finishActionTurn(next);
  }

  if (action.type === 'swap' && action.targetPlayerId) {
    const target = getPlayer(state, action.targetPlayerId);
    if (!target || target.isDead || target.id === playerId) return state;
    if (!canAct(target)) {
      const next = cloneState(state);
      swapSeats(next, playerId, target.id);
      next.lastAction = {
        type: 'swap',
        playerId: actor.id,
        playerName: actor.name,
        detail: `与 ${target.name} 换位（对方昏迷）`,
      };
      return finishActionTurn(next);
    }
    const next = cloneState(state);
    next.pendingRequest = { type: 'swap', initiatorId: playerId, targetId: target.id };
    next.phase = 'pending_response';
    next.message = `${target.name} 是否同意换位？`;
    return next;
  }

  if (action.type === 'steal' && action.targetPlayerId) {
    const target = getPlayer(state, action.targetPlayerId);
    if (!target || target.isDead || target.id === playerId) return state;
    const targetDef = CHARACTER_BY_ID[target.characterId];
    if (targetDef.stealImmune) return state;

    const actorDef = CHARACTER_BY_ID[actor.characterId];
    if (actorDef.stealNoCombat) {
      return executeSteal(state, playerId, target.id, action.supplyCardId);
    }
    if (!canAct(target)) {
      return executeSteal(state, playerId, target.id, action.supplyCardId);
    }
    const next = cloneState(state);
    next.pendingRequest = {
      type: 'steal',
      initiatorId: playerId,
      targetId: target.id,
      supplyCardId: action.supplyCardId,
    };
    next.phase = 'pending_response';
    next.message = `${target.name} 是否允许被抢夺？`;
    return next;
  }

  if (action.type === 'special' && action.specialCardId) {
    return executeSpecialAction(state, playerId, action.specialCardId);
  }

  return state;
}

function swapSeats(state: LifeboatGameState, aId: string, bId: string): void {
  const a = getPlayer(state, aId);
  const b = getPlayer(state, bId);
  if (!a || !b) return;
  const tmp = a.seatIndex;
  a.seatIndex = b.seatIndex;
  b.seatIndex = tmp;
}

function executeSteal(
  state: LifeboatGameState,
  thiefId: string,
  targetId: string,
  supplyCardId?: string,
): LifeboatGameState {
  const next = cloneState(state);
  const thief = getPlayer(next, thiefId)!;
  const target = getPlayer(next, targetId)!;
  let card: SupplyCard | undefined;

  if (supplyCardId) {
    const faceIdx = target.faceUp.findIndex((c) => c.id === supplyCardId);
    if (faceIdx >= 0) {
      card = target.faceUp.splice(faceIdx, 1)[0];
    } else {
      const handIdx = target.hand.findIndex((c) => c.id === supplyCardId);
      if (handIdx >= 0) card = target.hand.splice(handIdx, 1)[0];
    }
  } else if (target.faceUp.length > 0) {
    card = target.faceUp.pop();
  } else if (target.hand.length > 0) {
    card = target.hand.splice(Math.floor(Math.random() * target.hand.length), 1)[0];
  }

  if (card) {
    thief.hand.push(card);
    thief.handCount = thief.hand.length;
    next.lastAction = {
      type: 'steal',
      playerId: thief.id,
      playerName: thief.name,
      detail: `从 ${target.name} 抢到 ${supplyCardLabel(card)}`,
    };
  }
  return finishActionTurn(next);
}

function executeSpecialAction(
  state: LifeboatGameState,
  playerId: string,
  cardId: string,
): LifeboatGameState {
  const next = cloneState(state);
  const player = getPlayer(next, playerId);
  if (!player) return state;
  const handIdx = player.hand.findIndex((c) => c.id === cardId);
  if (handIdx < 0) return state;
  const card = player.hand[handIdx]!;

  if (card.specialAction === 'medkit') {
    player.hand.splice(handIdx, 1);
    player.handCount = player.hand.length;
    next.supplyDiscard.push(card);
    healPlayer(player, 1);
    next.lastAction = { type: 'special', playerId, playerName: player.name, detail: '使用医疗包' };
    return finishActionTurn(next);
  }

  if (card.specialAction === 'gun') {
    player.hand.splice(handIdx, 1);
    player.handCount = player.hand.length;
    next.supplyDiscard.push(card);
    next.lastAction = { type: 'special', playerId, playerName: player.name, detail: '使用手枪' };
    return finishActionTurn(next);
  }

  if (card.specialAction === 'flare') {
    player.hand.splice(handIdx, 1);
    player.handCount = player.hand.length;
    next.supplyDiscard.push(card);
    next.lastAction = { type: 'special', playerId, playerName: player.name, detail: '发射信号枪' };
    return finishActionTurn(next);
  }

  if (card.kind === 'parasol') {
    player.hand.splice(handIdx, 1);
    player.handCount = player.hand.length;
    player.faceUp.push(card);
    player.hasParasol = true;
    next.lastAction = { type: 'special', playerId, playerName: player.name, detail: '展开阳伞' };
    return finishActionTurn(next);
  }

  return state;
}

export function respondToRequest(
  state: LifeboatGameState,
  playerId: string,
  accept: boolean,
): LifeboatGameState {
  if (state.phase !== 'pending_response' || !state.pendingRequest) return state;
  const req = state.pendingRequest;
  if (req.targetId !== playerId) return state;

  if (accept) {
    const next = cloneState(state);
    if (req.type === 'swap') {
      swapSeats(next, req.initiatorId, req.targetId);
      next.lastAction = {
        type: 'swap',
        playerId: req.initiatorId,
        playerName: getPlayer(next, req.initiatorId)?.name ?? '',
        detail: '换位成功',
      };
    } else {
      next.pendingRequest = null;
      next.phase = 'action';
      return executeSteal(next, req.initiatorId, req.targetId, req.supplyCardId);
    }
    next.pendingRequest = null;
    next.phase = 'action';
    return finishActionTurn(next);
  }

  const next = cloneState(state);
  next.combat = {
    attackerId: req.initiatorId,
    defenderId: req.targetId,
    reason: req.type,
    supports: {},
    resolved: false,
  };
  next.pendingRequest = null;
  next.phase = 'combat';
  next.message = '战斗！请选择支持方';
  const eligible = consciousPlayers(next).filter(
    (x) => x.id !== req.initiatorId && x.id !== req.targetId,
  );
  if (eligible.length === 0) return resolveCombat(next);
  return next;
}

export function submitCombatSupport(
  state: LifeboatGameState,
  playerId: string,
  side: CombatSide,
): LifeboatGameState {
  if (state.phase !== 'combat' || !state.combat || state.combat.resolved) return state;
  const combat = state.combat;
  const p = getPlayer(state, playerId);
  if (!p || p.isDead || p.isUnconscious) return state;
  if (playerId === combat.attackerId || playerId === combat.defenderId) return state;

  const next = cloneState(state);
  next.combat!.supports[playerId] = side;

  const eligible = consciousPlayers(next).filter(
    (x) => x.id !== combat.attackerId && x.id !== combat.defenderId,
  );
  const allResponded = eligible.every((x) => next.combat!.supports[x.id] !== undefined);
  if (!allResponded) return next;

  return resolveCombat(next);
}

export function resolveCombat(state: LifeboatGameState): LifeboatGameState {
  if (!state.combat) return state;
  const next = cloneState(state);
  const combat = next.combat!;

  const attackerSide = [combat.attackerId];
  const defenderSide = [combat.defenderId];
  for (const [pid, side] of Object.entries(combat.supports)) {
    if (side === 'attacker') attackerSide.push(pid);
    else if (side === 'defender') defenderSide.push(pid);
  }

  const atkStr = computeSideStrength(next, attackerSide);
  const defStr = computeSideStrength(next, defenderSide);
  const loserId = atkStr >= defStr ? combat.defenderId : combat.attackerId;
  const loser = getPlayer(next, loserId)!;
  applyDamageToPlayer(loser, 1);

  for (const id of [...attackerSide, ...defenderSide]) {
    const p = getPlayer(next, id);
    if (p && !p.isDead) p.thirstPending = true;
  }

  combat.resolved = true;
  next.combat = null;
  next.phase = 'action';
  next.lastAction = {
    type: 'combat',
    playerId: loser.id,
    playerName: loser.name,
    detail: `${loser.name} 在战斗中受伤 (${atkStr} vs ${defStr})`,
  };
  next.message = next.lastAction.detail ?? '';
  return finishActionTurn(next);
}

/** Attacker/defender auto-submit none and resolve when only two conscious fighters */
export function autoResolveCombatIfReady(state: LifeboatGameState): LifeboatGameState {
  if (state.phase !== 'combat' || !state.combat) return state;
  const eligible = consciousPlayers(state).filter(
    (x) => x.id !== state.combat!.attackerId && x.id !== state.combat!.defenderId,
  );
  if (eligible.length === 0) return resolveCombat(state);
  return state;
}

export function pickNavigation(
  state: LifeboatGameState,
  playerId: string,
  cardIndex: number,
): LifeboatGameState {
  if (state.phase !== 'navigation_pick') return state;
  if (state.navigatorId !== playerId) return state;
  if (cardIndex < 0 || cardIndex >= state.navigationChoices.length) return state;

  const next = cloneState(state);
  const picked = next.navigationChoices[cardIndex]!;
  const pileIdx = next.rowingPile.findIndex((c) => c.id === picked.id);
  if (pileIdx >= 0) {
    next.rowingPile.splice(pileIdx, 1);
  }
  const rest = next.rowingPile.splice(0);
  next.navigationDeck.push(...rest);
  next.rowingPile = [];
  next.navigationChoices = [];

  return resolveNavigationCard(next, picked);
}

export function playSupplyForThirst(
  state: LifeboatGameState,
  playerId: string,
  cardId: string,
): LifeboatGameState {
  if (state.phase !== 'thirst_resolve') return state;
  if (state.thirstQueue[0] !== playerId) return state;

  const next = cloneState(state);
  const player = getPlayer(next, playerId);
  if (!player) return state;

  const handIdx = player.hand.findIndex((c) => c.id === cardId && c.kind === 'water');
  const faceIdx = player.faceUp.findIndex((c) => c.id === cardId && c.kind === 'water');
  let card: SupplyCard | undefined;
  if (handIdx >= 0) {
    card = player.hand.splice(handIdx, 1)[0];
  } else if (faceIdx >= 0) {
    card = player.faceUp.splice(faceIdx, 1)[0];
  }
  if (!card) return state;

  next.supplyDiscard.push(card);
  player.thirstPending = false;
  next.thirstQueue.shift();
  next.lastAction = { type: 'thirst', playerId, playerName: player.name, detail: '打出淡水' };

  if (next.thirstQueue.length === 0) {
    return advanceRound(next);
  } else {
    const nextId = next.thirstQueue[0]!;
    next.message = `${getPlayer(next, nextId)?.name ?? ''} 需要解渴`;
  }
  return next;
}

export function skipThirst(
  state: LifeboatGameState,
  playerId: string,
): LifeboatGameState {
  if (state.phase !== 'thirst_resolve') return state;
  if (state.thirstQueue[0] !== playerId) return state;

  const next = cloneState(state);
  const player = getPlayer(next, playerId);
  if (!player) return state;

  applyDamageToPlayer(player, 1);
  player.thirstPending = false;
  next.thirstQueue.shift();
  next.lastAction = { type: 'thirst', playerId, playerName: player.name, detail: '口渴扣血' };

  if (next.thirstQueue.length === 0) {
    const ended = checkGameEnd(next);
    if (ended.phase === 'ended') return ended;
    return advanceRound(next);
  }
  const nextId = next.thirstQueue[0]!;
  next.message = `${getPlayer(next, nextId)?.name ?? ''} 需要解渴`;
  return next;
}

export function redactLifeboatState(
  state: LifeboatGameState,
  viewerId: string | null,
): LifeboatGameState {
  const revealAll = state.phase === 'ended';
  const next = cloneState(state);

  next.players = next.players.map((p) => {
    const full = { ...p, handCount: p.hand.length };
    if (revealAll || p.id === viewerId) return full;
    return {
      ...full,
      hand: [],
      loveCharacterId: p.characterId,
      hateCharacterId: p.characterId,
    };
  });

  return next;
}

export { supplyCardLabel, SUPPLY_LABELS } from './cards.js';
export { CHARACTER_LABELS } from './characters.js';
