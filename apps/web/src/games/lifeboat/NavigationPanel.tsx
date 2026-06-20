import type { LifeboatGameState } from '@game-lobby/game-engine';

interface Props {
  state: LifeboatGameState;
  myMemberId: string | null;
  onPick: (cardIndex: number) => void;
}

export function NavigationPanel({ state, myMemberId, onPick }: Props) {
  if (state.phase !== 'navigation_pick') return null;
  const isNavigator = state.navigatorId === myMemberId;
  const choices = state.navigationChoices;

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 0.75rem' }}>航海阶段</h3>
      <p style={{ color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
        {isNavigator ? '选择一张划船牌执行' : '舵手正在选择航海牌…'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {choices.map((card, idx) => (
          <button
            key={card.id}
            type="button"
            className="btn"
            disabled={!isNavigator}
            onClick={() => onPick(idx)}
          >
            {card.label}
          </button>
        ))}
      </div>
      {choices.length === 0 && (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>无可用划船牌</p>
      )}
    </div>
  );
}
