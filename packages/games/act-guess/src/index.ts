export {
  createActGuessGame,
  selectWord,
  tickActGuess,
  submitGuess,
  performerPass,
  performerConfirmCorrect,
  redactActGuessState,
  canPlayerGuess,
  canPlayerSeeWord,
  getConfirmableGuessers,
  getPlayerTeam,
  type ActGuessGameState,
  type ActGuessPhase,
  type ActGuessPlayerState,
  type ActGuessTeamId,
  type ActGuessTeams,
  type GuessEntry,
  type WordSourceSnapshot,
} from './logic.js';

export { actGuessModule } from './module.js';
export type { ActGuessStartOptions } from './logic.js';
