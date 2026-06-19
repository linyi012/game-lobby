import type { GameParticipant } from '@game-lobby/game-core';

export type ActGuessPhase = 'word_select' | 'performing' | 'round_end' | 'ended';
export type ActGuessTeamId = 'A' | 'B';

export interface GuessEntry {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  correct: boolean;
  timestamp: number;
}

export interface ActGuessPlayerState {
  id: string;
  name: string;
  hasGuessed: boolean;
  isSpectator: boolean;
}

export interface WordSourceSnapshot {
  categoryIds: string[];
  userPackIds: string[];
  roomExtraWords: string[];
  wordPool: string[];
}

export interface ActGuessTeams {
  enabled: true;
  assignments: Record<string, ActGuessTeamId>;
}

export interface ActGuessStartOptions {
  categoryIds?: string[];
  userPackIds?: string[];
  roomExtraWords?: string[];
  performDurationSec?: number;
  wordSelectDurationSec?: number;
  wordPool?: string[];
  allPlayers?: { id: string; name: string; isSpectator: boolean }[];
  enableTeams?: boolean;
  teamAssignments?: Record<string, ActGuessTeamId>;
}

export interface ActGuessGameState {
  phase: ActGuessPhase;
  round: number;
  performerOrder: string[];
  performerIndex: number;
  performerId: string;
  roundPerformerTeam: ActGuessTeamId | null;
  wordOptions: string[];
  selectedWord: string | null;
  phaseEndsAt: number;
  guesses: GuessEntry[];
  guessedIds: string[];
  scores: Record<string, number>;
  roundScores: Record<string, number>;
  teamScores: { A: number; B: number } | null;
  roundTeamScores: { A: number; B: number } | null;
  players: ActGuessPlayerState[];
  activePlayerIds: string[];
  teams: ActGuessTeams | null;
  message: string;
  performDurationMs: number;
  wordSelectDurationMs: number;
  wordSource: WordSourceSnapshot;
  turnPassedWords: string[];
}

const ROUND_END_MS = 5000;
let guessIdCounter = 0;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextGuessId(): string {
  guessIdCounter += 1;
  return `guess-${guessIdCounter}`;
}

function pickRandomWords(pool: string[], count: number, exclude: string[] = []): string[] {
  const excludeSet = new Set(exclude);
  const available = pool.filter((w) => !excludeSet.has(w));
  if (available.length === 0) return [];
  const shuffled = shuffle(available);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function pickWordOptions(pool: string[], usedWords: string[]): string[] {
  const options = pickRandomWords(pool, 3, usedWords);
  if (options.length > 0) return options;
  return pickRandomWords(pool, 3);
}

export function getPlayerTeam(
  state: ActGuessGameState,
  playerId: string,
): ActGuessTeamId | null {
  if (!state.teams?.enabled) return null;
  return state.teams.assignments[playerId] ?? null;
}

export function canPlayerGuess(state: ActGuessGameState, playerId: string): boolean {
  if (state.phase !== 'performing') return false;
  if (playerId === state.performerId) return false;
  if (!state.activePlayerIds.includes(playerId)) return false;
  if (state.guessedIds.includes(playerId)) return false;

  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.isSpectator) return false;

  if (state.teams?.enabled) {
    const performerTeam = getPlayerTeam(state, state.performerId);
    const playerTeam = getPlayerTeam(state, playerId);
    if (!performerTeam || !playerTeam || performerTeam !== playerTeam) return false;
  }

  return true;
}

export function getConfirmableGuessers(state: ActGuessGameState): string[] {
  return state.activePlayerIds.filter((id) => canPlayerGuess(state, id));
}

export function canPlayerSeeWord(state: ActGuessGameState, viewerId: string | null): boolean {
  if (!viewerId) return false;
  if (state.phase === 'round_end' || state.phase === 'ended') return true;
  if (state.phase !== 'performing' && state.phase !== 'word_select') return false;
  if (viewerId === state.performerId) return true;

  if (state.teams?.enabled && state.phase === 'performing') {
    const performerTeam = getPlayerTeam(state, state.performerId);
    const viewerTeam = getPlayerTeam(state, viewerId);
    if (performerTeam && viewerTeam && performerTeam !== viewerTeam) return true;
  }

  return false;
}

function buildPerformerOrder(
  activePlayerIds: string[],
  teams: ActGuessTeams | null,
): string[] {
  if (!teams?.enabled) return shuffle(activePlayerIds);

  const teamA = shuffle(activePlayerIds.filter((id) => teams.assignments[id] === 'A'));
  const teamB = shuffle(activePlayerIds.filter((id) => teams.assignments[id] === 'B'));
  const maxLen = Math.max(teamA.length, teamB.length);
  const order: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    if (teamA[i]) order.push(teamA[i]!);
    if (teamB[i]) order.push(teamB[i]!);
  }

  return order;
}

