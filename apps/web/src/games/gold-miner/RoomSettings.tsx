import { useEffect, useState } from 'react';
import type { GoldMinerGameState } from '@game-lobby/game-engine';
import type { RoomSettingsProps } from '../registry';

export function GoldMinerRoomSettings({
  isHost,
  isPlaying,
  isIntermission,
  gameState,
  onStartOptionsChange,
}: RoomSettingsProps) {
  const [maxLevels, setMaxLevels] = useState(5);
  const [levelTimeLimitSec, setLevelTimeLimitSec] = useState(90);
  const [enableMovingPig, setEnableMovingPig] = useState(true);

  useEffect(() => {
    onStartOptionsChange({ maxLevels, levelTimeLimitSec, enableMovingPig });
  }, [maxLevels, levelTimeLimitSec, enableMovingPig, onStartOptionsChange]);

  useEffect(() => {
    if (!isIntermission || !gameState) return;
    const s = gameState as GoldMinerGameState;
    setMaxLevels(s.maxLevels);
    setLevelTimeLimitSec(Math.round(s.levelTimeLimitMs / 1000));
    setEnableMovingPig(s.enableMovingPig);
  }, [gameState, isIntermission]);

  if (!isHost && !(isPlaying && gameState)) return null;

  if (!isHost && isPlaying && gameState) {
    const s = gameState as GoldMinerGameState;
    return (
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {s.maxLevels} 关 · 每关 {Math.round(s.levelTimeLimitMs / 1000)}s
        {s.enableMovingPig ? ' · 移动小猪开启' : ''}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        关卡数
        <input
          type="number"
          min={3}
          max={10}
          value={maxLevels}
          disabled={isPlaying}
          onChange={(e) => setMaxLevels(Number(e.target.value))}
          style={{ width: 64 }}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        每关时限（秒）
        <input
          type="number"
          min={30}
          max={300}
          value={levelTimeLimitSec}
          disabled={isPlaying}
          onChange={(e) => setLevelTimeLimitSec(Number(e.target.value))}
          style={{ width: 64 }}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="checkbox"
          checked={enableMovingPig}
          disabled={isPlaying}
          onChange={(e) => setEnableMovingPig(e.target.checked)}
        />
        启用移动小猪
      </label>
    </div>
  );
}
