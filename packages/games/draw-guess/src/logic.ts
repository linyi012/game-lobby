import type { GameParticipant } from '@game-lobby/game-core';

export type DrawGuessPhase = 'word_select' | 'drawing' | 'round_end' | 'ended';

export interface DrawStroke {
  id: string;
  points: number[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
}

export interface GuessEntry {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  correct: boolean;
  timestamp: number;
}

export interface DrawGuessPlayerState {
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

export interface DrawGuessStartOptions {
  categoryIds?: string[];
  userPackIds?: string[];
  roomExtraWords?: string[];
  drawDurationSec?: number;
  wordSelectDurationSec?: number;
  wordPool?: string[];
  allPlayers?: { id: string; name: string; isSpectator: boolean }[];
}

export interface DrawGuessGameState {
  phase: DrawGuessPhase;
  round: number;
  painterOrder: string[];
  painterIndex: number;
  painterId: string;
  wordOptions: string[];
  selectedWord: string | null;
  phaseEndsAt: number;
  strokes: DrawStroke[];
  guesses: GuessEntry[];
  guessedIds: string[];
  scores: Record<string, number>;
  roundScores: Record<string, number>;
  players: DrawGuessPlayerState[];
  activePlayerIds: string[];
  message: string;
  drawDurationMs: number;
  wordSelectDurationMs: number;
  wordSource: WordSourceSnapshot;
  wordHint: string;
}

const ROUND_END_MS = 5000;
let guessIdCounter = 0;

function buildWordHint(word: string | null): string {
  if (!word) return '';
  return [...word].map(() => '_').join(' ');
}

function isGuessMatch(guess: string, answer: string): boolean {
  return guess.trim() === answer.trim();
}

function pickRandomWords(pool: string[], count: number, exclude: string[] = []): string[] {
  const excludeSet = new Set(exclude);
  const available = pool.filter((w) => !excludeSet.has(w));
  if (available.length === 0) return [];
  const shuffled = shuffle(available);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

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

function activeGuessers(state: DrawGuessGameState): string[] {
  return state.activePlayerIds.filter((id) => id !== state.painterId);
}

function allGuessersDone(state: DrawGuessGameState): boolean {
  const guessers = activeGuessers(state);
  return guessers.every((id) => state.guessedIds.includes(id));
}

function pickWordOptions(pool: string[], usedWords: string[]): string[] {
  const options = pickRandomWords(pool, 3, usedWords);
  if (options.length > 0) return options;
  return pickRandomWords(pool, 3);
}

function beginWordSelect(
  state: DrawGuessGameState,
  now: number,
  usedWords: string[],
): DrawGuessGameState {
  const painterId = state.painterOrder[state.painterIndex];
  const pool = state.wordSource.wordPool;
  const wordOptions = pickWordOptions(pool, usedWords);

  return {
    ...state,
    phase: 'word_select',
    painterId,
    wordOptions,
    selectedWord: null,
    strokes: [],
    guesses: [],
    guessedIds: [],
    roundScores: {},
    wordHint: '',
    phaseEndsAt: now + state.wordSelectDurationMs,
    message: `${state.players.find((p) => p.id === painterId)?.name ?? '画家'} 请选择词语`,
    players: state.players.map((p) => ({ ...p, hasGuessed: false })),
  };
}

export function createDrawGuessGame(
  participants: GameParticipant[],
  options: DrawGuessStartOptions = {},
  now = Date.now(),
): DrawGuessGameState {
  const active = participants;
  const wordPool = options.wordPool ?? [];
  const drawDurationMs = (options.drawDurationSec ?? 90) * 1000;
  const wordSelectDurationMs = (options.wordSelectDurationSec ?? 10) * 1000;

  const activePlayerIds =
    options.allPlayers?.filter((p) => !p.isSpectator).map((p) => p.id) ??
    active.map((p) => p.id);

  const wordSource: WordSourceSnapshot = {
    categoryIds: options.categoryIds ?? [],
    userPackIds: options.userPackIds ?? [],
    roomExtraWords: options.roomExtraWords ?? [],
    wordPool,
  };

  const players: DrawGuessPlayerState[] =
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

  const painterOrder = shuffle(activePlayerIds);
  const scores: Record<string, number> = {};
  for (const id of activePlayerIds) scores[id] = 0;

  const base: DrawGuessGameState = {
    phase: 'word_select',
    round: 1,
    painterOrder,
    painterIndex: 0,
    painterId: painterOrder[0] ?? '',
    wordOptions: [],
    selectedWord: null,
    phaseEndsAt: now,
    strokes: [],
    guesses: [],
    guessedIds: [],
    scores,
    roundScores: {},
    players,
    activePlayerIds,
    message: '游戏开始',
    drawDurationMs,
    wordSelectDurationMs,
    wordSource,
    wordHint: '',
  };

  return beginWordSelect(base, now, []);
}

function startDrawing(state: DrawGuessGameState, word: string, now: number): DrawGuessGameState {
  return {
    ...state,
    phase: 'drawing',
    selectedWord: word,
    wordOptions: [],
    wordHint: buildWordHint(word),
    strokes: [],
    phaseEndsAt: now + state.drawDurationMs,
    message: '作画中，猜家们请猜词！',
  };
}

export function selectWord(
  state: DrawGuessGameState,
  playerId: string,
  word: string,
  now = Date.now(),
): DrawGuessGameState {
  if (state.phase !== 'word_select' || playerId !== state.painterId) return state;
  if (!state.wordOptions.includes(word)) return state;
  return startDrawing(state, word, now);
}

function autoSelectWord(state: DrawGuessGameState, now: number): DrawGuessGameState {
  if (state.wordOptions.length === 0) return state;
  const word = state.wordOptions[Math.floor(Math.random() * state.wordOptions.length)]!;
  return startDrawing(state, word, now);
}

function finishRound(state: DrawGuessGameState, now: number, reason: string): DrawGuessGameState {
  const word = state.selectedWord ?? state.wordOptions[0] ?? '（未知）';
  return {
    ...state,
    phase: 'round_end',
    selectedWord: word,
    wordHint: buildWordHint(word),
    phaseEndsAt: now + ROUND_END_MS,
    message: reason,
  };
}

function advancePainter(state: DrawGuessGameState, now: number): DrawGuessGameState {
  const usedWords = state.selectedWord ? [state.selectedWord] : [];
  const nextIndex = state.painterIndex + 1;

  if (nextIndex >= state.painterOrder.length) {
    return {
      ...state,
      phase: 'ended',
      message: '游戏结束！查看最终积分榜',
      wordHint: state.selectedWord ? buildWordHint(state.selectedWord) : '',
    };
  }

  const next: DrawGuessGameState = {
    ...state,
    painterIndex: nextIndex,
    round: state.round + 1,
  };
  return beginWordSelect(next, now, usedWords);
}

export function tickDrawGuess(state: DrawGuessGameState, now = Date.now()): DrawGuessGameState {
  if (state.phase === 'ended') return state;
  if (now < state.phaseEndsAt) return state;

  if (state.phase === 'word_select') {
    return autoSelectWord(state, now);
  }

  if (state.phase === 'drawing') {
    return finishRound(state, now, `时间到！答案是：${state.selectedWord ?? '（未知）'}`);
  }

  if (state.phase === 'round_end') {
    return advancePainter(state, now);
  }

  return state;
}

export function appendStrokes(
  state: DrawGuessGameState,
  playerId: string,
  strokes: DrawStroke[],
): DrawGuessGameState {
  if (state.phase !== 'drawing' || playerId !== state.painterId) return state;
  if (strokes.length === 0) return state;
  return {
    ...state,
    strokes: [...state.strokes, ...strokes],
  };
}

export function clearCanvas(state: DrawGuessGameState, playerId: string): DrawGuessGameState {
  if (state.phase !== 'drawing' || playerId !== state.painterId) return state;
  return { ...state, strokes: [] };
}

export function submitGuess(
  state: DrawGuessGameState,
  playerId: string,
  text: string,
  now = Date.now(),
): DrawGuessGameState {
  if (state.phase !== 'drawing') return state;
  if (playerId === state.painterId) return state;
  if (!state.activePlayerIds.includes(playerId)) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.isSpectator) return state;
  if (state.guessedIds.includes(playerId)) return state;
  if (!state.selectedWord) return state;

  const correct = isGuessMatch(text, state.selectedWord);
  const entry: GuessEntry = {
    id: nextGuessId(),
    playerId,
    playerName: player.name,
    text: text.trim(),
    correct,
    timestamp: now,
  };

  let next: DrawGuessGameState = {
    ...state,
    guesses: [...state.guesses, entry],
  };

  if (!correct) {
    return { ...next, message: `${player.name} 猜错了` };
  }

  const isFirst = state.guessedIds.length === 0;
  const newGuessedIds = [...state.guessedIds, playerId];
  const roundScores = { ...state.roundScores };
  const scores = { ...state.scores };

  roundScores[playerId] = (roundScores[playerId] ?? 0) + (isFirst ? 10 : 5);
  scores[playerId] = (scores[playerId] ?? 0) + (isFirst ? 10 : 5);

  if (isFirst) {
    roundScores[state.painterId] = (roundScores[state.painterId] ?? 0) + 5;
    scores[state.painterId] = (scores[state.painterId] ?? 0) + 5;
  }

  next = {
    ...next,
    guessedIds: newGuessedIds,
    roundScores,
    scores,
    players: next.players.map((p) =>
      p.id === playerId ? { ...p, hasGuessed: true } : p,
    ),
    message: isFirst
      ? `${player.name} 第一个猜中！+10 分`
      : `${player.name} 猜中了！+5 分`,
  };

  if (allGuessersDone(next)) {
    return finishRound(next, now, `全员猜中！答案是：${state.selectedWord}`);
  }

  return next;
}

export function redactDrawGuessState(
  state: DrawGuessGameState,
  viewerId: string | null,
): DrawGuessGameState {
  const viewer = viewerId ? state.players.find((p) => p.id === viewerId) : null;
  const isPainter = viewerId === state.painterId;
  const viewerHasGuessed = viewerId != null && state.guessedIds.includes(viewerId);
  const revealAnswer = state.phase === 'round_end' || state.phase === 'ended';
  const isSpectator = viewer?.isSpectator ?? false;

  let wordOptions = state.wordOptions;
  let selectedWord = state.selectedWord;
  let wordHint = state.wordHint;

  if (!revealAnswer) {
    if (isPainter && state.phase === 'word_select') {
      // painter sees options
    } else if (isPainter && state.phase === 'drawing') {
      wordOptions = [];
    } else {
      wordOptions = [];
      selectedWord = null;
      wordHint = state.selectedWord ? buildWordHint(state.selectedWord) : state.wordHint;
    }
  }

  // Everyone should know *who* has guessed correctly, but the final answer must
  // not be leaked before round_end. So we keep the entries, but mask text.
  const guesses = state.guesses;

  return {
    ...state,
    wordOptions,
    selectedWord: revealAnswer || (isPainter && state.phase !== 'word_select') ? state.selectedWord : selectedWord,
    wordHint,
    guesses: revealAnswer
      ? guesses
      : guesses.map((g) => (g.correct ? { ...g, text: '（已猜中）' } : g)),
  };
}
