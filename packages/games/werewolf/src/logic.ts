import { pickRandom, shuffle } from '@game-lobby/game-core';
import type { GameParticipant } from '@game-lobby/game-core';

export type WerewolfRole =
  | 'werewolf'
  | 'villager'
  | 'seer'
  | 'witch'
  | 'hunter'
  | 'guard'
  | 'idiot';

export type WerewolfRoleOrHidden = WerewolfRole | 'unknown';

export type RolePresetId = 'simple_6' | 'standard_9' | 'classic_12' | 'custom';

export type WerewolfPhase =
  | 'night_wolf'
  | 'night_seer'
  | 'night_witch'
  | 'night_guard'
  | 'night_resolve'
  | 'day_announce'
  | 'day_discuss'
  | 'day_vote'
  | 'reveal'
  | 'hunter_shoot'
  | 'ended';

export type DiscussionMode = 'free' | 'sequential';

export type WitchActionType = 'heal' | 'poison' | 'skip';

export interface SpeechMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  round: number;
}

export interface WolfChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  round: number;
}

export interface SeerPeekRecord {
  targetId: string;
  targetName: string;
  isWerewolf: boolean;
  round: number;
}

export interface EliminationRecord {
  id: string;
  name: string;
  role: WerewolfRole;
  cause: 'wolf' | 'poison' | 'vote' | 'hunter';
}

export interface RoleBoardConfig {
  preset: RolePresetId;
  roles: WerewolfRole[];
}

export interface WerewolfPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  seatIndex: number;
  isAlive: boolean;
  role: WerewolfRoleOrHidden;
  canVote: boolean;
  idiotRevealed: boolean;
}

export interface WerewolfNightState {
  wolfVotes: Record<string, string>;
  wolfKillTarget: string | null;
  seerPeek: string | null;
  witchAction: { type: WitchActionType; targetId?: string } | null;
  guardTarget: string | null;
}

export interface WerewolfGameState {
  phase: WerewolfPhase;
  round: number;
  players: WerewolfPlayerState[];
  roleBoard: RoleBoardConfig;
  speeches: SpeechMessage[];
  wolfChats: WolfChatMessage[];
  dayVotes: Record<string, string>;
  nightDeaths: string[];
  nightState: WerewolfNightState;
  lastEliminated: EliminationRecord | null;
  gameContinues: boolean | null;
  winner: 'wolves' | 'village' | null;
  message: string;
  phaseDeadline: number | null;
  currentSpeakerIndex: number;
  discussionMode: DiscussionMode;
  witchHealUsed: boolean;
  witchPoisonUsed: boolean;
  lastGuardTarget: string | null;
  seerHistory: SeerPeekRecord[];
  pendingHunterId: string | null;
  revealedPlayerIds: string[];
  hunterCannotShoot: boolean;
}

export interface WerewolfStartOptions {
  rolePreset?: RolePresetId;
  customRoles?: WerewolfRole[];
  discussionMode?: DiscussionMode;
}

export const ROLE_LABELS: Record<WerewolfRole, string> = {
  werewolf: '狼人',
  villager: '村民',
  seer: '预言家',
  witch: '女巫',
  hunter: '猎人',
  guard: '守卫',
  idiot: '白痴',
};

export const ROLE_PRESET_ROLES: Record<Exclude<RolePresetId, 'custom'>, WerewolfRole[]> = {
  simple_6: ['werewolf', 'werewolf', 'seer', 'hunter', 'villager', 'villager'],
  standard_9: [
    'werewolf',
    'werewolf',
    'werewolf',
    'seer',
    'witch',
    'hunter',
    'villager',
    'villager',
    'villager',
  ],
  classic_12: [
    'werewolf',
    'werewolf',
    'werewolf',
    'werewolf',
    'seer',
    'witch',
    'hunter',
    'guard',
    'idiot',
    'villager',
    'villager',
    'villager',
  ],
};

const PHASE_DURATIONS_MS: Partial<Record<WerewolfPhase, number>> = {
  night_wolf: 60_000,
  night_seer: 30_000,
  night_witch: 30_000,
  night_guard: 30_000,
  day_announce: 15_000,
  day_discuss: 120_000,
  day_vote: 60_000,
  reveal: 10_000,
  hunter_shoot: 30_000,
};

