import type { EliminatedRole } from '@game-lobby/game-engine';

function roleLabel(role: EliminatedRole): string {
  if (role === 'undercover') return '卧底';
  if (role === 'whiteboard') return '白板';
  return '平民';
}

interface RevealBannerProps {
  message: string;
  lastEliminated: { name: string; role: EliminatedRole } | null;
  gameContinues: boolean | null;
  onContinue: () => void;
}

export function RevealBanner({
  message,
  lastEliminated,
  gameContinues,
  onContinue,
}: RevealBannerProps) {
  return (
    <div className="card uc-reveal-banner">
      <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>{message}</p>
      {lastEliminated && (
        <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)' }}>
          {lastEliminated.name} 的身份：{roleLabel(lastEliminated.role)}
        </p>
      )}
      {gameContinues === true && (
        <button type="button" className="btn" onClick={onContinue}>
          继续下一轮
        </button>
      )}
      {gameContinues === false && (
        <p style={{ margin: 0, color: 'var(--success)', fontWeight: 600 }}>本局结束</p>
      )}
    </div>
  );
}
