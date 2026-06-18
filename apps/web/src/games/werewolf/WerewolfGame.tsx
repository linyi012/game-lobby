import { useEffect, useRef, useMemo, useState } from 'react';
import type { WerewolfGameState, WerewolfPhase } from '@game-lobby/game-engine';
import { PhaseBanner } from './PhaseBanner';
import { WerewolfTable } from './WerewolfTable';
import { RoleCard } from './RoleCard';
import { NightWaitingOverlay } from './NightWaitingOverlay';
import { NightActionPanel, WitchActionButtons } from './NightActionPanel';
import { DayChatPanel } from './DayChatPanel';
import { WolfChatPanel } from './WolfChatPanel';
import { DeathRevealBanner } from './DeathRevealBanner';
import { GameEndScreen } from './GameEndScreen';
import {
  playDaySound,
  playDeathSound,
  playNightSound,
  playVictorySound,
  playVoteSound,
  unlockAudio,
} from './game-sounds';

const NIGHT_PHASES: WerewolfPhase[] = [
  'night_wolf',
  'night_seer',
  'night_witch',
  'night_guard',
  'night_resolve',
];

interface Props {
  state: WerewolfGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onWolfVote: (targetId: string) => void;
  onWolfChat: (text: string) => void;
  onSeerPeek: (targetId: string) => void;
  onWitchAct: (action: 'heal' | 'poison' | 'skip', targetId?: string) => void;
  onGuardProtect: (targetId: string) => void;
  onSpeech: (text: string) => void;
  onEndSpeaking: () => void;
  onDayVote: (targetId: string) => void;
  onHunterShoot: (targetId: string) => void;
  onSkipHunter: () => void;
  onContinue: () => void;
}

