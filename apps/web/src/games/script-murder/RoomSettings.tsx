import { useEffect, useState } from 'react';
import type { RoomSettingsProps } from '../registry';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../lib/api';

export function ScriptMurderRoomSettings({
  isHost,
  isPlaying,
  activePlayerCount,
  onStartOptionsChange,
}: RoomSettingsProps) {
  const { token } = useAuth();
  const [scripts, setScripts] = useState<api.MurderScriptSummary[]>([]);
  const [scriptId, setScriptId] = useState('');

  useEffect(() => {
    if (!token) return;
    api.fetchPlayableMurderScripts(token).then((list) => {
      setScripts(list);
      if (list.length > 0 && !scriptId) {
        setScriptId(list[0]!.id);
      }
    });
  }, [token]);

  useEffect(() => {
    onStartOptionsChange({ scriptId: scriptId || undefined });
  }, [scriptId, onStartOptionsChange]);

  const selected = scripts.find((s) => s.id === scriptId);
  const disabled = !isHost || isPlaying;

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span>选择剧本</span>
        <select
          className="input"
          value={scriptId}
          disabled={disabled}
          onChange={(e) => setScriptId(e.target.value)}
        >
          {scripts.length === 0 && <option value="">暂无可用剧本</option>}
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.isOfficial ? '【官方】' : ''}
              {s.title}（{s.characterCount} 人 · {s.actCount} 幕）
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          {selected.description}
          {activePlayerCount != null && activePlayerCount !== selected.characterCount && (
            <span style={{ color: 'var(--danger)', display: 'block', marginTop: '0.25rem' }}>
              当前玩家 {activePlayerCount} 人，该剧本需要 {selected.characterCount} 人
            </span>
          )}
        </p>
      )}

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
        开局后房主担任主持人，可手动推进阶段或公开线索
      </p>
    </div>
  );
}
