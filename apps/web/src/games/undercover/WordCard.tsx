import type { UndercoverPlayerState } from '@game-lobby/game-engine';

interface WordCardProps {
  word: string | null;
  isWhiteBoard: boolean;
}

export function WordCard({ word, isWhiteBoard }: WordCardProps) {
  return (
    <div className="card uc-word-card">
      <div className="uc-word-label">你的词语</div>
      <div className="uc-word-value">
        {isWhiteBoard ? '（白板 — 你没有词语）' : (word ?? '???')}
      </div>
    </div>
  );
}

interface PlayerRosterProps {
  players: UndercoverPlayerState[];
  currentSpeakerId: string | null;
  phase: string;
  voteCount: number;
  aliveCount: number;
}

export function PlayerRoster({
  players,
  currentSpeakerId,
  phase,
  voteCount,
  aliveCount,
}: PlayerRosterProps) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>玩家</h3>
      {phase === 'vote' && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
          已投票 {voteCount}/{aliveCount}
        </p>
      )}
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {players.map((p) => {
          const isSpeaker = p.id === currentSpeakerId && phase === 'describe';
          const roleHint =
            p.isUndercover && !p.isAlive
              ? ' · 卧底'
              : p.isWhiteBoard && !p.isAlive
                ? ' · 白板'
                : !p.isAlive && !p.isUndercover && !p.isWhiteBoard
                  ? ' · 平民'
                  : '';
          return (
            <div
              key={p.id}
              className={`uc-player-row${isSpeaker ? ' uc-speaker-active' : ''}${!p.isAlive ? ' uc-player-eliminated' : ''}`}
            >
              <span>
                {p.name}
                {!p.isAlive && '（已淘汰）'}
                {roleHint}
                {isSpeaker && <span className="uc-badge-speaking">发言中</span>}
              </span>
              <span className="uc-player-desc">{p.description ?? '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
