import { useState } from 'react';
import {
  CHARACTER_BY_ID,
  supplyCardLabel,
  type LifeboatActionPayload,
  type LifeboatGameState,
} from '@game-lobby/game-engine';

interface Props {
  state: LifeboatGameState;
  myMemberId: string | null;
  onAction: (action: LifeboatActionPayload) => void;
}

export function ActionPanel({ state, myMemberId, onAction }: Props) {
  const [targetId, setTargetId] = useState('');
  const sorted = [...state.players]
    .filter((p) => !p.isDead)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  const actor = sorted[state.actionPlayerIndex];
  const isMyTurn = actor?.id === myMemberId && actor && !actor.isUnconscious;
  const me = state.players.find((p) => p.id === myMemberId);
  const others = sorted.filter((p) => p.id !== myMemberId && !p.isDead);
  const specialCards = me?.hand.filter((c) => c.specialAction || c.kind === 'parasol') ?? [];

  if (!isMyTurn) {
    return (
      <div className="card" style={{ padding: '1rem' }}>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          {actor?.name ?? ''} 的行动回合…
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <h3 style={{ margin: '0 0 0.75rem' }}>行动阶段</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <button type="button" className="btn" onClick={() => onAction({ type: 'row' })}>
          划船
        </button>
        <button type="button" className="btn" onClick={() => onAction({ type: 'pass' })}>
          跳过
        </button>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.85rem' }}>目标玩家</label>
        <select
          className="input"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          style={{ display: 'block', marginTop: 4, width: '100%', maxWidth: 280 }}
        >
          <option value="">选择…</option>
          {others.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({CHARACTER_BY_ID[p.characterId]?.name ?? p.characterId})
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          type="button"
          className="btn"
          disabled={!targetId}
          onClick={() => onAction({ type: 'swap', targetPlayerId: targetId })}
        >
          换位
        </button>
        <button
          type="button"
          className="btn"
          disabled={!targetId || CHARACTER_BY_ID[others.find((o) => o.id === targetId)?.characterId ?? 'captain']?.stealImmune}
          onClick={() => onAction({ type: 'steal', targetPlayerId: targetId })}
        >
          抢夺
        </button>
      </div>

      {specialCards.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontSize: '0.85rem', margin: '0 0 0.5rem' }}>特殊行动</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {specialCards.map((c) => (
              <button
                key={c.id}
                type="button"
                className="btn"
                onClick={() => onAction({ type: 'special', specialCardId: c.id })}
              >
                {supplyCardLabel(c)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
