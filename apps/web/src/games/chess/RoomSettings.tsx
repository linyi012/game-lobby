import { useEffect, useState } from 'react';
import type { ChessGameState } from '@game-lobby/game-engine';
import type { RoomSettingsProps } from '../registry';

export function ChessRoomSettings({
  isHost,
  isPlaying,
  isIntermission,
  gameState,
  onStartOptionsChange,
}: RoomSettingsProps) {
  const [mainTimeSec, setMainTimeSec] = useState(600);
  const [incrementSec, setIncrementSec] = useState(5);

  useEffect(() => {
    onStartOptionsChange({ mainTimeSec, incrementSec });
  }, [mainTimeSec, incrementSec, onStartOptionsChange]);

  useEffect(() => {
    if (!isIntermission || !gameState) return;
    const s = gameState as ChessGameState;
    setMainTimeSec(Math.round(s.timeSettings.mainTimeMs / 1000));
    setIncrementSec(Math.round(s.timeSettings.incrementMs / 1000));
  }, [gameState, isIntermission]);

  if (!isHost && !(isPlaying && gameState)) return null;

  if (!isHost && isPlaying && gameState) {
    const s = gameState as ChessGameState;
    return (
      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        本局：{Math.round(s.timeSettings.mainTimeMs / 1000)} 秒 +{' '}
        {Math.round(s.timeSettings.incrementMs / 1000)} 秒/步
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.9rem' }}>
        主时间（秒）
        <input
          className="input"
          type="number"
          min={60}
          max={3600}
          step={60}
          value={mainTimeSec}
          disabled={isPlaying}
          onChange={(e) => setMainTimeSec(Number(e.target.value))}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.9rem' }}>
        每步加时（秒）
        <input
          className="input"
          type="number"
          min={0}
          max={60}
          value={incrementSec}
          disabled={isPlaying}
          onChange={(e) => setIncrementSec(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
