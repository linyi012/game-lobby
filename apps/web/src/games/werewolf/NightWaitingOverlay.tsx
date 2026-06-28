interface NightWaitingOverlayProps {
  visible: boolean;
}

export function NightWaitingOverlay({ visible }: NightWaitingOverlayProps) {
  if (!visible) return null;
  return (
    <div className="ww-night-overlay">
      <div className="ww-night-overlay-inner">
        <span className="ww-night-icon">🌙</span>
        <p>夜晚进行中，请闭眼等待…</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          夜间无法操作座位，天亮后自动恢复
        </p>
      </div>
    </div>
  );
}
