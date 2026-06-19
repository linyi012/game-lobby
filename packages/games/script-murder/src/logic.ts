import { shuffle } from '@game-lobby/game-core';
import type { GameParticipant } from '@game-lobby/game-core';
import type {
  MurderScriptContent,
  ScriptAct,
  ScriptPhaseType,
} from '@game-lobby/script-murder-scripts';
import { matchPlayerCount } from '@game-lobby/script-murder-scripts';

export type { ScriptPhaseType } from '@game-lobby/script-murder-scripts';

export interface SpeechMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  act: number;
}

export interface ScriptMurderPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  characterId: string;
  characterName: string;
  isAlive: boolean;
}

export interface ScriptMurderGameState {
  phase: ScriptPhaseType | 'ended';
  scriptId: string;
  scriptTitle: string;
  hostMemberId: string;
  currentActIndex: number;
  currentPhaseIndex: number;
  script: MurderScriptContent;
  players: ScriptMurderPlayerState[];
  speeches: SpeechMessage[];
  votes: Record<string, string>;
  revealedClueIds: string[];
  discoveredClueIds: Record<string, string[]>;
  hostPaused: boolean;
  phaseDeadline: number | null;
  message: string;
  awaitingContinue: boolean;
}

export interface ScriptMurderStartOptions {
  scriptId: string;
  scriptTitle: string;
  script: MurderScriptContent;
  hostMemberId: string;
}

const DEFAULT_AUTO_SEC = 120;

function sortedActs(script: MurderScriptContent): ScriptAct[] {
  return [...script.acts].sort((a, b) => a.order - b.order);
}

function currentAct(state: ScriptMurderGameState): ScriptAct | null {
  const acts = sortedActs(state.script);
  return acts[state.currentActIndex] ?? null;
}

function currentPhaseType(state: ScriptMurderGameState): ScriptPhaseType | 'ended' {
  if (state.phase === 'ended') return 'ended';
  const act = currentAct(state);
  if (!act) return 'ended';
  return act.phases[state.currentPhaseIndex] ?? 'ended';
}

function phaseAutoSec(state: ScriptMurderGameState): number {
  const act = currentAct(state);
  return act?.autoAdvanceSec ?? DEFAULT_AUTO_SEC;
}

function withDeadline(state: ScriptMurderGameState, now: number): ScriptMurderGameState {
  if (state.phase === 'ended' || state.hostPaused || state.awaitingContinue) {
    return { ...state, phaseDeadline: null };
  }
  return { ...state, phaseDeadline: now + phaseAutoSec(state) * 1000 };
}

function resetPhaseData(state: ScriptMurderGameState): ScriptMurderGameState {
  return {
    ...state,
    votes: {},
    speeches: state.speeches,
    awaitingContinue: false,
  };
}

function advanceToNextPhase(state: ScriptMurderGameState, now: number): ScriptMurderGameState {
  const acts = sortedActs(state.script);
  const act = acts[state.currentActIndex];
  if (!act) {
    return { ...state, phase: 'ended', message: '剧本已结束', phaseDeadline: null };
  }

  const nextPhaseIndex = state.currentPhaseIndex + 1;
  if (nextPhaseIndex < act.phases.length) {
    const phase = act.phases[nextPhaseIndex]!;
    const next = resetPhaseData({
      ...state,
      currentPhaseIndex: nextPhaseIndex,
      phase,
      message: phaseMessage(phase, act.title),
    });
    return withDeadline(phase === 'reveal' ? enterRevealAwait(next) : next, now);
  }

  const nextActIndex = state.currentActIndex + 1;
  if (nextActIndex >= acts.length) {
    return {
      ...state,
      phase: 'ended',
      message: '全部幕次已完成，游戏结束',
      phaseDeadline: null,
      awaitingContinue: false,
    };
  }

  const nextAct = acts[nextActIndex]!;
  const phase = nextAct.phases[0]!;
  const next = resetPhaseData({
    ...state,
    currentActIndex: nextActIndex,
    currentPhaseIndex: 0,
    phase,
    message: phaseMessage(phase, nextAct.title),
  });
  return withDeadline(phase === 'reveal' ? enterRevealAwait(next) : next, now);
}