function emptyNightState(): WerewolfNightState {
  return {
    wolfVotes: {},
    wolfKillTarget: null,
    seerPeek: null,
    witchAction: null,
    guardTarget: null,
  };
}

function alivePlayers(state: WerewolfGameState): WerewolfPlayerState[] {
  return state.players.filter((p) => p.isAlive);
}

function aliveWolves(state: WerewolfGameState): WerewolfPlayerState[] {
  return alivePlayers(state).filter((p) => p.role === 'werewolf');
}

function isWerewolf(role: WerewolfRoleOrHidden): boolean {
  return role === 'werewolf';
}

function playerById(state: WerewolfGameState, id: string): WerewolfPlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

function currentSpeaker(state: WerewolfGameState): WerewolfPlayerState | undefined {
  const alive = alivePlayers(state);
  return alive[state.currentSpeakerIndex];
}

function setDeadline(phase: WerewolfPhase, now = Date.now()): number | null {
  const duration = PHASE_DURATIONS_MS[phase];
  return duration != null ? now + duration : null;
}

function withPhase(
  state: WerewolfGameState,
  phase: WerewolfPhase,
  message: string,
  extra: Partial<WerewolfGameState> = {},
): WerewolfGameState {
  return {
    ...state,
    ...extra,
    phase,
    message,
    phaseDeadline: setDeadline(phase),
  };
}

export function resolveRolesFromOptions(
  playerCount: number,
  options: WerewolfStartOptions = {},
): WerewolfRole[] {
  const preset = options.rolePreset ?? 'simple_6';
  if (preset === 'custom') {
    return options.customRoles ?? ROLE_PRESET_ROLES.simple_6;
  }
  return ROLE_PRESET_ROLES[preset];
}

export function validateRoleBoard(
  roles: WerewolfRole[],
  playerCount: number,
): { ok: true } | { ok: false; message: string } {
  if (roles.length !== playerCount) {
    return { ok: false, message: `角色数量（${roles.length}）须与玩家人数（${playerCount}）一致` };
  }
  const wolfCount = roles.filter((r) => r === 'werewolf').length;
  const goodCount = roles.length - wolfCount;
  if (wolfCount < 2) {
    return { ok: false, message: '至少需要 2 名狼人' };
  }
  if (wolfCount >= goodCount) {
    return { ok: false, message: '狼人数量必须少于好人阵营' };
  }
  if (!roles.includes('werewolf')) {
    return { ok: false, message: '角色板须包含狼人' };
  }
  if (!roles.includes('villager')) {
    return { ok: false, message: '角色板须包含村民' };
  }
  return { ok: true };
}

function resolveWolfKillTarget(votes: Record<string, string>): string | null {
  const tally: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    tally[target] = (tally[target] ?? 0) + 1;
  }
  const counts = Object.values(tally);
  if (counts.length === 0) return null;
  const max = Math.max(...counts);
  const top = Object.entries(tally)
    .filter(([, c]) => c === max)
    .map(([id]) => id);
  return top.length === 1 ? top[0]! : null;
}

function resolveVoteTally(votes: Record<string, string>): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    tally[target] = (tally[target] ?? 0) + 1;
  }
  return tally;
}

function topVotedIds(tally: Record<string, number>): string[] {
  const values = Object.values(tally);
  if (values.length === 0) return [];
  const maxVotes = Math.max(...values);
  return Object.entries(tally)
    .filter(([, count]) => count === maxVotes)
    .map(([id]) => id);
}

function hasAliveRole(state: WerewolfGameState, role: WerewolfRole): boolean {
  return alivePlayers(state).some((p) => p.role === role);
}

function nextNightPhaseAfter(
  state: WerewolfGameState,
  after: WerewolfPhase,
): WerewolfPhase {
  const order: WerewolfPhase[] = ['night_wolf', 'night_seer', 'night_witch', 'night_guard'];
  const start = order.indexOf(after) + 1;
  for (let i = start; i < order.length; i++) {
    const phase = order[i]!;
    if (phase === 'night_seer' && !hasAliveRole(state, 'seer')) continue;
    if (phase === 'night_witch' && !hasAliveRole(state, 'witch')) continue;
    if (
      phase === 'night_witch' &&
      state.witchHealUsed &&
      state.witchPoisonUsed
    ) {
      continue;
    }
    if (phase === 'night_guard' && !hasAliveRole(state, 'guard')) continue;
    return phase;
  }
  return 'night_resolve';
}

