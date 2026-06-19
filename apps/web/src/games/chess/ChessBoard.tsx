import { useMemo, useState } from 'react';
import type { ChessGameState, ChessMoveOption, ChessPromotion } from '@game-lobby/game-engine';
import { getChessLegalMoves } from '@game-lobby/game-engine';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const PIECE_GLYPH: Record<string, string> = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

const PROMOTION_LABELS: { piece: ChessPromotion; label: string; glyph: string }[] = [
  { piece: 'q', label: '后', glyph: '♕' },
  { piece: 'r', label: '车', glyph: '♖' },
  { piece: 'b', label: '象', glyph: '♗' },
  { piece: 'n', label: '马', glyph: '♘' },
];

function parseBoard(fen: string): (string | null)[][] {
  const rows = fen.split(' ')[0]!.split('/');
  return rows.map((row) => {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) cells.push(null);
      } else {
        cells.push(ch);
      }
    }
    return cells;
  });
}

function squareName(fileIndex: number, rankIndex: number, flipped: boolean): string {
  const file = flipped ? FILES[7 - fileIndex]! : FILES[fileIndex]!;
  const rank = flipped ? rankIndex + 1 : 8 - rankIndex;
  return `${file}${rank}`;
}

interface Props {
  state: ChessGameState;
  myColor: 'w' | 'b' | null;
  canPlay: boolean;
  onMove: (from: string, to: string, promotion?: ChessPromotion) => void;
}

export function ChessBoard({ state, myColor, canPlay, onMove }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(
    null,
  );

  const flipped = myColor === 'b';
  const board = useMemo(() => parseBoard(state.fen), [state.fen]);

  const legalMoves = useMemo(() => {
    if (!selected) return [] as ChessMoveOption[];
    return getChessLegalMoves(state, selected);
  }, [state, selected]);

  const legalTargets = useMemo(() => new Set(legalMoves.map((m) => m.to)), [legalMoves]);

  const displayRows = useMemo(() => {
    const rows = flipped ? [...board].reverse() : board;
    return rows.map((row) => (flipped ? [...row].reverse() : row));
  }, [board, flipped]);

  function handleSquareClick(fileIndex: number, rankIndex: number, piece: string | null) {
    if (!canPlay) return;

    const sq = squareName(fileIndex, rankIndex, flipped);

    if (selected && legalTargets.has(sq)) {
      const move = legalMoves.find((m) => m.to === sq);
      const needsPromotion =
        move?.promotion != null ||
        (selected[1] === '2' && sq[1] === '8') ||
        (selected[1] === '7' && sq[1] === '1');

      if (needsPromotion) {
        setPendingPromotion({ from: selected, to: sq });
        setSelected(null);
        return;
      }

      onMove(selected, sq);
      setSelected(null);
      return;
    }

    if (piece && myColor && isOwnPiece(piece, myColor)) {
      setSelected(sq);
      return;
    }

    setSelected(null);
  }

  function isOwnPiece(piece: string, color: 'w' | 'b'): boolean {
    return color === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
  }

  function confirmPromotion(piece: ChessPromotion) {
    if (!pendingPromotion) return;
    onMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
  }

  const lastTo = state.lastMove?.to ?? null;

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          aspectRatio: '1',
          maxWidth: 480,
          border: '3px solid #5c4033',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}
      >
        {displayRows.map((row, rankIndex) =>
          row.map((piece, fileIndex) => {
            const isLight = (rankIndex + fileIndex) % 2 === 0;
            const sq = squareName(fileIndex, rankIndex, flipped);
            const isSelected = selected === sq;
            const isTarget = legalTargets.has(sq);
            const isLast = lastTo === sq;

            return (
              <button
                key={sq}
                type="button"
                disabled={!canPlay && !piece}
                onClick={() => handleSquareClick(fileIndex, rankIndex, piece)}
                style={{
                  aspectRatio: '1',
                  border: 'none',
                  padding: 0,
                  background: isSelected
                    ? 'rgba(59, 130, 246, 0.55)'
                    : isTarget
                      ? 'rgba(34, 197, 94, 0.45)'
                      : isLight
                        ? '#f0d9b5'
                        : '#b58863',
                  outline: isLast ? '2px solid rgba(59, 130, 246, 0.8)' : undefined,
                  cursor: canPlay ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'clamp(1.5rem, 5vw, 2.25rem)',
                  lineHeight: 1,
                  userSelect: 'none',
                }}
              >
                {piece ? PIECE_GLYPH[piece] : isTarget ? '·' : null}
              </button>
            );
          }),
        )}
      </div>

      {pendingPromotion && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
          }}
        >
          <div
            className="card"
            style={{
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <strong>升变</strong>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {PROMOTION_LABELS.map(({ piece, label, glyph }) => (
                <button
                  key={piece}
                  type="button"
                  className="btn"
                  onClick={() => confirmPromotion(piece)}
                  style={{ fontSize: '1.75rem', minWidth: 48 }}
                  title={label}
                >
                  {glyph}
                </button>
              ))}
            </div>
            <button type="button" className="btn" onClick={() => setPendingPromotion(null)}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
