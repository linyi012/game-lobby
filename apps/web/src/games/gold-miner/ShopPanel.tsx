import { SHOP_PRICES, type GoldMinerGameState, type ShopItemType } from '@game-lobby/game-engine';

const SHOP_LABELS: Record<ShopItemType, { name: string; desc: string }> = {
  dynamite: { name: '炸药', desc: '收回途中丢弃附着物' },
  strength: { name: '力量药水', desc: '下一钩收回速度 ×2' },
  lucky: { name: '幸运草', desc: '下一钩福袋奖励更好' },
};

interface Props {
  state: GoldMinerGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onBuy: (item: ShopItemType) => void;
  onDone: () => void;
}

export function ShopPanel({ state, myMemberId, isSpectator, onBuy, onDone }: Props) {
  const me = state.players.find((p) => p.id === myMemberId);
  const shopDone = myMemberId != null && state.shopDoneIds.includes(myMemberId);
  const canAct = !isSpectator && me && !shopDone;

  const countdown = Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000));

  return (
    <div
      style={{
        padding: '1rem',
        background: 'rgba(0,0,0,0.04)',
        borderRadius: 8,
        marginTop: '1rem',
      }}
    >
      <h3 style={{ margin: '0 0 0.75rem' }}>道具商店</h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
        剩余 {countdown}s — 用总分购买道具
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        {(Object.keys(SHOP_PRICES) as ShopItemType[]).map((item) => {
          const price = SHOP_PRICES[item];
          const label = SHOP_LABELS[item];
          const affordable = (me?.totalScore ?? 0) >= price;
          return (
            <button
              key={item}
              type="button"
              className="btn"
              disabled={!canAct || !affordable}
              onClick={() => onBuy(item)}
              style={{ flex: '1 1 140px', textAlign: 'left' }}
            >
              <div style={{ fontWeight: 600 }}>{label.name}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>{label.desc}</div>
              <div style={{ fontSize: '0.85rem', marginTop: 4 }}>${price}</div>
            </button>
          );
        })}
      </div>

      {me && (
        <p style={{ margin: '0 0 0.75rem' }}>
          余额：<strong>${me.totalScore}</strong>
          {' · '}
          库存：炸药 {me.inventory.dynamite} / 力量 {me.inventory.strength} / 幸运 {me.inventory.lucky}
        </p>
      )}

      {canAct && (
        <button type="button" className="btn btn-primary" onClick={onDone}>
          完成购物
        </button>
      )}

      {shopDone && <p style={{ margin: 0, color: 'var(--text-muted)' }}>已确认购物，等待其他玩家…</p>}

      <ul style={{ margin: '1rem 0 0', paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
        {state.players.map((p) => (
          <li key={p.id}>
            {p.name}: ${p.totalScore}
            {state.shopDoneIds.includes(p.id) ? ' ✓' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
