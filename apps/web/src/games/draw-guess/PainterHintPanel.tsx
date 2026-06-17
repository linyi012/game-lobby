import type { PainterHintEntry } from '@game-lobby/game-engine';
import { maxRevealableChars } from '@game-lobby/game-engine';
import { WordHintBar, buildPainterHintSlots } from './WordHintBar';

interface PainterHintPanelProps {
  hintsRemaining: number;
  maxHints: number;
  selectedWord: string;
  revealedIndices: number[];
  painterHints: PainterHintEntry[];
  canSendHints: boolean;
  onPainterHint: (text: string) => void;
  onRevealChar: (index: number) => void;
}

function formatHintEntry(h: PainterHintEntry): string {
  if (h.type === 'text') return h.text ?? '';
  if (h.type === 'reveal' && h.charIndex != null) {
    return `揭示了第 ${h.charIndex + 1} 字：${h.char ?? ''}`;
  }
  return '';
}

export function PainterHintHistory({ hints }: { hints: PainterHintEntry[] }) {
  if (hints.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>画家提示</div>
      {hints.map((h) => (
        <div
          key={h.id}
          style={{
            fontSize: '0.9rem',
            padding: '0.35rem 0.5rem',
            borderRadius: 6,
            background: h.type === 'reveal' ? 'rgba(59,130,246,0.12)' : 'var(--surface-2)',
          }}
        >
          {formatHintEntry(h)}
        </div>
      ))}
    </div>
  );
}

export function PainterHintPanel({
  hintsRemaining,
  maxHints,
  selectedWord,
  revealedIndices,
  painterHints,
  canSendHints,
  onPainterHint,
  onRevealChar,
}: PainterHintPanelProps) {
  const canReveal =
    canSendHints &&
    hintsRemaining > 0 &&
    revealedIndices.length < maxRevealableChars(selectedWord.length);
  const slots = buildPainterHintSlots(selectedWord, revealedIndices);

  return (
    <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>发送提示</h3>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          剩余提示：{hintsRemaining}/{maxHints}
        </span>
      </div>

      <div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
          点击下划线揭示一字
        </div>
        <WordHintBar
          slots={slots}
          interactive
          canReveal={canReveal}
          onRevealChar={onRevealChar}
        />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const text = String(fd.get('hint') ?? '').trim();
          if (!text || !canSendHints || hintsRemaining <= 0) return;
          onPainterHint(text);
          e.currentTarget.reset();
        }}
        style={{ display: 'flex', gap: '0.5rem' }}
      >
        <input
          className="input"
          name="hint"
          placeholder="输入文字提示…"
          autoComplete="off"
          disabled={!canSendHints || hintsRemaining <= 0}
          maxLength={32}
        />
        <button
          type="submit"
          className="btn"
          disabled={!canSendHints || hintsRemaining <= 0}
        >
          发送提示
        </button>
      </form>

      <PainterHintHistory hints={painterHints} />
    </div>
  );
}
