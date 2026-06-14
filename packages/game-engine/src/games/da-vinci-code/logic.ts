import type { AiDifficulty } from '@game-lobby/shared';
import { pickRandom, shouldBotMakeMistake, shuffle } from '../../ai/utils.js';

export type DaVinciPhase = 'playing' | 'ended';

export interface DaVinciTile {
  color: 'black' | 'white';
  value: number;
}

export interface DaVinciPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  rack: DaVinciTile[];
  isActive: boolean;
}

export interface DaVinciGuessResult {
  exact: number;
  colorOnly: number;
}

export interface DaVinciGameState {
  phase: DaVinciPhase;
  players: DaVinciPlayerState[];
  currentPlayerIndex: number;
  tableSequence: DaVinciTile[];
  lastGuess: {
    playerId: string;
    targetPlayerId: string;
    guess: DaVinciTile[];
    result: DaVinciGuessResult;
  } | null;
  winnerId: string | null;
  message: string;
}

function createRack(): DaVinciTile[] {
  const tiles: DaVinciTile[] = [];
  for (let v = 0; v <= 11; v++) {
    tiles.push({ color: 'black', value: v });
    tiles.push({ color: 'white', value: v });
  }
  return shuffle(tiles).slice(0, 5);
}

export function createDaVinciGame(
  playerIds: { id: string; name: string; isBot: boolean }[],
): DaVinciGameState {
  const players: DaVinciPlayerState[] = playerIds.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    rack: createRack(),
    isActive: true,
  }));

  return {
    phase: 'playing',
    players,
    currentPlayerIndex: 0,
    tableSequence: [],
    lastGuess: null,
    winnerId: null,
    message: `${players[0]!.name} 先手，猜测对手序列并放置对应牌。`,
  };
}

export function evaluateGuess(actual: DaVinciTile[], guess: DaVinciTile[]): DaVinciGuessResult {
  let exact = 0;
  let colorOnly = 0;
  const usedActual = new Set<number>();
  const usedGuess = new Set<number>();

  for (let i = 0; i < guess.length; i++) {
    if (
      actual[i] &&
      guess[i] &&
      actual[i]!.color === guess[i]!.color &&
      actual[i]!.value === guess[i]!.value
    ) {
      exact++;
      usedActual.add(i);
      usedGuess.add(i);
    }
  }

  for (let gi = 0; gi < guess.length; gi++) {
    if (usedGuess.has(gi)) continue;
    for (let ai = 0; ai < actual.length; ai++) {
      if (usedActual.has(ai)) continue;
      if (
        actual[ai]!.color === guess[gi]!.color ||
        actual[ai]!.value === guess[gi]!.value
      ) {
        colorOnly++;
        usedActual.add(ai);
        usedGuess.add(gi);
        break;
      }
    }
  }

  return { exact, colorOnly };
}

export function playDaVinciTile(
  state: DaVinciGameState,
  playerId: string,
  targetPlayerId: string,
  tileIndex: number,
  position: number,
): DaVinciGameState {
  if (state.phase !== 'playing') return state;
  const current = state.players[state.currentPlayerIndex];
  if (!current || current.id !== playerId) return state;

  const tile = current.rack[tileIndex];
  if (!tile) return state;

  const newRack = current.rack.filter((_, i) => i !== tileIndex);
  const newSequence = [...state.tableSequence];
  newSequence.splice(position, 0, tile);

  const target = state.players.find((p) => p.id === targetPlayerId);
  const result = evaluateGuess(target?.rack ?? [], newSequence);

  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, rack: newRack } : p,
  );

  if (newRack.length === 0) {
    return {
      ...state,
      players: updatedPlayers,
      tableSequence: newSequence,
      lastGuess: { playerId, targetPlayerId, guess: newSequence, result },
      phase: 'ended',
      winnerId: playerId,
      message: `${current.name} 率先清空手牌，获胜！`,
    };
  }

  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  return {
    ...state,
    players: updatedPlayers,
    tableSequence: [],
    currentPlayerIndex: nextIndex,
    lastGuess: { playerId, targetPlayerId, guess: newSequence, result },
    message: `${current.name} 猜测结果：${result.exact} 精确，${result.colorOnly} 部分。轮到 ${state.players[nextIndex]!.name}。`,
  };
}

export function generateBotDaVinciMove(
  state: DaVinciGameState,
  botId: string,
  difficulty: AiDifficulty,
): { targetPlayerId: string; tileIndex: number; position: number } {
  const bot = state.players.find((p) => p.id === botId)!;
  const opponents = state.players.filter((p) => p.id !== botId);
  const target = pickRandom(opponents);

  let tileIndex = 0;
  let position = 0;

  if (!shouldBotMakeMistake(difficulty)) {
    tileIndex = Math.floor(Math.random() * bot.rack.length);
    position = Math.min(state.tableSequence.length, Math.floor(Math.random() * (bot.rack.length + 1)));
  } else {
    tileIndex = bot.rack.length - 1;
    position = state.tableSequence.length;
  }

  return { targetPlayerId: target.id, tileIndex, position };
}
