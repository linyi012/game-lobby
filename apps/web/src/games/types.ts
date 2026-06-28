import type { ComponentType } from 'react';
import type { GameState } from '@game-lobby/game-engine';
import type { GameStartOptionsPayload } from '../lib/start-game-options';

export interface GameComponentProps {
  state: GameState;
  myMemberId: string | null;
  isSpectator: boolean;
  isHost?: boolean;
  canStartNext?: boolean;
  onStartNextGame?: () => void;
}

export interface RoomSettingsProps {
  isHost: boolean;
  isPlaying: boolean;
  isIntermission: boolean;
  gameState: GameState | null;
  players?: { id: string; name: string; role: string }[];
  activePlayerCount?: number;
  onStartOptionsChange: (options: Partial<GameStartOptionsPayload>) => void;
}

export interface WebGameModule {
  Component: ComponentType<GameComponentProps>;
  isEnded: (state: unknown) => boolean;
}