function phaseMessage(phase: ScriptPhaseType, actTitle: string): string {
  switch (phase) {
    case 'intro':
      return `${actTitle} · 序幕`;
    case 'reading':
      return `${actTitle} · 阅读角色本`;
    case 'discussion':
      return `${actTitle} · 自由讨论`;
    case 'search':
      return `${actTitle} · 搜证阶段`;
    case 'vote':
      return `${actTitle} · 投票指认`;
    case 'reveal':
      return `${actTitle} · 揭晓阶段`;
    default:
      return actTitle;
  }
}

export function createScriptMurderGame(
  participants: GameParticipant[],
  options: ScriptMurderStartOptions,
): ScriptMurderGameState {
  const { script, scriptId, scriptTitle, hostMemberId } = options;
  if (!matchPlayerCount(script, participants.length)) {
    throw new Error(
      `玩家人数（${participants.length}）须与角色数（${script.characters.length}）一致`,
    );
  }

  const shuffledChars = shuffle([...script.characters]);
  const now = Date.now();
  const acts = sortedActs(script);
  const firstAct = acts[0]!;
  const firstPhase = firstAct.phases[0]!;

  const players: ScriptMurderPlayerState[] = participants.map((p, i) => {
    const char = shuffledChars[i]!;
    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      characterId: char.id,
      characterName: char.name,
      isAlive: true,
    };
  });

  const base: ScriptMurderGameState = {
    phase: firstPhase,
    scriptId,
    scriptTitle,
    hostMemberId,
    currentActIndex: 0,
    currentPhaseIndex: 0,
    script,
    players,
    speeches: [],
    votes: {},
    revealedClueIds: [],
    discoveredClueIds: {},
    hostPaused: false,
    phaseDeadline: null,
    message: phaseMessage(firstPhase, firstAct.title),
    awaitingContinue: false,
  };

  return withDeadline(
    firstPhase === 'reveal' ? enterRevealAwait(base) : base,
    now,
  );
}

export function advancePhaseOnTimeout(
  state: ScriptMurderGameState,
  now: number,
): ScriptMurderGameState {
  if (state.phase === 'ended' || state.hostPaused || state.awaitingContinue) return state;
  if (state.phaseDeadline == null || now < state.phaseDeadline) return state;
  return advanceToNextPhase(state, now);
}

export function hostAdvancePhase(
  state: ScriptMurderGameState,
  hostMemberId: string,
  now: number,
): ScriptMurderGameState {
  if (hostMemberId !== state.hostMemberId) return state;
  if (state.phase === 'ended') return state;
  if (state.awaitingContinue) {
    return advanceToNextPhase({ ...state, awaitingContinue: false }, now);
  }
  return advanceToNextPhase(state, now);
}

export function hostPause(
  state: ScriptMurderGameState,
  hostMemberId: string,
  paused: boolean,
): ScriptMurderGameState {
  if (hostMemberId !== state.hostMemberId) return state;
  return {
    ...state,
    hostPaused: paused,
    phaseDeadline: paused ? null : state.phaseDeadline,
  };
}

export function hostRevealClue(
  state: ScriptMurderGameState,
  hostMemberId: string,
  clueId: string,
): ScriptMurderGameState {
  if (hostMemberId !== state.hostMemberId) return state;
  if (state.revealedClueIds.includes(clueId)) return state;
  const clue = state.script.clues.find((c) => c.id === clueId);
  if (!clue) return state;
  const act = currentAct(state);
  if (!act || clue.revealAct > act.order) return state;
  return {
    ...state,
    revealedClueIds: [...state.revealedClueIds, clueId],
    message: `主持人公开线索：${clue.title}`,
  };
}

export function hostJumpAct(
  state: ScriptMurderGameState,
  hostMemberId: string,
  actIndex: number,
  now: number,
): ScriptMurderGameState {
  if (hostMemberId !== state.hostMemberId) return state;
  const acts = sortedActs(state.script);
  if (actIndex < 0 || actIndex >= acts.length) return state;
  const act = acts[actIndex]!;
  const phase = act.phases[0]!;
  return withDeadline(
    resetPhaseData({
      ...state,
      currentActIndex: actIndex,
      currentPhaseIndex: 0,
      phase,
      message: `主持人跳至 ${act.title}`,
      awaitingContinue: false,
    }),
    now,
  );
}

