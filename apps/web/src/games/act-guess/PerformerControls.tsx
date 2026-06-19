import { useState } from 'react';
import type { ActGuessGameState } from '@game-lobby/game-engine';
import { getConfirmableGuessers } from '@game-lobby/game-engine';

interface PerformerControlsProps {
  state: ActGuessGameState;
  onPass: () => void;
  onConfirmCorrect: (playerId: string) => void;
}

export function PerformerControls({ state, onPass, onConfirmCorrect }: PerformerControlsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const guessers = getConfirmableGuessers(state).map((id: string) => {
    const player = state.players.find((p) => p.id === id);
    return { id, name: player?.name ?? id };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={onPass}>
          过
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setShowPicker((v) => !v)}
          disabled={guessers.length === 0}
        >
          回答正确
        </button>
      </div>

      {showPicker && guessers.length > 0 && (
        <div
          className="card"
          style={{
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>选择猜中的队友</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
            {guessers.map((g: { id: string; name: string }) => (
              <button
                key={g.id}
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onConfirmCorrect(g.id);
                  setShowPicker(false);
                }}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
