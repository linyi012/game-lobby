import type { GameModule } from '@game-lobby/game-core';
import {
  advanceFromReveal,
  advancePhaseOnTimeout,
  createScriptMurderGame,
  hostAdvancePhase,
  hostJumpAct,
  hostPause,
  hostRevealClue,
  isScriptMurderEnded,
  redactScriptMurderState,
  type ScriptMurderGameState,
  type ScriptMurderStartOptions,
} from './logic.js';

export type { ScriptMurderStartOptions } from './logic.js';

export const scriptMurderModule: GameModule<
  ScriptMurderGameState,
  ScriptMurderStartOptions
> = {
  gameType: 'script_murder',

  create(participants, options) {
    return createScriptMurderGame(participants, options);
  },

  isEnded(state) {
    return isScriptMurderEnded(state);
  },

  projectState(state, viewerId) {
    return redactScriptMurderState(state, viewerId);
  },

  insufficientPlayersHint() {
    return '请确保玩家人数与剧本角色数一致，并在大厅选择合适人数的剧本。';
  },

  canAddBot() {
    return { ok: false as const, message: '剧本杀不支持电脑玩家' };
  },
};

export {
  advanceFromReveal,
  advancePhaseOnTimeout,
  createScriptMurderGame,
  discoverClue,
  getVisibleClues,
  hostAdvancePhase,
  hostJumpAct,
  hostPause,
  hostRevealClue,
  isScriptMurderEnded,
  redactScriptMurderState,
  sendSpeech,
  submitVote,
  type ScriptMurderGameState,
  type ScriptMurderPlayerState,
  type SpeechMessage,
  type ScriptPhaseType,
} from './logic.js';
