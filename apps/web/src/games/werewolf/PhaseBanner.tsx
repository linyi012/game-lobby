import type { WerewolfPhase } from '@game-lobby/game-engine';

const PHASE_LABELS: Record<WerewolfPhase, string> = {
  night_wolf: '狼人行动',
  night_seer: '预言家查验',
  night_witch: '女巫行动',
  night_guard: '守卫守护',
  night_resolve: '夜晚结算',
  day_announce: '天亮公布',
  day_discuss: '白天讨论',
  day_vote: '放逐投票',
  reveal: '投票揭晓',
  hunter_shoot: '猎人开枪',
  ended: '游戏结束',
};

interface PhaseBannerProps {
  phase: WerewolfPhase;
  round: number;
  message: string;
  phaseDeadline: number | null;
  isNight: boolean;
}

function formatCountdown(deadline: number | null): string {
  if (deadline == null) return '';
  const sec = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PhaseBanner({ phase, round, message, phaseDeadline, isNight }: PhaseBannerProps) {
  const countdown = formatCountdown(phaseDeadline);
  const dayNight = isNight ? `第 ${round} 夜` : phase === 'ended' ? '' : `第 ${round} 天`;

  return (
    <div className="ww-phase-banner">
      <div className="ww-phase-title">
        {dayNight && <span className="ww-phase-round">{dayNight}</span>}
        <span className="ww-phase-name">{PHASE_LABELS[phase]}</span>
        {countdown && <span className="ww-phase-timer">⏱ {countdown}</span>}
      </div>
      <p className="ww-phase-message">{message}</p>
    </div>
  );
}