function markRevealed(state: WerewolfGameState, playerId: string): string[] {
  if (state.revealedPlayerIds.includes(playerId)) return state.revealedPlayerIds;
  return [...state.revealedPlayerIds, playerId];
}

function checkWinCondition(state: WerewolfGameState): WerewolfGameState {
  const alive = alivePlayers(state);
  const wolves = alive.filter((p) => p.role === 'werewolf').length;
  const goods = alive.filter((p) => p.role !== 'werewolf').length;
  if (wolves === 0) {
    return { ...state, winner: 'village', gameContinues: false };
  }
  if (wolves >= goods) {
    return { ...state, winner: 'wolves', gameContinues: false };
  }
  return { ...state, winner: null };
}

function killPlayer(
  state: WerewolfGameState,
  playerId: string,
  cause: EliminationRecord['cause'],
): WerewolfGameState {
  const player = playerById(state, playerId);
  if (!player || !player.isAlive) return state;

  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, isAlive: false } : p,
  );

  const role = player.role as WerewolfRole;
  let next: WerewolfGameState = {
    ...state,
    players: updatedPlayers,
    revealedPlayerIds: markRevealed(state, playerId),
    lastEliminated: {
      id: player.id,
      name: player.name,
      role,
      cause,
    },
  };

  if (role === 'hunter' && cause !== 'poison') {
    next = { ...next, pendingHunterId: player.id, hunterCannotShoot: false };
  }

  return checkWinCondition(next);
}

export function resolveNight(state: WerewolfGameState): WerewolfGameState {
  const wolfTarget = state.nightState.wolfKillTarget;
  const guardTarget = state.nightState.guardTarget;
  const witch = state.nightState.witchAction;

  let killedByWolf: string | null = null;
  if (wolfTarget) {
    const guarded = guardTarget === wolfTarget;
    if (!guarded) {
      killedByWolf = wolfTarget;
    }
  }

  let healed = false;
  if (witch?.type === 'heal' && killedByWolf && witch.targetId === killedByWolf) {
    healed = true;
    killedByWolf = null;
  }

  const deaths: string[] = [];
  if (killedByWolf) deaths.push(killedByWolf);

  if (witch?.type === 'poison' && witch.targetId) {
    const poisonTarget = witch.targetId;
    if (!deaths.includes(poisonTarget)) {
      deaths.push(poisonTarget);
    }
  }

  let next: WerewolfGameState = {
    ...state,
    nightDeaths: deaths,
    nightState: emptyNightState(),
    witchHealUsed: state.witchHealUsed || witch?.type === 'heal',
    witchPoisonUsed: state.witchPoisonUsed || witch?.type === 'poison',
    lastGuardTarget: guardTarget ?? state.lastGuardTarget,
  };

  for (const id of deaths) {
    const cause = witch?.type === 'poison' && witch.targetId === id ? 'poison' : 'wolf';
    if (witch?.type === 'poison' && witch.targetId === id) {
      next = killPlayer(next, id, 'poison');
      if (playerById(state, id)?.role === 'hunter') {
        next = { ...next, pendingHunterId: null, hunterCannotShoot: true };
      }
    } else {
      next = killPlayer(next, id, 'wolf');
    }
  }

  if (deaths.length === 0) {
    next = { ...next, message: '昨夜平安夜，无人死亡。' };
  } else {
    const names = deaths.map((id) => playerById(state, id)?.name ?? id).join('、');
    next = { ...next, message: `昨夜 ${names} 死亡。` };
  }

  if (next.pendingHunterId && !next.hunterCannotShoot) {
    const hunter = playerById(next, next.pendingHunterId);
    return withPhase(next, 'hunter_shoot', `${hunter?.name ?? '猎人'} 发动技能，请选择开枪目标。`);
  }

  if (!next.gameContinues && next.winner) {
    return withPhase(next, 'ended', winMessage(next.winner), { phaseDeadline: null });
  }

  return withPhase(next, 'day_announce', next.message);
}

