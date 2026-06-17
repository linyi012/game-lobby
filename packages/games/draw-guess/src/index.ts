export {
  createDrawGuessGame,
  selectWord,
  tickDrawGuess,
  appendStrokes,
  clearCanvas,
  submitGuess,
  submitPainterHint,
  revealPainterChar,
  maxRevealableChars,
  redactDrawGuessState,
  type DrawGuessGameState,
  type DrawGuessPhase,
  type DrawGuessPlayerState,
  type DrawStroke,
  type GuessEntry,
  type PainterHintEntry,
  type WordSourceSnapshot,
} from './logic.js';

export { drawGuessModule } from './module.js';
export type { DrawGuessStartOptions } from './logic.js';
