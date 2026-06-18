import { useState } from 'react';
import type { SpeechMessage } from '@game-lobby/game-engine';

interface DayChatPanelProps {
  speeches: SpeechMessage[];
  round: number;
  canSpeak: boolean;
  onSpeech: (text: string) => void;
  onEndSpeaking: () => void;
}

export function DayChatPanel({
  speeches,
  round,
  canSpeak,
  onSpeech,
  onEndSpeaking,
}: DayChatPanelProps) {
  const [text, setText] = useState('');
  const [viewingRound, setViewingRound] = useState(round);
  const rounds = [...new Set(speeches.map((s) => s.round))].sort((a, b) => a - b);
  const displayed = speeches.filter((s) => s.round === viewingRound);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSpeech(trimmed);
    setText('');
  }

  return (
    <div className="card uc-chat-panel ww-chat-panel">
      <h3 style={{ marginTop: 0 }}>白天讨论</h3>
      {rounds.length > 1 && (
        <div className="uc-round-picker">
          <span className="uc-round-picker-label">轮次</span>
          <div className="uc-round-tabs">
            {rounds.map((r) => (
              <button
                key={r}
                type="button"
                className={`uc-round-tab ${r === viewingRound ? 'uc-round-tab-active' : ''}`}
                onClick={() => setViewingRound(r)}
              >
                第 {r} 天
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="uc-chat-feed">
        {displayed.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>暂无发言</p>
        )}
        {displayed.map((s) => (
          <div key={s.id} className="uc-chat-message">
            <strong>{s.playerName}</strong>：{s.text}
          </div>
        ))}
      </div>
      {canSpeak && (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.5rem' }}>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入发言…"
            maxLength={200}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn">
              发送
            </button>
            <button type="button" className="btn btn-secondary" onClick={onEndSpeaking}>
              发言结束
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
