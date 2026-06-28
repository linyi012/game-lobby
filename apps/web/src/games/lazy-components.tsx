import { lazy, type ComponentType } from 'react';
import type { GameType } from '@game-lobby/shared';
import type { GameComponentProps } from './types';
import {
  emitUndercoverSpeech,
  emitUndercoverEndSpeaking,
  emitUndercoverVote,
  emitUndercoverContinueReveal,
} from './undercover/socket';
import {
  emitDaVinciGuess,
  emitDaVinciDecision,
  emitDaVinciPlace,
  emitDaVinciSetup,
} from './da-vinci-code/socket';
import {
  emitSelectWord,
  emitStroke,
  emitClearCanvas,
  emitGuess,
  emitPainterHint,
  emitRevealChar,
} from './draw-guess/socket';
import {
  emitSelectWord as emitActGuessSelectWord,
  emitGuess as emitActGuessGuess,
  emitPass as emitActGuessPass,
  emitConfirmCorrect as emitActGuessConfirmCorrect,
} from './act-guess/socket';
import {
  emitHeartAttackFlip,
  emitHeartAttackSlap,
  emitHeartAttackChooseWild,
} from './german-heart-attack/socket';
import {
  emitContinue,
  emitDayVote,
  emitEndSpeaking,
  emitGuardProtect,
  emitHunterShoot,
  emitSeerPeek,
  emitSkipHunter,
  emitWerewolfSpeech,
  emitWitchAct,
  emitWolfChat,
  emitWolfVote,
} from './werewolf/socket';
import { emitGomokuPlace } from './gomoku/socket';
import { emitGoPass, emitGoPlay, emitGoResign } from './go/socket';
import { emitChessMove, emitChessResign } from './chess/socket';
import {
  emitScriptMurderContinue,
  emitScriptMurderHostAdvance,
  emitScriptMurderHostJumpAct,
  emitScriptMurderHostPause,
  emitScriptMurderHostRevealClue,
  emitScriptMurderSearchClue,
  emitScriptMurderSpeech,
  emitScriptMurderVote,
} from './script-murder/socket';
import {
  emitChineseChessMove,
  emitChineseChessResign,
  emitChineseChessOfferDraw,
  emitChineseChessRespondDraw,
} from './chinese-chess/socket';
import {
  emitGoldMinerLaunch,
  emitGoldMinerShopBuy,
  emitGoldMinerShopDone,
  emitGoldMinerUseDynamite,
} from './gold-miner/socket';
import {
  emitLifeboatAction,
  emitLifeboatCombatSupport,
  emitLifeboatNavigationPick,
  emitLifeboatPlaySupply,
  emitLifeboatRespond,
  emitLifeboatSkipThirst,
  emitLifeboatSupplyPick,
} from './lifeboat/socket';
import {
  emitAssassinate,
  emitContinue as emitAvalonContinue,
  emitEvilChat,
  emitLadyPick,
  emitMissionCard,
  emitProposeTeam,
  emitTeamVote,
} from './avalon/socket';

function lazyGame(
  loader: () => Promise<{ default: ComponentType<GameComponentProps> }>,
): ComponentType<GameComponentProps> {
  return lazy(loader);
}

