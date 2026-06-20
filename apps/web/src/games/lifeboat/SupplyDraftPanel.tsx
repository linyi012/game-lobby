import { supplyCardLabel, type LifeboatGameState } from '@game-lobby/game-engine';

interface Props {
  state: LifeboatGameState;
  myMemberId: string | null;
  onPick: (cardIndex: number) => void;
}

export function SupplyDraftPanel({ state, myMemberId, onPick }: Props) {
  const draft = state.supplyDraft;
  if (!draft) return null;
  const picker = state.players[draft.pickerPlayerIndex];
  const isMyTurn = picker?.id === myMemberId;

  return (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 0.75rem' }}>补给阶段</h3>
      <p style={{ color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
        {isMyTurn ? '请选择一张物资' : `${picker?.name ?? ''} 正在选牌…`}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {draft.cards.map((card, idx) => (
          <button
            key={card.id}
            type="button"
            className="btn"
            disabled={!isMyTurn}
            onClick={() => onPick(idx)}
          >
            {supplyCardLabel(card)}
          </button>
        ))}
      </div>
    </div>
  );
}
