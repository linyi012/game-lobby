import { supplyCardLabel, type LifeboatGameState } from '@game-lobby/game-engine';

interface Props {
  state: LifeboatGameState;
  myMemberId: string | null;
  onPlayWater: (cardId: string) => void;
  onSkip: () => void;
}

export function ThirstPanel({ state, myMemberId, onPlayWater, onSkip }: Props) {
  if (state.phase !== 'thirst_resolve') return null;
  const currentId = state.thirstQueue[0];
  const current = state.players.find((p) => p.id === currentId);
  const isMyTurn = currentId === myMemberId;
  const me = state.players.find((p) => p.id === myMemberId);
  const waterCards = me?.hand.filter((c) => c.kind === 'water') ?? [];

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 0.75rem' }}>口渴结算</h3>
      <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)' }}>
        {current?.name} 需要解渴
      </p>
      {isMyTurn ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {waterCards.map((c) => (
              <button key={c.id} type="button" className="btn" onClick={() => onPlayWater(c.id)}>
                打出 {supplyCardLabel(c)}
              </button>
            ))}
          </div>
          <button type="button" className="btn" onClick={onSkip}>
            无淡水，扣 1 血
          </button>
        </>
      ) : (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>等待 {current?.name} 解渴…</p>
      )}
    </div>
  );
}
