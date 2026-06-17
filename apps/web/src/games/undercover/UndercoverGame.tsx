import { useEffect, useState } from 'react';
import type { UndercoverGameState } from '@game-lobby/game-engine';
import { SpeechChatPanel } from './SpeechChatPanel';
import { WordCard, PlayerRoster } from './WordCard';
import { VotePanel } from './VotePanel';
import { RevealBanner } from './RevealBanner';

interface Props {
  state: UndercoverGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  isHost?: boolean;
  canStartNext?: boolean;
  onStartNext?: () => void;
  onSpeech: (text: string) => void;
  onEndSpeaking: () => void;
  onVote: (targetId: string) => void;
  onContinueReveal: () => void;
}

const PHASE_LABELS: Record<UndercoverGameState['phase'], string> = {
  describe: '发言中',
  vote: '投票中',
  reveal: '揭晓中',
  ended: '已结束',
};

export function UndercoverGame({
  state,
  myMemberId,
  isSpectator,
  isHost,
  canStartNext,
  onStartNext,
  onSpeech,
  onEndSpeaking,
  onVote,
  onContinueReveal,
}: Props) {
  const me = state.players.find((p) => p.id === myMemberId);
  const alive = state.players.filter((p) => p.isAlive);
  const currentSpeaker = alive[state.currentSpeakerIndex];
  const isMyTurn =
    currentSpeaker?.id === myMemberId && state.phase === 'describe' && !isSpectator;
  const voteCount = Object.keys(state.votes).length;
  const [viewingRound, setViewingRound] = useState(state.round);

  useEffect(() => {
    if (state.phase === 'describe' || state.phase === 'vote') {
      setViewingRound(state.round);
    }
  }, [state.round, state.phase]);

  const displayedSpeeches = state.speeches.filter((s) => s.round === viewingRound);

  useEffect(() => {
    if (state.phase !== 'reveal' || state.gameContinues !== true) return;
    const timer = window.setTimeout(() => onContinueReveal(), 4000);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.gameContinues, state.round, onContinueReveal]);

  return (
    <div className="uc-game">
      <header className="uc-phase-header">
        <h2 style={{ margin: 0 }}>
          谁是卧底 · 第 {state.round} 轮 · {PHASE_LABELS[state.phase]}
        </h2>
        <p style={{ color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>{state.message}</p>
      </header>

      {state.phase === 'reveal' && (
        <RevealBanner
          message={state.message}
          lastEliminated={state.lastEliminated}
          gameContinues={state.gameContinues}
          onContinue={onContinueReveal}
        />
      )}

      {state.phase === 'ended' && (
        <div className="card uc-ended-banner">
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--success)' }}>
            {state.message}
          </p>
          {state.civilianWord && state.undercoverWord && (
            <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)' }}>
              本局词对：平民「{state.civilianWord}」 / 卧底「{state.undercoverWord}」
            </p>
          )}
          {isHost && canStartNext && onStartNext && (
            <button type="button" className="btn" onClick={onStartNext}>
              再来一局
            </button>
          )}
          {!isHost && canStartNext && (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              等待房主开始下一局…
            </p>
          )}
        </div>
      )}

      <div className="uc-layout">
        <div className="uc-main">
          {me && !isSpectator && state.phase !== 'ended' && (
            <WordCard word={me.word} isWhiteBoard={me.isWhiteBoard} />
          )}
          <PlayerRoster
            players={state.players}
            currentSpeakerId={currentSpeaker?.id ?? null}
            phase={state.phase}
            voteCount={voteCount}
            aliveCount={alive.length}
          />
          {state.phase === 'vote' && me?.isAlive && !isSpectator && myMemberId && (
            <VotePanel
              alivePlayers={alive}
              myMemberId={myMemberId}
              hasVoted={Boolean(state.votes[myMemberId])}
              onVote={onVote}
            />
          )}
        </div>
        <SpeechChatPanel
          speeches={displayedSpeeches}
          allSpeeches={state.speeches}
          currentRound={state.round}
          viewingRound={viewingRound}
          onViewingRoundChange={setViewingRound}
          canSpeak={isMyTurn}
          currentSpeakerName={currentSpeaker?.name ?? null}
          onSend={onSpeech}
          onEndSpeaking={onEndSpeaking}
        />
      </div>
    </div>
  );
}