function winMessage(winner: 'wolves' | 'village'): string {
  return winner === 'wolves' ? '狼人阵营胜利！' : '好人阵营胜利！';
}

function beginNight(state: WerewolfGameState): WerewolfGameState {
  const wolves = aliveWolves(state);
  return withPhase(
    {
      ...state,
      round: state.round + 1,
      nightState: emptyNightState(),
      nightDeaths: [],
      dayVotes: {},
      speeches: state.speeches,
      wolfChats: [],
      lastEliminated: null,
      gameContinues: null,
      currentSpeakerIndex: 0,
      pendingHunterId: null,
      hunterCannotShoot: false,
    },
    'night_wolf',
    wolves.length > 0
      ? `第 ${state.round + 1} 夜，狼人请选择刀人目标。`
      : `第 ${state.round + 1} 夜。`,
  );
}

export function createWerewolfGame(
  participants: GameParticipant[],
  options: WerewolfStartOptions = {},
): WerewolfGameState {
  const preset = options.rolePreset ?? 'simple_6';
  const roles = resolveRolesFromOptions(participants.length, options);
  const validation = validateRoleBoard(roles, participants.length);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const shuffledRoles = shuffle([...roles]);
  const shuffledPlayers = shuffle([...participants]);
  const players: WerewolfPlayerState[] = shuffledPlayers.map((p, i) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    seatIndex: i,
    isAlive: true,
    role: shuffledRoles[i]!,
    canVote: true,
    idiotRevealed: false,
  }));

  const discussionMode = options.discussionMode ?? 'sequential';

  return withPhase(
    {
      phase: 'night_wolf',
      round: 1,
      players,
      roleBoard: { preset, roles: [...roles] },
      speeches: [],
      wolfChats: [],
      dayVotes: {},
      nightDeaths: [],
      nightState: emptyNightState(),
      lastEliminated: null,
      gameContinues: null,
      winner: null,
      message: '游戏开始，第 1 夜，狼人请选择刀人目标。',
      phaseDeadline: null,
      currentSpeakerIndex: 0,
      discussionMode,
      witchHealUsed: false,
      witchPoisonUsed: false,
      lastGuardTarget: null,
      seerHistory: [],
      pendingHunterId: null,
      revealedPlayerIds: [],
      hunterCannotShoot: false,
    },
    'night_wolf',
    '游戏开始，第 1 夜，狼人请选择刀人目标。',
  );
}

function allWolvesVoted(state: WerewolfGameState): boolean {
  const wolves = aliveWolves(state);
  return wolves.every((w) => state.nightState.wolfVotes[w.id] != null);
}

function advanceFromWolfPhase(state: WerewolfGameState): WerewolfGameState {
  const wolfKillTarget = resolveWolfKillTarget(state.nightState.wolfVotes);
  const withTarget = {
    ...state,
    nightState: { ...state.nightState, wolfKillTarget },
  };
  const nextPhase = nextNightPhaseAfter(withTarget, 'night_wolf');
  if (nextPhase === 'night_resolve') {
    return resolveNight(withTarget);
  }
  const messages: Record<WerewolfPhase, string> = {
    night_seer: '预言家请查验一名玩家。',
    night_witch: '女巫请选择是否使用药水。',
    night_guard: '守卫请选择守护目标。',
    night_wolf: '',
    night_resolve: '',
    day_announce: '',
    day_discuss: '',
    day_vote: '',
    reveal: '',
    hunter_shoot: '',
    ended: '',
  };
  return withPhase(withTarget, nextPhase, messages[nextPhase] ?? '');
}

export function submitWolfVote(
  state: WerewolfGameState,
  playerId: string,
  targetId: string,
): WerewolfGameState {
  if (state.phase !== 'night_wolf') return state;
  const voter = playerById(state, playerId);
  if (!voter?.isAlive || voter.role !== 'werewolf') return state;
  const target = playerById(state, targetId);
  if (!target?.isAlive || target.role === 'werewolf') return state;

  const wolfVotes = { ...state.nightState.wolfVotes, [playerId]: targetId };
  const next = {
    ...state,
    nightState: { ...state.nightState, wolfVotes },
    message: '等待其他狼人投票…',
  };
  if (!allWolvesVoted(next)) return next;
  return advanceFromWolfPhase(next);
}

