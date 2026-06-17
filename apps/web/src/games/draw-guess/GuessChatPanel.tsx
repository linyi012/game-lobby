import type { GuessEntry } from '@game-lobby/game-engine';

interface GuessChatPanelProps {
  guesses: GuessEntry[];
  canGuess: boolean;
  onGuess: (text: string) => void;
}

export function GuessChatPanel({ guesses, canGuess, onGuess }: GuessChatPanelProps) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 200 }}>
      <h3 style={{ marginTop: 0 }}>猜词</h3>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          marginBottom: '0.75rem',
          maxHeight: 200,
        }}
      >
        {guesses.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>暂无猜词记录</p>
        )}
        {guesses.map((g) => (
          <div
            key={g.id}
            style={{
              fontSize: '0.9rem',
              padding: '0.35rem 0.5rem',
              borderRadius: 6,
              background: g.correct ? 'rgba(34,197,94,0.15)' : 'var(--surface-2)',
            }}
          >
            <strong>{g.playerName}</strong>：{g.correct ? '（已猜中）' : g.text}
            {g.correct && <span style={{ color: 'var(--success)', marginLeft: 6 }}>✓</span>}
          </div>
        ))}
      </div>
      {canGuess ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const text = String(fd.get('guess') ?? '').trim();
            if (!text) return;
            onGuess(text);
            e.currentTarget.reset();
          }}
          style={{ display: 'flex', gap: '0.5rem' }}
        >
          <input className="input" name="guess" placeholder="输入你的答案…" autoComplete="off" />
          <button type="submit" className="btn">
            发送
          </button>
        </form>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
          画家不能猜词，旁观者仅可观看
        </p>
      )}
    </div>
  );
}
