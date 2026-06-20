import { CHARACTER_LABELS, type LifeboatPlayerState } from '@game-lobby/game-engine';

interface Props {
  players: LifeboatPlayerState[];
  myMemberId: string | null;
  highlightPlayerId?: string | null;
}

export function BoatRow({ players, myMemberId, highlightPlayerId }: Props) {
  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        padding: '1rem',
        background: 'var(--surface-2, #1a2332)',
        borderRadius: 8,
        marginBottom: '1rem',
      }}
    >
      <span style={{ width: '100%', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        船头 → 船尾
      </span>
      {sorted.map((p, i) => {
        const isMe = p.id === myMemberId;
        const highlighted = p.id === highlightPlayerId;
        return (
          <div
            key={p.id}
            style={{
              flex: '1 1 120px',
              minWidth: 100,
              padding: '0.75rem',
              borderRadius: 8,
              border: highlighted
                ? '2px solid var(--accent, #4a9eff)'
                : isMe
                  ? '2px solid var(--success, #4caf50)'
                  : '1px solid var(--border, #333)',
              opacity: p.isDead ? 0.45 : p.isUnconscious ? 0.65 : 1,
              background: 'var(--surface, #0f1419)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {i === 0 ? '⛵ ' : ''}
              {i === sorted.length - 1 ? '🧭 ' : ''}
              {p.name}
              {isMe ? ' (我)' : ''}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {CHARACTER_LABELS[p.characterId]}
            </div>
            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
              ❤️ {p.maxHp - p.damage}/{p.maxHp}
              {p.isUnconscious && ' · 昏迷'}
              {p.isDead && ' · 死亡'}
              {p.thirstPending && ' · 口渴'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              手牌 {p.hand.length > 0 ? p.hand.length : p.handCount} · 明牌 {p.faceUp.length}
            </div>
          </div>
        );
      })}
    </div>
  );
}