export function sendWolfChat(
  state: WerewolfGameState,
  playerId: string,
  text: string,
): WerewolfGameState {
  const trimmed = text.trim();
  if (!trimmed || state.phase !== 'night_wolf') return state;
  const sender = playerById(state, playerId);
  if (!sender?.isAlive || sender.role !== 'werewolf') return state;

  const message: WolfChatMessage = {
    id: `wolf-${state.round}-${state.wolfChats.length}`,
    playerId: sender.id,
    playerName: sender.name,
    text: trimmed,
    round: state.round,
  };
  return {
    ...state,
    wolfChats: [...state.wolfChats, message],
  };
}

export function submitSeerPeek(
  state: WerewolfGameState,
  playerId: string,
  targetId: string,
): WerewolfGameState {
  if (state.phase !== 'night_seer') return state;
  const seer = playerById(state, playerId);
  if (!seer?.isAlive || seer.role !== 'seer') return state;
  const target = playerById(state, targetId);
  if (!target?.isAlive || target.id === playerId) return state;

  const peek: SeerPeekRecord = {
    targetId: target.id,
    targetName: target.name,
    isWerewolf: isWerewolf(target.role),
    round: state.round,
  };

  const next = {
    ...state,
    nightState: { ...state.nightState, seerPeek: targetId },
    seerHistory: [...state.seerHistory, peek],
    message: `你查验了 ${target.name}。`,
  };

  const nextPhase = nextNightPhaseAfter(next, 'night_seer');
  if (nextPhase === 'night_resolve') return resolveNight(next);
  const msg =
    nextPhase === 'night_witch' ? '女巫请选择是否使用药水。' : '守卫请选择守护目标。';
  return withPhase(next, nextPhase, msg);
}

export function submitWitchAction(
  state: WerewolfGameState,
  playerId: string,
  action: WitchActionType,
  targetId?: string,
): WerewolfGameState {
  if (state.phase !== 'night_witch') return state;
  const witch = playerById(state, playerId);
  if (!witch?.isAlive || witch.role !== 'witch') return state;

  if (action === 'skip') {
    const next = {
      ...state,
      nightState: { ...state.nightState, witchAction: { type: 'skip' as const } },
    };
    const nextPhase = nextNightPhaseAfter(next, 'night_witch');
    if (nextPhase === 'night_resolve') return resolveNight(next);
    return withPhase(next, nextPhase, '守卫请选择守护目标。');
  }

  if (action === 'heal') {
    if (state.witchHealUsed) return { ...state, message: '解药已使用。' };
    if (!targetId || !state.nightState.wolfKillTarget) {
      return { ...state, message: '今夜无人被刀，无法使用解药。' };
    }
    if (targetId !== state.nightState.wolfKillTarget) {
      return { ...state, message: '只能救治今夜被刀的玩家。' };
    }
    const next = {
      ...state,
      nightState: { ...state.nightState, witchAction: { type: 'heal' as const, targetId } },
    };
    const nextPhase = nextNightPhaseAfter(next, 'night_witch');
    if (nextPhase === 'night_resolve') return resolveNight(next);
    return withPhase(next, nextPhase, '守卫请选择守护目标。');
  }

  if (action === 'poison') {
    if (state.witchPoisonUsed) return { ...state, message: '毒药已使用。' };
    const target = targetId ? playerById(state, targetId) : undefined;
    if (!target?.isAlive) return state;
    const next = {
      ...state,
      nightState: { ...state.nightState, witchAction: { type: 'poison' as const, targetId } },
    };
    const nextPhase = nextNightPhaseAfter(next, 'night_witch');
    if (nextPhase === 'night_resolve') return resolveNight(next);
    return withPhase(next, nextPhase, '守卫请选择守护目标。');
  }

  return state;
}

export function submitGuardProtect(
  state: WerewolfGameState,
  playerId: string,
  targetId: string,
): WerewolfGameState {
  if (state.phase !== 'night_guard') return state;
  const guard = playerById(state, playerId);
  if (!guard?.isAlive || guard.role !== 'guard') return state;
  const target = playerById(state, targetId);
  if (!target?.isAlive) return state;
  if (state.lastGuardTarget === targetId) {
    return { ...state, message: '不能连续两夜守护同一名玩家。' };
  }

  const next = {
    ...state,
    nightState: { ...state.nightState, guardTarget: targetId },
  };
  return resolveNight(next);
}

