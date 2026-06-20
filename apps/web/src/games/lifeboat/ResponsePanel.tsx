import type { LifeboatGameState } from '@game-lobby/game-engine';

interface Props {
  state: LifeboatGameState;
  myMemberId: string | null;
  onRespond: (accept: boolean) => void;
}

export function ResponsePanel({ state, myMemberId, onRespond }: Props) {
  const req = state.pendingRequest;
  if (!req || state.phase !== 'pending_response') return null;
  const isTarget = req.targetId === myMemberId;
  const initiator = state.players.find((p) => p.id === req.initiatorId);

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem', borderColor: 'var(--warning, #ff9800)' }}>
      <h3 style={{ margin: '0 0 0.75rem' }}>
        {req.type === 'swap' ? '换位请求' : '抢夺请求'}
      </h3>
      <p style={{ margin: '0 0 0.75rem' }}>
        {initiator?.name} 向你发起{req.type === 'swap' ? '换位' : '抢夺'}
      </p>
      {isTarget ? (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn" onClick={() => onRespond(true)}>
            同意
          </button>
          <button type="button" className="btn" onClick={() => onRespond(false)}>
            拒绝（战斗）
          </button>
        </div>
      ) : (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>等待对方回应…</p>
      )}
    </div>
  );
}
