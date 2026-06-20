import { CHARACTER_LABELS, type LifeboatGameState } from '@game-lobby/game-engine';

interface Props {
  state: LifeboatGameState;
}

export function ScoreReveal({ state }: Props) {
  if (state.phase !== 'ended' || !state.scores) return null;

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 0.75rem' }}>最终计分</h3>
      <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem' }}>{state.message}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '0.5rem' }}>玩家</th>
            <th>物资</th>
            <th>存活</th>
            <th>爱情</th>
            <th>仇恨</th>
            <th>加成</th>
            <th>总分</th>
          </tr>
        </thead>
        <tbody>
          {state.scores.map((s) => (
            <tr key={s.playerId} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '0.5rem' }}>
                {s.playerName}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  爱 {CHARACTER_LABELS[s.loveCharacterId]} · 恨 {CHARACTER_LABELS[s.hateCharacterId]}
                </div>
              </td>
              <td>{s.supplyPoints}</td>
              <td>{s.survivalPoints}</td>
              <td>{s.lovePoints}</td>
              <td>{s.hatePoints}</td>
              <td>{s.bonusPoints}</td>
              <td style={{ fontWeight: 600 }}>{s.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