function beginWordSelect(
  state: ActGuessGameState,
  now: number,
  usedWords?: string[],
): ActGuessGameState {
  const performerId = state.performerOrder[state.performerIndex] ?? '';
  const pool = state.wordSource.wordPool;
  const exclude = usedWords ?? state.turnPassedWords;
  const wordOptions = pickWordOptions(pool, exclude);
  const roundPerformerTeam = state.teams?.enabled
    ? (getPlayerTeam(state, performerId) ?? null)
    : null;

  return {
    ...state,
    phase: 'word_select',
    performerId,
    roundPerformerTeam,
    wordOptions,
    selectedWord: null,
    guesses: [],
    guessedIds: [],
    roundScores: {},
    roundTeamScores: state.teams?.enabled ? { A: 0, B: 0 } : null,
    phaseEndsAt: now + state.wordSelectDurationMs,
    message: `${state.players.find((p) => p.id === performerId)?.name ?? '表演者'} 请选择词语`,
    players: state.players.map((p) => ({ ...p, hasGuessed: false })),
  };
}

export function createActGuessGame(
  participants: GameParticipant[],
  options: ActGuessStartOptions = {},
  now = Date.now(),
): ActGuessGameState {
  const active = participants;
  const wordPool = options.wordPool ?? [];
  const performDurationMs = (options.performDurationSec ?? 60) * 1000;
  const wordSelectDurationMs = (options.wordSelectDurationSec ?? 10) * 1000;

  const activePlayerIds =
    options.allPlayers?.filter((p) => !p.isSpectator).map((p) => p.id) ??
    active.map((p) => p.id);

  const teams: ActGuessTeams | null =
    options.enableTeams && options.teamAssignments
      ? { enabled: true, assignments: options.teamAssignments }
      : null;

  const wordSource: WordSourceSnapshot = {
    categoryIds: options.categoryIds ?? [],
    userPackIds: options.userPackIds ?? [],
    roomExtraWords: options.roomExtraWords ?? [],
    wordPool,
  };

  const players: ActGuessPlayerState[] =
    options.allPlayers?.map((p) => ({
      id: p.id,
      name: p.name,
      hasGuessed: false,
      isSpectator: p.isSpectator,
    })) ??
    participants.map((p) => ({
      id: p.id,
      name: p.name,
      hasGuessed: false,
      isSpectator: false,
    }));

  const performerOrder = buildPerformerOrder(activePlayerIds, teams);
  const scores: Record<string, number> = {};
  for (const id of activePlayerIds) scores[id] = 0;

  const base: ActGuessGameState = {
    phase: 'word_select',
    round: 1,
    performerOrder,
    performerIndex: 0,
    performerId: performerOrder[0] ?? '',
    roundPerformerTeam: null,
    wordOptions: [],
    selectedWord: null,
    phaseEndsAt: now,
    guesses: [],
    guessedIds: [],
    scores,
    roundScores: {},
    teamScores: teams ? { A: 0, B: 0 } : null,
    roundTeamScores: null,
    players,
    activePlayerIds,
    teams,
    message: '游戏开始',
    performDurationMs,
    wordSelectDurationMs,
    wordSource,
    turnPassedWords: [],
  };

  return beginWordSelect(base, now);
}

function startPerforming(state: ActGuessGameState, word: string, now: number): ActGuessGameState {
  return {
    ...state,
    phase: 'performing',
    selectedWord: word,
    wordOptions: [],
    phaseEndsAt: now + state.performDurationMs,
    message: '比划中，请猜词！',
  };
}

export function selectWord(
  state: ActGuessGameState,
  playerId: string,
  word: string,
  now = Date.now(),
): ActGuessGameState {
  if (state.phase !== 'word_select' || playerId !== state.performerId) return state;
  if (!state.wordOptions.includes(word)) return state;
  return startPerforming(state, word, now);
}

function autoSelectWord(state: ActGuessGameState, now: number): ActGuessGameState {
  if (state.wordOptions.length === 0) return state;
  const word = state.wordOptions[Math.floor(Math.random() * state.wordOptions.length)]!;
  return startPerforming(state, word, now);
}

function finishRound(state: ActGuessGameState, now: number, reason: string): ActGuessGameState {
  const word = state.selectedWord ?? state.wordOptions[0] ?? '（未知）';
  return {
    ...state,
    phase: 'round_end',
    selectedWord: word,
    phaseEndsAt: now + ROUND_END_MS,
    message: reason,
  };
}

function advancePerformer(state: ActGuessGameState, now: number): ActGuessGameState {
  const usedWords = state.selectedWord ? [state.selectedWord] : [];
  const nextIndex = state.performerIndex + 1;

  if (nextIndex >= state.performerOrder.length) {
    return {
      ...state,
      phase: 'ended',
      message: '游戏结束！查看最终积分榜',
    };
  }

  const next: ActGuessGameState = {
    ...state,
    performerIndex: nextIndex,
    round: state.round + 1,
    turnPassedWords: [],
  };
  return beginWordSelect(next, now, usedWords);
}

export function tickActGuess(state: ActGuessGameState, now = Date.now()): ActGuessGameState {
  if (state.phase === 'ended') return state;
  if (now < state.phaseEndsAt) return state;

  if (state.phase === 'word_select') {
    return autoSelectWord(state, now);
  }

  if (state.phase === 'performing') {
    return finishRound(state, now, `时间到！答案是：${state.selectedWord ?? '（未知）'}`);
  }

  if (state.phase === 'round_end') {
    return advancePerformer(state, now);
  }

  return state;
}