export function WerewolfGame({
  state,
  myMemberId,
  isSpectator,
  onWolfVote,
  onWolfChat,
  onSeerPeek,
  onWitchAct,
  onGuardProtect,
  onSpeech,
  onEndSpeaking,
  onDayVote,
  onHunterShoot,
  onSkipHunter,
  onContinue,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const me = state.players.find((p) => p.id === myMemberId);
  const isNight = NIGHT_PHASES.includes(state.phase);
  const playerNames = useMemo(
    () => Object.fromEntries(state.players.map((p) => [p.id, p.name])),
    [state.players],
  );

  const wolfTeammates = state.players.filter(
    (p) => p.role === 'werewolf' && p.id !== myMemberId,
  );

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    unlockAudio();
    const onPointer = () => unlockAudio();
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, []);

  const prevPhaseRef = useRef(state.phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (NIGHT_PHASES.includes(state.phase) && !NIGHT_PHASES.includes(prev)) {
      playNightSound();
    }
    if (state.phase === 'day_discuss' && prev !== 'day_discuss') {
      playDaySound();
    }
    if (state.phase === 'reveal' && state.lastEliminated) {
      playDeathSound();
    }
    if (state.phase === 'ended') {
      playVictorySound();
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase, state.lastEliminated]);

  useEffect(() => {
    if (state.phase === 'reveal' && state.gameContinues === true) {
      const timer = window.setTimeout(() => onContinue(), 4000);
      return () => window.clearTimeout(timer);
    }
    if (state.phase === 'day_announce') {
      const timer = window.setTimeout(() => onContinue(), 3000);
      return () => window.clearTimeout(timer);
    }
  }, [state.phase, state.gameContinues, state.round, onContinue]);

  const alive = state.players.filter((p) => p.isAlive);
  const currentSpeaker = alive[state.currentSpeakerIndex];
  const canSpeak =
    !isSpectator &&
    !!me?.isAlive &&
    state.phase === 'day_discuss' &&
    (state.discussionMode === 'free' || currentSpeaker?.id === myMemberId);

  const canActNight = !isSpectator && !!me?.isAlive;

  const witchCanHeal = Boolean(
    me?.role === 'witch' &&
      state.phase === 'night_witch' &&
      !state.witchHealUsed &&
      state.nightState.wolfKillTarget != null,
  );

  const witchCanPoison = Boolean(
    me?.role === 'witch' && state.phase === 'night_witch' && !state.witchPoisonUsed,
  );

  function canSelectForNight(): boolean {
    if (!canActNight) return false;
    if (state.phase === 'night_wolf') return me?.role === 'werewolf';
    if (state.phase === 'night_seer') return me?.role === 'seer';
    if (state.phase === 'night_guard') return me?.role === 'guard';
    if (state.phase === 'night_witch' && witchCanPoison) return true;
    if (state.phase === 'hunter_shoot') return state.pendingHunterId === myMemberId;
    return false;
  }

  const canVote =
    !isSpectator &&
    !!me?.isAlive &&
    me.canVote &&
    state.phase === 'day_vote' &&
    !state.dayVotes[myMemberId ?? ''];

  const showNightWaiting =
    isNight &&
    !isSpectator &&
    me?.isAlive &&
    !canSelectForNight() &&
    state.phase !== 'night_resolve';

  function handleSeatSelect(id: string) {
    setSelectedId(id);
    if (state.phase === 'day_vote' && canVote) {
      playVoteSound();
      onDayVote(id);
      return;
    }
  }

  function confirmNightAction() {
    if (!selectedId) return;
    switch (state.phase) {
      case 'night_wolf':
        onWolfVote(selectedId);
        break;
      case 'night_seer':
        onSeerPeek(selectedId);
        break;
      case 'night_guard':
        onGuardProtect(selectedId);
        break;
      case 'hunter_shoot':
        onHunterShoot(selectedId);
        break;
      default:
        break;
    }
    setSelectedId(null);
  }

  const voteCounts =
    state.phase === 'reveal' || state.phase === 'day_vote'
      ? Object.values(state.dayVotes).reduce<Record<string, number>>((acc, id) => {
          acc[id] = (acc[id] ?? 0) + 1;
          return acc;
        }, {})
      : {};

  const selectedName = selectedId ? playerNames[selectedId] : null;

  return (
    <div className={`ww-game ${isNight ? 'ww-theme-night' : 'ww-theme-day'}`} data-theme={isNight ? 'night' : 'day'}>
      <PhaseBanner
        phase={state.phase}
        round={state.round}
        message={state.message}
        phaseDeadline={state.phaseDeadline}
        isNight={isNight}
      />

      <div className="ww-layout">
        <div className="ww-table-area">
          <WerewolfTable
            players={state.players}
            myMemberId={myMemberId}
            selectable={canSelectForNight() || canVote}
            selectedId={selectedId}
            voteCounts={voteCounts}
            currentSpeakerId={
              state.phase === 'day_discuss' ? (currentSpeaker?.id ?? null) : null
            }
            onSelect={handleSeatSelect}
          />
          <NightWaitingOverlay visible={!!showNightWaiting} />
        </div>

        <div className="ww-side">
          {me && me.role !== 'unknown' && <RoleCard role={me.role} wolfTeammates={wolfTeammates} />}

          {state.phase === 'night_wolf' && me?.role === 'werewolf' && (
            <WolfChatPanel
              messages={state.wolfChats}
              canChat={canActNight}
              onChat={onWolfChat}
            />
          )}

          {(state.phase === 'day_discuss' || state.phase === 'day_vote') && (
            <DayChatPanel
              speeches={state.speeches}
              round={state.round}
              canSpeak={canSpeak}
              onSpeech={onSpeech}
              onEndSpeaking={onEndSpeaking}
            />
          )}

          {me?.role === 'seer' && state.seerHistory.length > 0 && (
            <div className="card ww-seer-log">
              <h3 style={{ marginTop: 0 }}>查验记录</h3>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {state.seerHistory.map((r) => (
                  <li key={`${r.round}-${r.targetId}`}>
                    第 {r.round} 夜 {r.targetName}：{r.isWerewolf ? '狼人' : '好人'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.phase === 'day_announce' && (
            <DeathRevealBanner
              message={state.message}
              lastEliminated={null}
              nightDeaths={state.nightDeaths}
              playerNames={playerNames}
              gameContinues={true}
              onContinue={onContinue}
            />
          )}

          {state.phase === 'reveal' && (
            <DeathRevealBanner
              message={state.message}
              lastEliminated={state.lastEliminated}
              nightDeaths={[]}
              playerNames={playerNames}
              gameContinues={state.gameContinues}
              onContinue={onContinue}
            />
          )}

          {state.phase === 'ended' && <GameEndScreen state={state} />}
        </div>
      </div>

      {canSelectForNight() && (
        <NightActionPanel
          actionLabel={
            state.phase === 'night_wolf'
              ? '刀杀'
              : state.phase === 'night_seer'
                ? '查验'
                : state.phase === 'night_guard'
                  ? '守护'
                  : '开枪'
          }
          targetName={selectedName}
          onConfirm={confirmNightAction}
          onCancel={() => setSelectedId(null)}
        />
      )}

      {state.phase === 'night_witch' && me?.role === 'witch' && (
        <div className="ww-night-action">
          <WitchActionButtons
            canHeal={witchCanHeal}
            canPoison={witchCanPoison}
            onHeal={() => {
              const target = state.nightState.wolfKillTarget;
              if (target) onWitchAct('heal', target);
            }}
            onPoison={() => {
              if (selectedId) onWitchAct('poison', selectedId);
            }}
            onSkip={() => onWitchAct('skip')}
          />
          {witchCanPoison && !selectedId && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              使用毒药前请先在座位上选择目标
            </p>
          )}
        </div>
      )}

      {state.phase === 'hunter_shoot' && state.pendingHunterId === myMemberId && (
        <div className="ww-night-action">
          <button type="button" className="btn btn-secondary" onClick={onSkipHunter}>
            放弃开枪
          </button>
        </div>
      )}

      {canVote && Object.keys(state.dayVotes).length > 0 && (
        <p className="ww-vote-wait">已投票，等待其他玩家…</p>
      )}
    </div>
  );
}
