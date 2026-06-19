import type { ChessGameState, ChessPromotion } from '@game-lobby/game-engine';
import { ChessBoard } from './ChessBoard';

interface Props {
  state: ChessGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onMove: (from: string, to: string, promotion?: ChessPromotion) => void;
  onResign: () => void;
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function endReasonLabel(reason: ChessGameState['endReason']): string {
  switch (reason) {
    case 'checkmate':
      return '将杀';
    case 'stalemate':
      return '逼和';
    case 'draw':
      return '和棋';
    case 'resignation':
      return '认输';
    case 'timeout':
      return '超时';
    default:
      return '';
  }
}

export function ChessGame({ state, myMemberId, isSpectator, onMove, onResign }: Props) {
  const me = state.players.find((p) => p.id === myMemberId);
  const current = state.players.find((p) => p.color === state.currentColor);
  const isMyTurn =
    !isSpectator && current?.id === myMemberId && state.phase === 'playing';
  const ended = state.phase === 'ended';
  const winner =
    state.winnerId != null
      ? (state.players.find((p) => p.id === state.winnerId) ?? null)
      : null;
  const iWon = state.winnerId != null && state.winnerId === myMemberId;

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}
      >
        <ChessBoard
          state={state}
          myColor={me?.color ?? null}
          canPlay={isMyTurn}
          onMove={onMove}
        />

        <div style={{ flex: '0 1 240px', minWidth: 200 }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>国际象棋</h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {state.message}
          </p>

          {state.lastMove && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              上一步：{state.lastMove.san}
            </p>
          )}

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {state.players.map((p) => {
              const active = current?.id === p.id && !ended;
              return (
                <div
                  key={p.id}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: 8,
                    background: active ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255,255,255,0.04)',
                    border: active
                      ? '1px solid rgba(59, 130, 246, 0.4)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {p.name}
                    {p.id === myMemberId ? '（你）' : ''}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {p.color === 'w' ? '白方' : '黑方'}
                    {active ? ' · 当前回合' : ''}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
                    {formatTime(p.mainTimeMs)}
                    {!ended && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                        +{Math.round(state.timeSettings.incrementMs / 1000)}s/步
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!ended && !isSpectator && me && (
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isMyTurn ? '点击棋子并选择目标格走子' : `等待 ${current?.name ?? '对手'} 走子`}
            </p>
          )}

          {!ended && !isSpectator && me && (
            <button
              type="button"
              className="btn"
              style={{ marginTop: '0.75rem', width: '100%' }}
              onClick={onResign}
            >
              认输
            </button>
          )}

          {isSpectator && !ended && (
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              旁观模式
            </p>
          )}

          {ended && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                borderRadius: 8,
                background: winner ? 'rgba(34, 197, 94, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                border: winner
                  ? '1px solid rgba(34, 197, 94, 0.35)'
                  : '1px solid rgba(148, 163, 184, 0.35)',
              }}
            >
              <strong>
                {winner
                  ? iWon
                    ? '你赢了！'
                    : `${winner.name} 获胜`
                  : endReasonLabel(state.endReason) || '和棋'}
              </strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
