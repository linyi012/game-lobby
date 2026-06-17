import type { DrawGuessGameState } from '@game-lobby/game-engine';

interface RoundSummaryProps {
  state: DrawGuessGameState;
}

export function RoundSummary({ state }: RoundSummaryProps) {
  const remaining = Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000));
  const entries = Object.entries(state.roundScores);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>回合结束</h3>
      <p>
        正确答案：<strong>{state.selectedWord}</strong>
      </p>
      {entries.length > 0 ? (
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
          {entries.map(([id, score]) => {
            const name = state.players.find((p) => p.id === id)?.name ?? id;
            return (
              <li key={id}>
                {name}：+{score} 分
              </li>
            );
          })}
        </ul>
      ) : (
        <p style={{ color: 'var(--text-muted)' }}>本轮无人猜中</p>
      )}
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        {state.phase === 'ended' ? '游戏结束' : `${remaining} 秒后进入下一轮`}
      </p>
    </div>
  );
}
