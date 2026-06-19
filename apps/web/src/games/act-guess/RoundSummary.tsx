import type { ActGuessGameState } from '@game-lobby/game-engine';

interface RoundSummaryProps {
  state: ActGuessGameState;
}

export function RoundSummary({ state }: RoundSummaryProps) {
  const remaining = Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000));

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>回合结束</h3>
      <p>
        正确答案：<strong>{state.selectedWord}</strong>
      </p>
      {state.teams?.enabled && state.roundTeamScores ? (
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
          <li>A 队：+{state.roundTeamScores.A} 分</li>
          <li>B 队：+{state.roundTeamScores.B} 分</li>
        </ul>
      ) : Object.entries(state.roundScores).length > 0 ? (
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
          {Object.entries(state.roundScores).map(([id, score]) => {
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
