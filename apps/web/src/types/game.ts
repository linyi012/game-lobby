export interface UndercoverPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  isAlive: boolean;
  word: string | null;
  isUndercover: boolean;
  isWhiteBoard: boolean;
  description: string | null;
  votedFor: string | null;
}

export interface UndercoverGameState {
  phase: 'describe' | 'vote' | 'reveal' | 'ended';
  round: number;
  civilianWord: string;
  undercoverWord: string;
  players: UndercoverPlayerState[];
  currentSpeakerIndex: number;
  votes: Record<string, string>;
  winner: 'civilian' | 'undercover' | 'whiteboard' | null;
  message: string;
}

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

export interface DaVinciGameState {
  phase: 'playing' | 'ended';
  players: DaVinciPlayerState[];
  currentPlayerIndex: number;
  tableSequence: DaVinciTile[];
  lastGuess: {
    playerId: string;
    targetPlayerId: string;
    guess: DaVinciTile[];
    result: { exact: number; colorOnly: number };
  } | null;
  winnerId: string | null;
  message: string;
}
