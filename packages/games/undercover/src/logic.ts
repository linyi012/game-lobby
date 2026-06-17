import { pickRandom } from '@game-lobby/game-core';
import type { WordPair } from '@game-lobby/word-pairs';

export type UndercoverPhase = 'describe' | 'vote' | 'reveal' | 'ended';

export type EliminatedRole = 'undercover' | 'civilian' | 'whiteboard';

export interface SpeechMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  round: number;
}

export interface UndercoverPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  isAlive: boolean;
  word: string | null;
  isUndercover: boolean;
  isWhiteBoard: boolean;
  description: string | null;
}

export interface PairSourceSnapshot {
  categoryIds: string[];
  userPairPackIds: string[];
  roomExtraPairs: WordPair[];
}

export interface UndercoverGameState {
  phase: UndercoverPhase;
  round: number;
  civilianWord: string;
  undercoverWord: string;
  pairSource: PairSourceSnapshot;
  players: UndercoverPlayerState[];
  currentSpeakerIndex: number;
  speeches: SpeechMessage[];
  votes: Record<string, string>;
  lastEliminated: { id: string; name: string; role: EliminatedRole } | null;
  gameContinues: boolean | null;
  winner: 'civilian' | 'undercover' | 'whiteboard' | null;
  message: string;
}

export interface UndercoverStartOptions {
  pairPool: WordPair[];
  categoryIds: string[];
  userPairPackIds: string[];
  roomExtraPairs: WordPair[];
}

function playerRole(player: UndercoverPlayerState): EliminatedRole {
  if (player.isUndercover) return 'undercover';
  if (player.isWhiteBoard) return 'whiteboard';
  return 'civilian';
}

function roleLabel(role: EliminatedRole): string {
  if (role === 'undercover') return '卧底';
  if (role === 'whiteboard') return '白板';
  return '平民';
}

function containsOwnWord(text: string, word: string | null): boolean {
  if (!word) return false;
  return text.toLowerCase().includes(word.toLowerCase());
}

function alivePlayers(state: UndercoverGameState): UndercoverPlayerState[] {
  return state.players.filter((p) => p.isAlive);
}

function currentSpeaker(state: UndercoverGameState): UndercoverPlayerState | undefined {
  const alive = alivePlayers(state);
  return alive[state.currentSpeakerIndex];
}

function nextSpeechId(state: UndercoverGameState, playerId: string): string {
  return `${state.round}-${playerId}-${state.speeches.length}`;
}

export function createUndercoverGame(
  playerIds: { id: string; name: string; isBot: boolean }[],
  pair: WordPair,
  pairSource: PairSourceSnapshot,
): UndercoverGameState {
  const [civilianWord, undercoverWord] = pair;
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const undercoverIndex = Math.floor(Math.random() * shuffled.length);
  const whiteBoardIndex =
    shuffled.length >= 6
      ? (undercoverIndex + 1 + Math.floor(Math.random() * (shuffled.length - 1))) % shuffled.length
      : -1;

  const players: UndercoverPlayerState[] = shuffled.map((p, i) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    isAlive: true,
    word:
      i === undercoverIndex
        ? undercoverWord
        : i === whiteBoardIndex
          ? null
          : civilianWord,
    isUndercover: i === undercoverIndex,
    isWhiteBoard: i === whiteBoardIndex,
    description: null,
  }));

  const firstSpeaker = players.filter((p) => p.isAlive)[0];

  return {
    phase: 'describe',
    round: 1,
    civilianWord,
    undercoverWord,
    pairSource,
    players,
    currentSpeakerIndex: 0,
    speeches: [],
    votes: {},
    lastEliminated: null,
    gameContinues: null,
    winner: null,
    message: firstSpeaker
      ? `请按顺序描述你的词语，不要直接说出词语本身。轮到 ${firstSpeaker.name} 发言。`
      : '请按顺序描述你的词语，不要直接说出词语本身。',
  };
}