export function sendSpeech(
  state: ScriptMurderGameState,
  playerId: string,
  text: string,
): ScriptMurderGameState {
  if (state.phase !== 'discussion') return state;
  const player = state.players.find((p) => p.id === playerId && p.isAlive);
  if (!player) return state;
  const act = currentAct(state);
  const speech: SpeechMessage = {
    id: `${Date.now()}-${playerId}`,
    playerId,
    playerName: player.name,
    text: text.trim(),
    act: act?.order ?? 1,
  };
  if (!speech.text) return state;
  return { ...state, speeches: [...state.speeches, speech] };
}

export function submitVote(
  state: ScriptMurderGameState,
  playerId: string,
  targetId: string,
): ScriptMurderGameState {
  if (state.phase !== 'vote') return state;
  const voter = state.players.find((p) => p.id === playerId && p.isAlive);
  const target = state.players.find((p) => p.id === targetId && p.isAlive);
  if (!voter || !target || playerId === targetId) return state;
  if (state.votes[playerId]) return state;
  return { ...state, votes: { ...state.votes, [playerId]: targetId } };
}

export function discoverClue(
  state: ScriptMurderGameState,
  playerId: string,
  clueId: string,
): ScriptMurderGameState {
  if (state.phase !== 'search') return state;
  const player = state.players.find((p) => p.id === playerId && p.isAlive);
  if (!player) return state;
  const clue = state.script.clues.find((c) => c.id === clueId);
  if (!clue || clue.visibility !== 'search') return state;
  const act = currentAct(state);
  if (!act || clue.revealAct > act.order) return state;

  const existing = state.discoveredClueIds[playerId] ?? [];
  if (existing.includes(clueId)) return state;

  const discovered = { ...state.discoveredClueIds, [playerId]: [...existing, clueId] };
  const revealed = state.revealedClueIds.includes(clueId)
    ? state.revealedClueIds
    : [...state.revealedClueIds, clueId];

  return {
    ...state,
    discoveredClueIds: discovered,
    revealedClueIds: revealed,
    message: `${player.name} 发现了线索：${clue.title}`,
  };
}

export function advanceFromReveal(
  state: ScriptMurderGameState,
  now: number,
): ScriptMurderGameState {
  if (state.phase !== 'reveal' || !state.awaitingContinue) return state;
  return advanceToNextPhase({ ...state, awaitingContinue: false }, now);
}

export function enterRevealAwait(state: ScriptMurderGameState): ScriptMurderGameState {
  if (state.phase !== 'reveal') return state;
  return { ...state, awaitingContinue: true, phaseDeadline: null };
}

export function onEnterPhase(state: ScriptMurderGameState): ScriptMurderGameState {
  if (state.phase === 'reveal') {
    return enterRevealAwait(state);
  }
  return state;
}

export function redactScriptMurderState(
  state: ScriptMurderGameState,
  viewerId: string | null,
): ScriptMurderGameState {
  const isHost = viewerId === state.hostMemberId;
  const myPlayer = viewerId ? state.players.find((p) => p.id === viewerId) : null;
  const myCharacterId = myPlayer?.characterId;

  const visibleClueIds = new Set(state.revealedClueIds);
  if (myCharacterId) {
    for (const clue of state.script.clues) {
      if (clue.visibility === 'character' && clue.characterId === myCharacterId) {
        visibleClueIds.add(clue.id);
      }
    }
  }
  if (viewerId && state.discoveredClueIds[viewerId]) {
    for (const id of state.discoveredClueIds[viewerId]!) {
      visibleClueIds.add(id);
    }
  }

  const redactedScript: MurderScriptContent = {
    acts: state.script.acts.map((a) => ({
      ...a,
      publicText: a.publicText,
    })),
    characters: state.script.characters.map((c) => {
      if (isHost || c.id === myCharacterId) return c;
      return {
        id: c.id,
        name: c.name,
        publicProfile: c.publicProfile,
        privateScript: '',
        objectives: '',
      };
    }),
    clues: state.script.clues.map((c) => {
      if (isHost || visibleClueIds.has(c.id)) return c;
      return {
        ...c,
        content: '（尚未公开）',
      };
    }),
  };

  return {
    ...state,
    script: redactedScript,
    phase: currentPhaseType(state),
  };
}

export function getVisibleClues(state: ScriptMurderGameState, viewerId: string | null) {
  const redacted = redactScriptMurderState(state, viewerId);
  return redacted.script.clues.filter((c) => c.content !== '（尚未公开）');
}

export function isScriptMurderEnded(state: ScriptMurderGameState): boolean {
  return state.phase === 'ended';
}