function applyCorrectGuess(
  state: ActGuessGameState,
  guesserId: string,
): ActGuessGameState {
  const isFirst = state.guessedIds.length === 0;
  const newGuessedIds = [...state.guessedIds, guesserId];
  const player = state.players.find((p) => p.id === guesserId);
  if (!player) return state;

  if (state.teams?.enabled && state.teamScores && state.roundTeamScores) {
    const guesserTeam = getPlayerTeam(state, guesserId);
    const performerTeam = getPlayerTeam(state, state.performerId);
    if (!guesserTeam) return state;

    const points = isFirst ? 10 : 5;
    const teamScores = { ...state.teamScores };
    const roundTeamScores = { ...state.roundTeamScores };
    teamScores[guesserTeam] = (teamScores[guesserTeam] ?? 0) + points;
    roundTeamScores[guesserTeam] = (roundTeamScores[guesserTeam] ?? 0) + points;

    if (isFirst && performerTeam) {
      teamScores[performerTeam] = (teamScores[performerTeam] ?? 0) + 5;
      roundTeamScores[performerTeam] = (roundTeamScores[performerTeam] ?? 0) + 5;
    }

    return {
      ...state,
      guessedIds: newGuessedIds,
      teamScores,
      roundTeamScores,
      players: state.players.map((p) =>
        p.id === guesserId ? { ...p, hasGuessed: true } : p,
      ),
    };
  }

  const roundScores = { ...state.roundScores };
  const scores = { ...state.scores };
  roundScores[guesserId] = (roundScores[guesserId] ?? 0) + (isFirst ? 10 : 5);
  scores[guesserId] = (scores[guesserId] ?? 0) + (isFirst ? 10 : 5);

  if (isFirst) {
    roundScores[state.performerId] = (roundScores[state.performerId] ?? 0) + 5;
    scores[state.performerId] = (scores[state.performerId] ?? 0) + 5;
  }

  return {
    ...state,
    guessedIds: newGuessedIds,
    roundScores,
    scores,
    players: state.players.map((p) =>
      p.id === guesserId ? { ...p, hasGuessed: true } : p,
    ),
  };
}

export function performerPass(
  state: ActGuessGameState,
  playerId: string,
  now = Date.now(),
): ActGuessGameState {
  if (state.phase !== 'performing' || playerId !== state.performerId) return state;

  const turnPassedWords = state.selectedWord
    ? [...state.turnPassedWords, state.selectedWord]
    : state.turnPassedWords;

  return beginWordSelect(
    { ...state, turnPassedWords },
    now,
  );
}

export function performerConfirmCorrect(
  state: ActGuessGameState,
  performerId: string,
  guesserId: string,
  now = Date.now(),
): ActGuessGameState {
  if (state.phase !== 'performing' || performerId !== state.performerId) return state;
  if (!canPlayerGuess(state, guesserId)) return state;
  if (!state.selectedWord) return state;

  const player = state.players.find((p) => p.id === guesserId);
  if (!player) return state;

  const scored = applyCorrectGuess(state, guesserId);
  const entry: GuessEntry = {
    id: nextGuessId(),
    playerId: guesserId,
    playerName: player.name,
    text: '（表演者确认）',
    correct: true,
    timestamp: now,
  };

  const next: ActGuessGameState = {
    ...scored,
    guesses: [...state.guesses, entry],
  };

  return finishRound(
    next,
    now,
    `表演者确认 ${player.name} 猜中！答案是：${state.selectedWord}`,
  );
}

export function submitGuess(
  state: ActGuessGameState,
  playerId: string,
  text: string,
  now = Date.now(),
): ActGuessGameState {
  if (!canPlayerGuess(state, playerId)) return state;
  if (!state.selectedWord) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  const entry: GuessEntry = {
    id: nextGuessId(),
    playerId,
    playerName: player.name,
    text: text.trim(),
    correct: false,
    timestamp: now,
  };

  return {
    ...state,
    guesses: [...state.guesses, entry],
    message: `${player.name} 提交了猜词`,
  };
}

export function redactActGuessState(
  state: ActGuessGameState,
  viewerId: string | null,
): ActGuessGameState {
  const revealAnswer = state.phase === 'round_end' || state.phase === 'ended';
  const canSee = revealAnswer || canPlayerSeeWord(state, viewerId);

  let wordOptions = state.wordOptions;
  let selectedWord = state.selectedWord;

  if (!revealAnswer) {
    if (viewerId === state.performerId && state.phase === 'word_select') {
      // performer sees options
    } else if (canSee && state.phase === 'performing') {
      wordOptions = [];
    } else {
      wordOptions = [];
      selectedWord = null;
    }
  }

  const guesses = state.guesses;

  return {
    ...state,
    wordOptions,
    selectedWord: revealAnswer || canSee ? state.selectedWord : selectedWord,
    guesses: revealAnswer
      ? guesses
      : guesses.map((g) => (g.correct ? { ...g, text: '（已猜中）' } : g)),
  };
}