export function advanceFromDayAnnounce(state: WerewolfGameState): WerewolfGameState {
  if (state.phase !== 'day_announce') return state;
  const alive = alivePlayers(state);
  const first = alive[0];
  if (state.discussionMode === 'free') {
    return withPhase(
      state,
      'day_discuss',
      '白天讨论开始，所有玩家可自由发言。',
      { currentSpeakerIndex: 0 },
    );
  }
  return withPhase(
    state,
    'day_discuss',
    first ? `白天讨论，轮到 ${first.name} 发言。` : '白天讨论开始。',
    { currentSpeakerIndex: 0 },
  );
}

export function sendWerewolfSpeech(
  state: WerewolfGameState,
  playerId: string,
  text: string,
): WerewolfGameState {
  const trimmed = text.trim();
  if (!trimmed || state.phase !== 'day_discuss') return state;
  const speaker = playerById(state, playerId);
  if (!speaker?.isAlive) return state;

  if (state.discussionMode === 'sequential') {
    const current = currentSpeaker(state);
    if (!current || current.id !== playerId) return state;
  }

  const message: SpeechMessage = {
    id: `${state.round}-${playerId}-${state.speeches.length}`,
    playerId: speaker.id,
    playerName: speaker.name,
    text: trimmed,
    round: state.round,
  };

  return {
    ...state,
    speeches: [...state.speeches, message],
    message: `${speaker.name} 发言中…`,
  };
}

export function endWerewolfSpeaking(
  state: WerewolfGameState,
  playerId: string,
): WerewolfGameState {
  if (state.phase !== 'day_discuss') return state;

  if (state.discussionMode === 'free') {
    return withPhase(state, 'day_vote', '讨论结束，请投票放逐一名玩家。', { dayVotes: {} });
  }

  const speaker = currentSpeaker(state);
  if (!speaker || speaker.id !== playerId) return state;

  const alive = alivePlayers(state);
  const nextIndex = state.currentSpeakerIndex + 1;
  if (nextIndex >= alive.length) {
    return withPhase(state, 'day_vote', '讨论结束，请投票放逐一名玩家。', {
      dayVotes: {},
      currentSpeakerIndex: 0,
    });
  }
  const nextSpeaker = alive[nextIndex]!;
  return {
    ...state,
    currentSpeakerIndex: nextIndex,
    message: `轮到 ${nextSpeaker.name} 发言。`,
  };
}

function beginReveal(
  state: WerewolfGameState,
  updates: Partial<WerewolfGameState>,
): WerewolfGameState {
  return withPhase(
    { ...state, ...updates, dayVotes: {} },
    'reveal',
    updates.message ?? state.message,
  );
}

export function submitDayVote(
  state: WerewolfGameState,
  voterId: string,
  targetId: string,
): WerewolfGameState {
  if (state.phase !== 'day_vote') return state;
  const voter = playerById(state, voterId);
  if (!voter?.isAlive || !voter.canVote) return state;
  const target = playerById(state, targetId);
  if (!target?.isAlive) return state;

  const dayVotes = { ...state.dayVotes, [voterId]: targetId };
  const alive = alivePlayers(state).filter((p) => p.canVote);
  if (Object.keys(dayVotes).length < alive.length) {
    return { ...state, dayVotes, message: '等待其他玩家投票…' };
  }

  const tally = resolveVoteTally(dayVotes);
  const tiedIds = topVotedIds(tally);

  if (tiedIds.length > 1) {
    return beginReveal(state, {
      lastEliminated: null,
      gameContinues: true,
      message: '投票平票，今日无人出局。',
    });
  }

  const eliminatedId = tiedIds[0];
  if (!eliminatedId) return state;

  const eliminated = playerById(state, eliminatedId)!;

  if (eliminated.role === 'idiot' && !eliminated.idiotRevealed) {
    const updatedPlayers = state.players.map((p) =>
      p.id === eliminatedId
        ? { ...p, idiotRevealed: true, canVote: false }
        : p,
    );
    return beginReveal(
      { ...state, players: updatedPlayers, revealedPlayerIds: markRevealed(state, eliminatedId) },
      {
        lastEliminated: null,
        gameContinues: true,
        message: `${eliminated.name} 是白痴，翻牌免疫，今日不出局。`,
      },
    );
  }

  let next = killPlayer(state, eliminatedId, 'vote');
  next = beginReveal(next, {
    gameContinues: next.winner ? false : true,
    message: next.winner
      ? `${eliminated.name}（${ROLE_LABELS[eliminated.role as WerewolfRole]}）被放逐，${winMessage(next.winner!)}`
      : `${eliminated.name}（${ROLE_LABELS[eliminated.role as WerewolfRole]}）被放逐。`,
  });

  if (next.pendingHunterId && !next.hunterCannotShoot) {
    return {
      ...next,
      phase: 'hunter_shoot',
      message: `${eliminated.name} 是猎人，请选择开枪目标。`,
      phaseDeadline: setDeadline('hunter_shoot'),
    };
  }

  return next;
}

