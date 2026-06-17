import type { ComponentType, ReactNode } from 'react';
import type { GameType } from '@game-lobby/shared';
import { isGameEnded } from '@game-lobby/game-engine';
import type { GameState } from '@game-lobby/game-engine';
import { UndercoverGame } from './undercover/UndercoverGame';
import { emitUndercoverDescribe, emitUndercoverVote } from './undercover/socket';
import { DaVinciGame } from './da-vinci-code/DaVinciGame';
import {
  emitDaVinciGuess,
  emitDaVinciDecision,
  emitDaVinciPlace,
  emitDaVinciSetup,
} from './da-vinci-code/socket';
import { DaVinciRoomSettings } from './da-vinci-code/RoomSettings';
import { DrawGuessGame } from './draw-guess/DrawGuessGame';
import {
  emitSelectWord,
  emitStroke,
  emitClearCanvas,
  emitGuess,
  emitPainterHint,
  emitRevealChar,
} from './draw-guess/socket';
import { DrawGuessRoomSettings } from './draw-guess/RoomSettings';

export interface GameComponentProps {
  state: GameState;
  myMemberId: string | null;
  isSpectator: boolean;
}

export interface RoomSettingsProps {
  isHost: boolean;
  isPlaying: boolean;
  gameState: GameState | null;
  useJoker: boolean;
  setUseJoker: (v: boolean) => void;
  assistMode: boolean;
  setAssistMode: (v: boolean) => void;
  categoryIds: string[];
  setCategoryIds: (v: string[]) => void;
  userPackIds: string[];
  setUserPackIds: (v: string[]) => void;
  roomExtraWords: string;
  setRoomExtraWords: (v: string) => void;
}

export interface WebGameModule {
  Component: ComponentType<GameComponentProps>;
  RoomSettings?: ComponentType<RoomSettingsProps>;
  isEnded: (state: unknown) => boolean;
}

function UndercoverGameWrapper({ state, myMemberId, isSpectator }: GameComponentProps) {
  return (
    <UndercoverGame
      state={state as import('@game-lobby/game-engine').UndercoverGameState}
      myMemberId={myMemberId}
      isSpectator={isSpectator}
      onDescribe={emitUndercoverDescribe}
      onVote={emitUndercoverVote}
    />
  );
}

function DaVinciGameWrapper({ state, myMemberId, isSpectator }: GameComponentProps) {
  return (
    <DaVinciGame
      state={state as import('@game-lobby/game-engine').DaVinciGameState}
      myMemberId={myMemberId}
      isSpectator={isSpectator}
      onGuess={emitDaVinciGuess}
      onDecision={emitDaVinciDecision}
      onPlaceJoker={emitDaVinciPlace}
      onSubmitSetup={emitDaVinciSetup}
    />
  );
}

function DrawGuessGameWrapper({ state, myMemberId, isSpectator }: GameComponentProps) {
  return (
    <DrawGuessGame
      state={state as import('@game-lobby/game-engine').DrawGuessGameState}
      myMemberId={myMemberId}
      isSpectator={isSpectator}
      onSelectWord={emitSelectWord}
      onStroke={emitStroke}
      onClear={emitClearCanvas}
      onGuess={emitGuess}
      onPainterHint={emitPainterHint}
      onRevealChar={emitRevealChar}
    />
  );
}

export const GAME_REGISTRY: Record<GameType, WebGameModule> = {
  undercover: {
    Component: UndercoverGameWrapper,
    isEnded: (state) => isGameEnded('undercover', state as GameState),
  },
  da_vinci_code: {
    Component: DaVinciGameWrapper,
    RoomSettings: DaVinciRoomSettings,
    isEnded: (state) => isGameEnded('da_vinci_code', state as GameState),
  },
  draw_guess: {
    Component: DrawGuessGameWrapper,
    RoomSettings: DrawGuessRoomSettings,
    isEnded: (state) => isGameEnded('draw_guess', state as GameState),
  },
};

export function renderGameSettings(
  gameType: GameType,
  props: RoomSettingsProps,
): ReactNode {
  const mod = GAME_REGISTRY[gameType];
  if (!mod.RoomSettings) return null;
  const Settings = mod.RoomSettings;
  return <Settings {...props} />;
}