export function sendUndercoverSpeech(
  state: UndercoverGameState,
  playerId: string,
  text: string,
): UndercoverGameState {
  const trimmed = text.trim();
  if (!trimmed || state.phase !== 'describe') return state;

  const speaker = currentSpeaker(state);
  if (!speaker || speaker.id !== playerId) return state;
  if (containsOwnWord(trimmed, speaker.word)) {
    return { ...state, message: '描述中不能包含你的词语本身。' };
  }

  const message: SpeechMessage = {
    id: nextSpeechId(state, playerId),
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

export function endUndercoverSpeaking(
  state: UndercoverGameState,
  playerId: string,
): UndercoverGameState {
  if (state.phase !== 'describe') return state;

  const speaker = currentSpeaker(state);
  if (!speaker || speaker.id !== playerId) return state;

  const roundSpeeches = state.speeches.filter(
    (s) => s.round === state.round && s.playerId === playerId,
  );
  const description =
    roundSpeeches.length > 0 ? roundSpeeches.map((s) => s.text).join('；') : '（跳过发言）';

  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, description } : p,
  );
  const alive = updatedPlayers.filter((p) => p.isAlive);
  const nextIndex = state.currentSpeakerIndex + 1;

  if (nextIndex >= alive.length) {
    return {
      ...state,
      players: updatedPlayers,
      phase: 'vote',
      currentSpeakerIndex: 0,
      votes: {},
      message: '描述结束，请投票选出你认为的卧底。',
    };
  }

  const nextSpeaker = alive[nextIndex]!;
  return {
    ...state,
    players: updatedPlayers,
    currentSpeakerIndex: nextIndex,
    message: `轮到 ${nextSpeaker.name} 发言。`,
  };
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

function beginReveal(
  state: UndercoverGameState,
  updates: Partial<UndercoverGameState>,
): UndercoverGameState {
  return {
    ...state,
    ...updates,
    phase: 'reveal',
    votes: {},
  };
}

export function submitUndercoverVote(
  state: UndercoverGameState,
  voterId: string,
  targetId: string,
): UndercoverGameState {
  if (state.phase !== 'vote') return state;
  const voter = state.players.find((p) => p.id === voterId && p.isAlive);
  if (!voter) return state;

  const votes = { ...state.votes, [voterId]: targetId };
  const alive = alivePlayers(state);
  if (Object.keys(votes).length < alive.length) {
    return { ...state, votes, message: '等待其他玩家投票…' };
  }

  const tally = resolveVoteTally(votes);
  const tiedIds = topVotedIds(tally);

  if (tiedIds.length > 1) {
    const names = tiedIds
      .map((id) => state.players.find((p) => p.id === id)?.name ?? id)
      .join('、');
    return beginReveal(state, {
      lastEliminated: null,
      gameContinues: true,
      message: `投票平票（${names}），本轮无人淘汰，即将进入下一轮。`,
    });
  }

  const eliminatedId = tiedIds[0];
  if (!eliminatedId) return state;

  const eliminated = state.players.find((p) => p.id === eliminatedId)!;
  const role = playerRole(eliminated);
  const updatedPlayers = state.players.map((p) =>
    p.id === eliminatedId ? { ...p, isAlive: false } : p,
  );

  const aliveAfter = updatedPlayers.filter((p) => p.isAlive);
  const undercoverAlive = aliveAfter.some((p) => p.isUndercover);
  const civilianAlive = aliveAfter.filter((p) => !p.isUndercover && !p.isWhiteBoard).length;
  const undercoverCount = aliveAfter.filter((p) => p.isUndercover).length;

  if (!undercoverAlive) {
    return beginReveal(state, {
      players: updatedPlayers,
      lastEliminated: { id: eliminated.id, name: eliminated.name, role },
      gameContinues: false,
      winner: 'civilian',
      message: `卧底 ${eliminated.name} 被投出，平民胜利！`,
    });
  }

  if (undercoverCount >= civilianAlive) {
    return beginReveal(state, {
      players: updatedPlayers,
      lastEliminated: { id: eliminated.id, name: eliminated.name, role },
      gameContinues: false,
      winner: 'undercover',
      message: '卧底人数占优，卧底胜利！',
    });
  }

  if (eliminated.isWhiteBoard) {
    return beginReveal(state, {
      players: updatedPlayers,
      lastEliminated: { id: eliminated.id, name: eliminated.name, role },
      gameContinues: false,
      winner: 'whiteboard',
      message: `白板 ${eliminated.name} 被误投，白板单独胜利！`,
    });
  }

  return beginReveal(state, {
    players: updatedPlayers,
    lastEliminated: { id: eliminated.id, name: eliminated.name, role },
    gameContinues: true,
    winner: null,
    message: `${eliminated.name}（${roleLabel(role)}）被淘汰，游戏继续。`,
  });
}

export function advanceFromReveal(state: UndercoverGameState): UndercoverGameState {
  if (state.phase !== 'reveal') return state;

  if (!state.gameContinues) {
    return { ...state, phase: 'ended' };
  }

  const alive = state.players.filter((p) => p.isAlive);
  const firstSpeaker = alive[0];

  return {
    ...state,
    phase: 'describe',
    round: state.round + 1,
    currentSpeakerIndex: 0,
    votes: {},
    lastEliminated: null,
    gameContinues: null,
    players: state.players.map((p) => ({ ...p, description: null })),
    message: firstSpeaker
      ? `进入第 ${state.round + 1} 轮描述，轮到 ${firstSpeaker.name} 发言。`
      : `进入第 ${state.round + 1} 轮描述。`,
  };
}

export function redactUndercoverState(
  state: UndercoverGameState,
  viewerId: string | null,
): UndercoverGameState {
  const isEnded = state.phase === 'ended';
  const isReveal = state.phase === 'reveal';

  const players = state.players.map((p) => {
    const isSelf = viewerId != null && p.id === viewerId;
    const revealedInReveal =
      isReveal && state.lastEliminated != null && state.lastEliminated.id === p.id;
    const showRole = isEnded || revealedInReveal || (!p.isAlive && (isReveal || isEnded));

    return {
      ...p,
      word: isSelf ? p.word : null,
      isUndercover: showRole ? p.isUndercover : false,
      isWhiteBoard: isSelf || showRole ? p.isWhiteBoard : false,
    };
  });

  return {
    ...state,
    civilianWord: isEnded ? state.civilianWord : '',
    undercoverWord: isEnded ? state.undercoverWord : '',
    players,
  };
}

export function pickPairFromPool(pool: WordPair[]): WordPair {
  return pickRandom(pool.length > 0 ? pool : [['苹果', '梨']]);
}