export const LAZY_GAME_COMPONENTS: Record<GameType, ComponentType<GameComponentProps>> = {
  undercover: lazyGame(() =>
    import('./undercover/UndercoverGame').then((mod) => ({
      default: function UndercoverLazy(props: GameComponentProps) {
        return (
          <mod.UndercoverGame
            state={props.state as import('@game-lobby/game-engine').UndercoverGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            isHost={props.isHost}
            canStartNext={props.canStartNext}
            onStartNext={props.onStartNextGame}
            onSpeech={emitUndercoverSpeech}
            onEndSpeaking={emitUndercoverEndSpeaking}
            onVote={emitUndercoverVote}
            onContinueReveal={emitUndercoverContinueReveal}
          />
        );
      },
    })),
  ),
  da_vinci_code: lazyGame(() =>
    import('./da-vinci-code/DaVinciGame').then((mod) => ({
      default: function DaVinciLazy(props: GameComponentProps) {
        return (
          <mod.DaVinciGame
            state={props.state as import('@game-lobby/game-engine').DaVinciGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            onGuess={emitDaVinciGuess}
            onDecision={emitDaVinciDecision}
            onPlaceJoker={emitDaVinciPlace}
            onSubmitSetup={emitDaVinciSetup}
          />
        );
      },
    })),
  ),
  draw_guess: lazyGame(() =>
    import('./draw-guess/DrawGuessGame').then((mod) => ({
      default: function DrawGuessLazy(props: GameComponentProps) {
        return (
          <mod.DrawGuessGame
            state={props.state as import('@game-lobby/game-engine').DrawGuessGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            onSelectWord={emitSelectWord}
            onStroke={emitStroke}
            onClear={emitClearCanvas}
            onGuess={emitGuess}
            onPainterHint={emitPainterHint}
            onRevealChar={emitRevealChar}
          />
        );
      },
    })),
  ),
  act_guess: lazyGame(() =>
    import('./act-guess/ActGuessGame').then((mod) => ({
      default: function ActGuessLazy(props: GameComponentProps) {
        return (
          <mod.ActGuessGame
            state={props.state as import('@game-lobby/game-engine').ActGuessGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            onSelectWord={emitActGuessSelectWord}
            onGuess={emitActGuessGuess}
            onPass={emitActGuessPass}
            onConfirmCorrect={emitActGuessConfirmCorrect}
          />
        );
      },
    })),
  ),
  german_heart_attack: lazyGame(() =>
    import('./german-heart-attack/HeartAttackGame').then((mod) => ({
      default: function HeartAttackLazy(props: GameComponentProps) {
        return (
          <mod.HeartAttackGame
            state={props.state as import('@game-lobby/game-engine').HeartAttackGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            onFlip={emitHeartAttackFlip}
            onSlap={emitHeartAttackSlap}
            onChooseWild={emitHeartAttackChooseWild}
          />
        );
      },
    })),
  ),
  werewolf: lazyGame(() =>
    import('./werewolf/WerewolfGame').then((mod) => ({
      default: function WerewolfLazy(props: GameComponentProps) {
        return (
          <mod.WerewolfGame
            state={props.state as import('@game-lobby/game-engine').WerewolfGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            onWolfVote={emitWolfVote}
            onWolfChat={emitWolfChat}
            onSeerPeek={emitSeerPeek}
            onWitchAct={emitWitchAct}
            onGuardProtect={emitGuardProtect}
            onSpeech={emitWerewolfSpeech}
            onEndSpeaking={emitEndSpeaking}
            onDayVote={emitDayVote}
            onHunterShoot={emitHunterShoot}
            onSkipHunter={emitSkipHunter}
            onContinue={emitContinue}
          />
        );
      },
    })),
  ),
  gomoku: lazyGame(() =>
    import('./gomoku/GomokuGame').then((mod) => ({
      default: function GomokuLazy(props: GameComponentProps) {
        return (
          <mod.GomokuGame
            state={props.state as import('@game-lobby/game-engine').GomokuGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            onPlace={emitGomokuPlace}
          />
        );
      },
    })),
  ),
  go: lazyGame(() =>
    import('./go/GoGame').then((mod) => ({
      default: function GoLazy(props: GameComponentProps) {
        return (
          <mod.GoGame
            state={props.state as import('@game-lobby/game-engine').GoGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            onPlay={emitGoPlay}
            onPass={emitGoPass}
            onResign={emitGoResign}
          />
        );
      },
    })),
  ),
  chess: lazyGame(() =>
    import('./chess/ChessGame').then((mod) => ({
      default: function ChessLazy(props: GameComponentProps) {
        return (
          <mod.ChessGame
            state={props.state as import('@game-lobby/game-engine').ChessGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            onMove={emitChessMove}
            onResign={emitChessResign}
          />
        );
      },
    })),
  ),
  script_murder: lazyGame(() =>
    import('./script-murder/ScriptMurderGame').then((mod) => ({
      default: function ScriptMurderLazy(props: GameComponentProps) {
        return (
          <mod.ScriptMurderGame
            state={props.state as import('@game-lobby/game-engine').ScriptMurderGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            isHost={props.isHost}
            onSpeech={emitScriptMurderSpeech}
            onVote={emitScriptMurderVote}
            onSearchClue={emitScriptMurderSearchClue}
            onHostAdvance={emitScriptMurderHostAdvance}
            onHostRevealClue={emitScriptMurderHostRevealClue}
            onHostPause={emitScriptMurderHostPause}
            onHostJumpAct={emitScriptMurderHostJumpAct}
            onContinue={emitScriptMurderContinue}
          />
        );
      },
    })),
  ),
  dwarf_mine: lazyGame(() =>
    import('./dwarf-mine/DwarfMineGame').then((mod) => ({
      default: function DwarfMineLazy(props: GameComponentProps) {
        return (
          <mod.DwarfMineGame
            state={props.state as import('@game-lobby/game-engine').DwarfMineGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
          />
        );
      },
    })),
  ),
  chinese_chess: lazyGame(() =>
    import('./chinese-chess/ChineseChessGame').then((mod) => ({
      default: function ChineseChessLazy(props: GameComponentProps) {
        return (
          <mod.ChineseChessGame
            state={props.state as import('@game-lobby/game-engine').ChineseChessGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            onMove={emitChineseChessMove}
            onResign={emitChineseChessResign}
            onOfferDraw={emitChineseChessOfferDraw}
            onRespondDraw={emitChineseChessRespondDraw}
          />
        );
      },
    })),
  ),
  gold_miner: lazyGame(() =>
    import('./gold-miner/GoldMinerGame').then((mod) => ({
      default: function GoldMinerLazy(props: GameComponentProps) {
        return (
          <mod.GoldMinerGame
            state={props.state as import('@game-lobby/game-engine').GoldMinerGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            onLaunch={emitGoldMinerLaunch}
            onUseDynamite={emitGoldMinerUseDynamite}
            onShopBuy={emitGoldMinerShopBuy}
            onShopDone={emitGoldMinerShopDone}
          />
        );
      },
    })),
  ),
  lifeboat: lazyGame(() =>
    import('./lifeboat/LifeboatGame').then((mod) => ({
      default: function LifeboatLazy(props: GameComponentProps) {
        return (
          <mod.LifeboatGame
            state={props.state as import('@game-lobby/game-engine').LifeboatGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            onSupplyPick={emitLifeboatSupplyPick}
            onAction={emitLifeboatAction}
            onRespond={emitLifeboatRespond}
            onCombatSupport={emitLifeboatCombatSupport}
            onNavigationPick={emitLifeboatNavigationPick}
            onPlayWater={(cardId) => emitLifeboatPlaySupply(cardId, 'thirst')}
            onSkipThirst={emitLifeboatSkipThirst}
          />
        );
      },
    })),
  ),
  avalon: lazyGame(() =>
    import('./avalon/AvalonGame').then((mod) => ({
      default: function AvalonLazy(props: GameComponentProps) {
        return (
          <mod.AvalonGame
            state={props.state as import('@game-lobby/game-engine').AvalonGameState}
            myMemberId={props.myMemberId}
            isSpectator={props.isSpectator}
            onProposeTeam={emitProposeTeam}
            onTeamVote={emitTeamVote}
            onMissionCard={emitMissionCard}
            onContinue={emitAvalonContinue}
            onLadyPick={emitLadyPick}
            onAssassinate={emitAssassinate}
            onEvilChat={emitEvilChat}
          />
        );
      },
    })),
  ),
};

const LAZY_ROOM_SETTINGS_LOADERS: Partial<
  Record<GameType, () => Promise<{ default: ComponentType<import('./types').RoomSettingsProps> }>>
> = {
  undercover: () => import('./undercover/RoomSettings').then((m) => ({ default: m.UndercoverRoomSettings })),
  da_vinci_code: () => import('./da-vinci-code/RoomSettings').then((m) => ({ default: m.DaVinciRoomSettings })),
  draw_guess: () => import('./draw-guess/RoomSettings').then((m) => ({ default: m.DrawGuessRoomSettings })),
  act_guess: () => import('./act-guess/RoomSettings').then((m) => ({ default: m.ActGuessRoomSettings })),
  german_heart_attack: () =>
    import('./german-heart-attack/RoomSettings').then((m) => ({ default: m.HeartAttackRoomSettings })),
  werewolf: () => import('./werewolf/RoomSettings').then((m) => ({ default: m.WerewolfRoomSettings })),
  go: () => import('./go/RoomSettings').then((m) => ({ default: m.GoRoomSettings })),
  chess: () => import('./chess/RoomSettings').then((m) => ({ default: m.ChessRoomSettings })),
  script_murder: () => import('./script-murder/RoomSettings').then((m) => ({ default: m.ScriptMurderRoomSettings })),
  dwarf_mine: () => import('./dwarf-mine/RoomSettings').then((m) => ({ default: m.DwarfMineRoomSettings })),
  chinese_chess: () => import('./chinese-chess/RoomSettings').then((m) => ({ default: m.ChineseChessRoomSettings })),
  gold_miner: () => import('./gold-miner/RoomSettings').then((m) => ({ default: m.GoldMinerRoomSettings })),
  avalon: () => import('./avalon/RoomSettings').then((m) => ({ default: m.AvalonRoomSettings })),
};

const settingsCache = new Map<GameType, ComponentType<import('./types').RoomSettingsProps>>();

export async function loadRoomSettings(
  gameType: GameType,
): Promise<ComponentType<import('./types').RoomSettingsProps> | null> {
  if (settingsCache.has(gameType)) {
    return settingsCache.get(gameType)!;
  }
  const loader = LAZY_ROOM_SETTINGS_LOADERS[gameType];
  if (!loader) return null;
  const mod = await loader();
  settingsCache.set(gameType, mod.default);
  return mod.default;
}
