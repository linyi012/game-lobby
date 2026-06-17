interface WordHintSlot {
  display: string;
  index: number;
  revealed: boolean;
}

interface WordHintBarProps {
  slots: WordHintSlot[];
  interactive?: boolean;
  canReveal?: boolean;
  onRevealChar?: (index: number) => void;
}

export function buildPainterHintSlots(
  word: string,
  revealedIndices: number[],
): WordHintSlot[] {
  const revealed = new Set(revealedIndices);
  return [...word].map((ch, index) => ({
    display: revealed.has(index) ? ch : '_',
    index,
    revealed: revealed.has(index),
  }));
}

export function buildGuessHintSlots(wordHint: string): WordHintSlot[] {
  return wordHint.split(' ').map((display, index) => ({
    display,
    index,
    revealed: display !== '_',
  }));
}

export function WordHintBar({
  slots,
  interactive = false,
  canReveal = false,
  onRevealChar,
}: WordHintBarProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
      {slots.map((slot) => {
        const clickable =
          interactive && canReveal && !slot.revealed && slot.display === '_' && onRevealChar;

        if (clickable) {
          return (
            <button
              key={slot.index}
              type="button"
              className="btn btn-secondary"
              onClick={() => onRevealChar(slot.index)}
              title={`揭示第 ${slot.index + 1} 字`}
              style={{
                minWidth: '2rem',
                padding: '0.25rem 0.5rem',
                fontFamily: 'monospace',
                fontSize: '1.1rem',
              }}
            >
              _
            </button>
          );
        }

        return (
          <span
            key={slot.index}
            style={{
              minWidth: '2rem',
              textAlign: 'center',
              padding: '0.25rem 0.5rem',
              fontFamily: 'monospace',
              fontSize: '1.1rem',
              borderRadius: 6,
              background: slot.revealed ? 'rgba(34,197,94,0.15)' : 'var(--surface-2)',
            }}
          >
            {slot.display}
          </span>
        );
      })}
    </div>
  );
}
