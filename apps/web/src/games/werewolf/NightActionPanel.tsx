import { ROLE_LABELS } from '@game-lobby/game-engine';

interface NightActionPanelProps {
  actionLabel: string;
  targetName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  extraActions?: React.ReactNode;
}

export function NightActionPanel({
  actionLabel,
  targetName,
  onConfirm,
  onCancel,
  extraActions,
}: NightActionPanelProps) {
  if (!targetName && !extraActions) return null;

  return (
    <div className="ww-night-action">
      {targetName && (
        <p>
          {actionLabel}：<strong>{targetName}</strong>
        </p>
      )}
      <div className="ww-night-action-buttons">
        {targetName && (
          <>
            <button type="button" className="btn" onClick={onConfirm}>
              确认
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              取消
            </button>
          </>
        )}
        {extraActions}
      </div>
    </div>
  );
}

export function WitchActionButtons({
  canHeal,
  canPoison,
  onHeal,
  onPoison,
  onSkip,
}: {
  canHeal: boolean;
  canPoison: boolean;
  onHeal: () => void;
  onPoison: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="ww-witch-actions">
      {canHeal && (
        <button type="button" className="btn" onClick={onHeal}>
          使用解药
        </button>
      )}
      {canPoison && (
        <button type="button" className="btn btn-secondary" onClick={onPoison}>
          使用毒药
        </button>
      )}
      <button type="button" className="btn btn-secondary" onClick={onSkip}>
        跳过
      </button>
    </div>
  );
}

export function roleLabelForBanner(role: string): string {
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
}
