import type { CSSProperties } from 'react';
import type { WerewolfPlayerState } from '@game-lobby/game-engine';

interface WerewolfTableProps {
  players: WerewolfPlayerState[];
  myMemberId: string | null;
  selectable: boolean;
  selectedId: string | null;
  voteCounts?: Record<string, number>;
  currentSpeakerId?: string | null;
  onSelect?: (playerId: string) => void;
}

function seatStyle(index: number, total: number, viewerSeat: number): CSSProperties {
  const adjusted = (index - viewerSeat + total) % total;
  const angle = (adjusted / total) * 2 * Math.PI + Math.PI / 2;
  const rx = 42;
  const ry = 36;
  const x = 50 + rx * Math.cos(angle);
  const y = 50 + ry * Math.sin(angle);
  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: 'translate(-50%, -50%)',
  };
}

export function WerewolfTable({
  players,
  myMemberId,
  selectable,
  selectedId,
  voteCounts = {},
  currentSpeakerId,
  onSelect,
}: WerewolfTableProps) {
  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  const me = players.find((p) => p.id === myMemberId);
  const viewerSeat = me?.seatIndex ?? 0;

  return (
    <div className="ww-table-wrap">
      <div className="ww-table-surface">
        <div className="ww-table-center" aria-hidden>
          🌕
        </div>
        {sorted.map((p) => {
          const isMe = p.id === myMemberId;
          const isSelected = p.id === selectedId;
          const isSpeaker = p.id === currentSpeakerId;
          const votes = voteCounts[p.id] ?? 0;
          const canSelect = selectable && p.isAlive && p.id !== myMemberId;

          return (
            <button
              key={p.id}
              type="button"
              className={[
                'ww-seat',
                !p.isAlive && 'ww-seat-dead',
                isMe && 'ww-seat-me',
                isSelected && 'ww-seat-selected',
                isSpeaker && 'ww-seat-speaking',
                canSelect && 'ww-seat-selectable',
              ]
                .filter(Boolean)
                .join(' ')}
              style={seatStyle(p.seatIndex, sorted.length, viewerSeat)}
              disabled={!canSelect}
              onClick={() => canSelect && onSelect?.(p.id)}
            >
              <span className="ww-seat-avatar">{p.isBot ? '🤖' : '👤'}</span>
              <span className="ww-seat-name">{p.name}</span>
              <span className="ww-seat-number">{p.seatIndex + 1}</span>
              {!p.isAlive && <span className="ww-seat-skull">💀</span>}
              {votes > 0 && <span className="ww-seat-votes">{votes}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