export function submitHunterShoot(
  state: WerewolfGameState,
  playerId: string,
  targetId: string,
): WerewolfGameState {
  if (state.phase !== 'hunter_shoot') return state;
  if (state.pendingHunterId !== playerId) return state;
  const target = playerById(state, targetId);
  if (!target?.isAlive || target.id === playerId) return state;

  let next = killPlayer(state, targetId, 'hunter');
  next = {
    ...next,
    pendingHunterId: null,
    message: `猎人带走了 ${target.name}（${ROLE_LABELS[target.role as WerewolfRole]}）。`,
  };

  if (!next.gameContinues && next.winner) {
    return withPhase(next, 'ended', winMessage(next.winner), { phaseDeadline: null });
  }

  if (next.phase === 'reveal') {
    return next;
  }

  return withPhase(next, 'reveal', next.message, { gameContinues: next.winner ? false : true });
}

export function advanceWerewolfFromReveal(state: WerewolfGameState): WerewolfGameState {
  if (state.phase !== 'reveal') return state;

  if (!state.gameContinues || state.winner) {
    return withPhase(
      { ...state, winner: state.winner ?? 'village' },
      'ended',
      state.winner ? winMessage(state.winner) : '游戏结束。',
      { phaseDeadline: null },
    );
  }

  return beginNight(state);
}

export function skipHunterShoot(state: WerewolfGameState, playerId: string): WerewolfGameState {
  if (state.phase !== 'hunter_shoot' || state.pendingHunterId !== playerId) return state;
  const next = {
    ...state,
    pendingHunterId: null,
    message: '猎人放弃开枪。',
  };
  if (state.lastEliminated) {
    return withPhase(next, 'reveal', next.message, { gameContinues: true });
  }
  return beginNight(next);
}

export function advancePhaseOnTimeout(state: WerewolfGameState, now = Date.now()): WerewolfGameState {
  if (state.phase === 'ended') return state;
  if (state.phaseDeadline == null || now < state.phaseDeadline) return state;

  switch (state.phase) {
    case 'night_wolf': {
      const wolves = aliveWolves(state);
      let next = state;
      for (const w of wolves) {
        if (next.nightState.wolfVotes[w.id]) continue;
        const targets = alivePlayers(next).filter((p) => p.role !== 'werewolf');
        const target = pickRandom(targets);
        if (target) next = submitWolfVote(next, w.id, target.id);
      }
      if (next.phase === 'night_wolf') return advanceFromWolfPhase(next);
      return next;
    }
    case 'night_seer': {
      const seer = alivePlayers(state).find((p) => p.role === 'seer');
      if (!seer) return resolveNight(state);
      const targets = alivePlayers(state).filter((p) => p.id !== seer.id);
      const target = pickRandom(targets);
      if (!target) return resolveNight(state);
      return submitSeerPeek(state, seer.id, target.id);
    }
    case 'night_witch': {
      const witch = alivePlayers(state).find((p) => p.role === 'witch');
      if (!witch) return resolveNight(state);
      return submitWitchAction(state, witch.id, 'skip');
    }
    case 'night_guard': {
      const guard = alivePlayers(state).find((p) => p.role === 'guard');
      if (!guard) return resolveNight(state);
      const targets = alivePlayers(state).filter(
        (p) => p.id !== guard.id && p.id !== state.lastGuardTarget,
      );
      const target = pickRandom(targets);
      if (!target) return resolveNight(state);
      return submitGuardProtect(state, guard.id, target.id);
    }
    case 'day_announce':
      return advanceFromDayAnnounce(state);
    case 'day_discuss':
      return endWerewolfSpeaking(state, currentSpeaker(state)?.id ?? '');
    case 'day_vote': {
      let next = state;
      for (const p of alivePlayers(state).filter((x) => x.canVote)) {
        if (next.dayVotes[p.id]) continue;
        const targets = alivePlayers(next).filter((t) => t.id !== p.id);
        const target = pickRandom(targets);
        if (target) next = submitDayVote(next, p.id, target.id);
      }
      return next;
    }
    case 'reveal':
      return advanceWerewolfFromReveal(state);
    case 'hunter_shoot':
      if (state.pendingHunterId) return skipHunterShoot(state, state.pendingHunterId);
      return state;
    default:
      return state;
  }
}

