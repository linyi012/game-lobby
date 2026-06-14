import { useState } from 'react';
import type { DaVinciGameState } from '../../types/game';

interface Props {
  state: DaVinciGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onPlay: (targetPlayerId: string, tileIndex: number, position: number) => void;
}

export function DaVinciGame({ state, myMemberId, isSpectator, onPlay }: Props) {
  const me = state.players.find((p) => p.id === myMemberId);
  const current = state.players[state.currentPlayerIndex];
  const isMyTurn = current?.id === myMemberId && state.phase === 'playing';
  const [targetId, setTargetId] = useState(state.players.find((p) => p.id !== myMemberId)?.id ?? '');
  const [tileIndex, setTileIndex] = useState(0);
  const [position, setPosition] = useState(0);

  return (
    <div className="card">
      <h2>达芬奇密码</h2>
      <p style={{ color: 'var(--text-muted)' }}>{state.message}</p>

      {state.lastGuess && (
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          上次猜测：精确 {state.lastGuess.result.exact}，部分 {state.lastGuess.result.colorOnly}
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {state.players.map((p) => (
          <div key={p.id} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '0.75rem' }}>
            <strong>
              {p.name} {p.isBot && '🤖'}
              {p.id === current?.id && ' ← 当前回合'}
            </strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
              {(p.id === myMemberId && !isSpectator
                ? p.rack
                : p.rack.map(() => ({ color: 'black' as const, value: -1 }))
              ).map((tile, i) => (
                <span
                  key={i}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: 6,
                    background: tile.color === 'white' ? '#e2e8f0' : '#1e293b',
                    color: tile.color === 'white' ? '#0f172a' : '#f8fafc',
                    fontSize: '0.85rem',
                  }}
                >
                  {tile.value >= 0 ? `${tile.color === 'white' ? '白' : '黑'}${tile.value}` : '?'}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isMyTurn && me && (
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
          <label>
            猜测对象
            <select
              className="input"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              {state.players
                .filter((p) => p.id !== myMemberId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            出牌索引
            <select
              className="input"
              value={tileIndex}
              onChange={(e) => setTileIndex(Number(e.target.value))}
            >
              {me.rack.map((tile, i) => (
                <option key={i} value={i}>
                  {tile.color === 'white' ? '白' : '黑'}
                  {tile.value}
                </option>
              ))}
            </select>
          </label>
          <label>
            放置位置
            <input
              className="input"
              type="number"
              min={0}
              max={me.rack.length}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
            />
          </label>
          <button className="btn" onClick={() => onPlay(targetId, tileIndex, position)}>
            出牌
          </button>
        </div>
      )}

      {state.phase === 'ended' && (
        <div style={{ marginTop: '1rem', color: 'var(--success)', fontWeight: 600 }}>
          {state.message}
        </div>
      )}
    </div>
  );
}
