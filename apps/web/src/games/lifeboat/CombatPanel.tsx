import type { CombatSide, LifeboatGameState } from '@game-lobby/game-engine';

interface Props {
  state: LifeboatGameState;
  myMemberId: string | null;
  onSupport: (side: CombatSide) => void;
}

export function CombatPanel({ state, myMemberId, onSupport }: Props) {
  const combat = state.combat;
  if (!combat || state.phase !== 'combat') return null;

  const attacker = state.players.find((p) => p.id === combat.attackerId);
  const defender = state.players.find((p) => p.id === combat.defenderId);
  const isFighter = myMemberId === combat.attackerId || myMemberId === combat.defenderId;
  const mySupport = myMemberId ? combat.supports[myMemberId] : undefined;
  const canSupport =
    myMemberId &&
    !isFighter &&
    state.players.find((p) => p.id === myMemberId && !p.isDead && !p.isUnconscious);

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem', borderColor: 'var(--danger, #f44336)' }}>
      <h3 style={{ margin: '0 0 0.75rem' }}>战斗</h3>
      <p style={{ margin: '0 0 0.75rem' }}>
        {attacker?.name} vs {defender?.name}
        {combat.reason === 'steal' ? '（抢夺）' : '（换位）'}
      </p>
      {canSupport && mySupport === undefined && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button type="button" className="btn" onClick={() => onSupport('attacker')}>
            支持 {attacker?.name}
          </button>
          <button type="button" className="btn" onClick={() => onSupport('defender')}>
            支持 {defender?.name}
          </button>
          <button type="button" className="btn" onClick={() => onSupport('none')}>
            旁观
          </button>
        </div>
      )}
      {mySupport !== undefined && (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>已选择支持方，等待其他玩家…</p>
      )}
      {isFighter && (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>等待其他人选择支持方…</p>
      )}
    </div>
  );
}
