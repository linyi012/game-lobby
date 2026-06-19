export { scriptMurderModule } from './module.js';
export type { ScriptMurderStartOptions } from './module.js';
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
