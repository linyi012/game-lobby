import { ROLE_LABELS, type EliminationRecord } from '@game-lobby/game-engine';

interface DeathRevealBannerProps {
  message: string;
  lastEliminated: EliminationRecord | null;
  nightDeaths: string[];
  playerNames: Record<string, string>;
  gameContinues: boolean | null;
  onContinue: () => void;
}

export function DeathRevealBanner({
  message,
  lastEliminated,
  nightDeaths,
  playerNames,
  gameContinues,
  onContinue,
}: DeathRevealBannerProps) {
  return (
    <div className="card uc-reveal-banner ww-reveal-banner">
      <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>{message}</p>
      {nightDeaths.length > 0 && (
        <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)' }}>
          昨夜死亡：{nightDeaths.map((id) => playerNames[id] ?? id).join('、')}
        </p>
      )}
      {lastEliminated && (
        <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)' }}>
          {lastEliminated.name} 的身份：{ROLE_LABELS[lastEliminated.role]}
        </p>
      )}
      {gameContinues === true && (
        <button type="button" className="btn" onClick={onContinue}>
          继续
        </button>
      )}
      {gameContinues === false && (
        <p style={{ margin: 0, color: 'var(--success)', fontWeight: 600 }}>本局结束</p>
      )}
    </div>
  );
}
