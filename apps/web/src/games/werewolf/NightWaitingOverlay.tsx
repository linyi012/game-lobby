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
      </div>
    </div>
  );
}
