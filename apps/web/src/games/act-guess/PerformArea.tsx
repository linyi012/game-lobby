import type { ActGuessGameState } from '@game-lobby/game-engine';
import { canPlayerSeeWord } from '@game-lobby/game-engine';
import { WordSelectPanel } from './WordSelectPanel';
import { PerformerControls } from './PerformerControls';

interface PerformAreaProps {
  state: ActGuessGameState;
  myMemberId: string | null;
  onSelectWord: (word: string) => void;
  onPass: () => void;
  onConfirmCorrect: (playerId: string) => void;
}

export function PerformArea({
  state,
  myMemberId,
  onSelectWord,
  onPass,
  onConfirmCorrect,
}: PerformAreaProps) {
  const isPerformer = myMemberId === state.performerId;
  const canSeeWord = canPlayerSeeWord(state, myMemberId);
  const performerName = state.players.find((p) => p.id === state.performerId)?.name ?? '表演者';

  if (state.phase === 'word_select' && isPerformer) {
    return <WordSelectPanel state={state} onSelect={onSelectWord} />;
  }

  return (
    <div
      className="card"
      style={{
        minHeight: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '0.75rem',
        padding: '1.5rem',
      }}
    >
      {state.phase === 'performing' && (
        <>
          <div style={{ fontSize: '2.5rem' }}>🎭</div>
          {isPerformer ? (
            <>
              <p style={{ margin: 0, fontSize: '1.25rem' }}>
                你的词语：<strong>{state.selectedWord}</strong>
              </p>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                请用肢体比划，勿开口说出答案
              </p>
              <PerformerControls
                state={state}
                onPass={onPass}
                onConfirmCorrect={onConfirmCorrect}
              />
            </>
          ) : canSeeWord ? (
            <>
              <p style={{ margin: 0, fontSize: '1.1rem' }}>
                <strong>{performerName}</strong> 正在比划
              </p>
              <p style={{ margin: 0 }}>
                词语（对方队可见）：<strong>{state.selectedWord}</strong>
              </p>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                你所在队为对方，请监督公平
              </p>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: '1.1rem' }}>
                <strong>{performerName}</strong> 正在比划
              </p>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>请观察表演并猜词</p>
            </>
          )}
        </>
      )}

      {state.phase === 'word_select' && !isPerformer && (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          等待 <strong>{performerName}</strong> 选择词语…
        </p>
      )}

      {(state.phase === 'round_end' || state.phase === 'ended') && (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>本回合已结束</p>
      )}
    </div>
  );
}
