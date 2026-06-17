import type { DrawGuessGameState } from '@game-lobby/game-engine';

interface WordSelectPanelProps {
  state: DrawGuessGameState;
  onSelect: (word: string) => void;
}

export function WordSelectPanel({ state, onSelect }: WordSelectPanelProps) {
  const remaining = Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000));

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h3 style={{ marginTop: 0 }}>请选择要画的词语</h3>
      <p style={{ color: 'var(--text-muted)' }}>剩余 {remaining} 秒，超时将随机选择</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
        {state.wordOptions.map((word) => (
          <button key={word} type="button" className="btn" onClick={() => onSelect(word)}>
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}
