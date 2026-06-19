import { useEffect, useMemo, useState } from 'react';
import type { ActGuessGameState } from '@game-lobby/game-engine';
import { canPlayerGuess } from '@game-lobby/game-engine';
import { PerformArea } from './PerformArea';
import { GuessChatPanel } from './GuessChatPanel';
import { RoundSummary } from './RoundSummary';

export interface ActGuessGameProps {
  state: ActGuessGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onSelectWord: (word: string) => void;
  onGuess: (text: string) => void;
  onPass: () => void;
  onConfirmCorrect: (playerId: string) => void;
}

export function ActGuessGame({
  state,
  myMemberId,
  isSpectator,
  onSelectWord,
  onGuess,
  onPass,
  onConfirmCorrect,
}: ActGuessGameProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const isPerformer = myMemberId === state.performerId;
  const canGuess =
    !isSpectator &&
    myMemberId != null &&
    canPlayerGuess(state, myMemberId);

  const guessDisabledHint = isPerformer
    ? '表演者不能猜词'
    : state.teams?.enabled && state.phase === 'performing' && !canGuess
      ? '对方队员可见词语，但不能猜词'
      : '旁观者仅可观看';

  const phaseLabel = useMemo(() => {
    switch (state.phase) {
      case 'word_select':
        return '选词阶段';
      case 'performing':
        return '比划阶段';
      case 'round_end':
        return '回合结算';
      case 'ended':
        return '游戏结束';
      default:
        return '';
    }
  }, [state.phase]);

  const countdown =
    state.phase === 'ended'
      ? null
      : Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000));

  const performerName = state.players.find((p) => p.id === state.performerId)?.name;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <strong>{phaseLabel}</strong>
          {countdown != null && (
            <span style={{ marginLeft: '0.75rem', color: 'var(--text-muted)' }}>
              {countdown}s
            </span>
          )}
          {state.teams?.enabled && state.roundPerformerTeam && (
            <span style={{ marginLeft: '0.75rem', color: 'var(--text-muted)' }}>
              {state.roundPerformerTeam} 队回合
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{state.message}</div>
      </div>

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <span>
          表演者：<strong>{performerName}</strong>
        </span>
        {state.phase === 'round_end' || state.phase === 'ended' ? (
          <span>
            词语：<strong>{state.selectedWord}</strong>
          </span>
        ) : null}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        <section>
          <h3 style={{ marginTop: 0 }}>表演区</h3>
          <PerformArea
            state={state}
            myMemberId={myMemberId}
            onSelectWord={onSelectWord}
            onPass={onPass}
            onConfirmCorrect={onConfirmCorrect}
          />
        </section>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <GuessChatPanel
            guesses={state.guesses}
            canGuess={canGuess}
            onGuess={onGuess}
            disabledHint={guessDisabledHint}
          />

          {(state.phase === 'round_end' || state.phase === 'ended') && <RoundSummary state={state} />}

          <div className="card">
            <h3 style={{ marginTop: 0 }}>积分榜</h3>
            {state.teams?.enabled && state.teamScores ? (
              <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                <li>A 队：{state.teamScores.A} 分</li>
                <li>B 队：{state.teamScores.B} 分</li>
              </ol>
            ) : (
              <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {[...state.players]
                  .filter((p) => !p.isSpectator)
                  .map((p) => ({ name: p.name, score: state.scores[p.id] ?? 0 }))
                  .sort((a, b) => b.score - a.score)
                  .map((s) => (
                    <li key={s.name}>
                      {s.name}：{s.score} 分
                    </li>
                  ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
