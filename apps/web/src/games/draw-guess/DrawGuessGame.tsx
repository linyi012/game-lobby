import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DrawGuessGameState, DrawStroke } from '@game-lobby/game-engine';
import { DrawingCanvas } from './DrawingCanvas';
import { GuessChatPanel } from './GuessChatPanel';
import { WordSelectPanel } from './WordSelectPanel';
import { RoundSummary } from './RoundSummary';
import { useStrokeDelta } from './useStrokeDelta';

export interface DrawGuessGameProps {
  state: DrawGuessGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onSelectWord: (word: string) => void;
  onStroke: (strokes: DrawStroke[]) => void;
  onClear: () => void;
  onGuess: (text: string) => void;
}

export function DrawGuessGame({
  state,
  myMemberId,
  isSpectator,
  onSelectWord,
  onStroke,
  onClear,
  onGuess,
}: DrawGuessGameProps) {
  const [localStrokes, setLocalStrokes] = useState<DrawStroke[]>(state.strokes);
  const [, setTick] = useState(0);

  useEffect(() => {
    setLocalStrokes(state.strokes);
  }, [state.strokes, state.phase, state.round]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const handleDelta = useCallback((strokes: DrawStroke[]) => {
    setLocalStrokes((prev) => [...prev, ...strokes]);
  }, []);

  useStrokeDelta(handleDelta);

  const isPainter = myMemberId === state.painterId;
  const hasGuessed = myMemberId != null && state.guessedIds.includes(myMemberId);
  const canGuess =
    !isSpectator &&
    !isPainter &&
    state.phase === 'drawing' &&
    myMemberId != null &&
    state.activePlayerIds.includes(myMemberId) &&
    !hasGuessed;

  const phaseLabel = useMemo(() => {
    switch (state.phase) {
      case 'word_select':
        return '选词阶段';
      case 'drawing':
        return '作画阶段';
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

  const sortedScores = [...state.players]
    .filter((p) => !p.isSpectator)
    .map((p) => ({ name: p.name, score: state.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

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
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{state.message}</div>
      </div>

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <span>
          画家：<strong>{state.players.find((p) => p.id === state.painterId)?.name}</strong>
        </span>
        {state.phase === 'drawing' && !isPainter && (
          <span>
            提示：<strong>{state.wordHint}</strong>
          </span>
        )}
        {isPainter && state.selectedWord && state.phase === 'drawing' && (
          <span>
            词语：<strong>{state.selectedWord}</strong>
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ marginTop: 0 }}>画布</h3>
            {isPainter && state.phase === 'drawing' && (
              <button type="button" className="btn btn-secondary" onClick={onClear}>
                清空画布
              </button>
            )}
          </div>
          {state.phase === 'word_select' && isPainter ? (
            <WordSelectPanel state={state} onSelect={onSelectWord} />
          ) : (
            <DrawingCanvas
              strokes={localStrokes}
              readOnly={!isPainter || state.phase !== 'drawing'}
              onStrokeBatch={isPainter && state.phase === 'drawing' ? onStroke : undefined}
            />
          )}
        </section>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <GuessChatPanel guesses={state.guesses} canGuess={canGuess} onGuess={onGuess} />

          {(state.phase === 'round_end' || state.phase === 'ended') && <RoundSummary state={state} />}

          <div className="card">
            <h3 style={{ marginTop: 0 }}>积分榜</h3>
            <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {sortedScores.map((s) => (
                <li key={s.name}>
                  {s.name}：{s.score} 分
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