export function getWolfTeammateIds(state: WerewolfGameState, viewerId: string): string[] {
  const viewer = playerById(state, viewerId);
  if (!viewer || viewer.role !== 'werewolf') return [];
  return state.players.filter((p) => p.role === 'werewolf' && p.id !== viewerId).map((p) => p.id);
}

export function redactWerewolfState(
  state: WerewolfGameState,
  viewerId: string | null,
): WerewolfGameState {
  const viewer = viewerId ? playerById(state, viewerId) : undefined;
  const isEnded = state.phase === 'ended';
  const isWolfViewer = viewer?.role === 'werewolf';
  const isSeerViewer = viewer?.role === 'seer';
  const isWitchViewer = viewer?.role === 'witch';

  const players = state.players.map((p) => {
    const isSelf = viewerId != null && p.id === viewerId;
    const roleRevealed =
      isEnded ||
      state.revealedPlayerIds.includes(p.id) ||
      (state.phase === 'reveal' && state.lastEliminated?.id === p.id);

    return {
      ...p,
      role: isSelf || roleRevealed ? p.role : ('unknown' as WerewolfRoleOrHidden),
    };
  });

  let dayVotes: Record<string, string> = {};
  if (state.phase === 'day_vote' || state.phase === 'reveal' || isEnded) {
    dayVotes = state.dayVotes;
  } else if (viewerId && state.dayVotes[viewerId]) {
    dayVotes = { [viewerId]: state.dayVotes[viewerId]! };
  }

  return {
    ...state,
    players,
    nightState: {
      ...state.nightState,
      wolfKillTarget:
        isWitchViewer && state.phase === 'night_witch'
          ? state.nightState.wolfKillTarget
          : null,
      wolfVotes: isWolfViewer ? state.nightState.wolfVotes : {},
      seerPeek: isSeerViewer ? state.nightState.seerPeek : null,
      witchAction: isWitchViewer ? state.nightState.witchAction : null,
      guardTarget: null,
    },
    wolfChats: isWolfViewer ? state.wolfChats : [],
    seerHistory: isSeerViewer ? state.seerHistory : [],
    dayVotes,
    witchHealUsed: isWitchViewer ? state.witchHealUsed : false,
    witchPoisonUsed: isWitchViewer ? state.witchPoisonUsed : false,
  };
}

// Bot helpers
export function pickRandomWolfTarget(state: WerewolfGameState, wolfId: string): string | null {
  const targets = alivePlayers(state).filter((p) => p.role !== 'werewolf' && p.id !== wolfId);
  return pickRandom(targets)?.id ?? null;
}

export function pickRandomPeekTarget(state: WerewolfGameState, seerId: string): string | null {
  const targets = alivePlayers(state).filter((p) => p.id !== seerId);
  return pickRandom(targets)?.id ?? null;
}

export function pickRandomGuardTarget(state: WerewolfGameState, guardId: string): string | null {
  const targets = alivePlayers(state).filter(
    (p) => p.id !== guardId && p.id !== state.lastGuardTarget,
  );
  return pickRandom(targets)?.id ?? null;
}

export function pickRandomVoteTarget(state: WerewolfGameState, voterId: string): string | null {
  const targets = alivePlayers(state).filter((p) => p.id !== voterId);
  return pickRandom(targets)?.id ?? null;
}
