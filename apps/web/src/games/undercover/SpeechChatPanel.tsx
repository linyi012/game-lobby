import { useMemo } from 'react';
import type { SpeechMessage } from '@game-lobby/game-engine';

interface SpeechChatPanelProps {
  speeches: SpeechMessage[];
  allSpeeches: SpeechMessage[];
  currentRound: number;
  viewingRound: number;
  onViewingRoundChange: (round: number) => void;
  canSpeak: boolean;
  currentSpeakerName: string | null;
  onSend: (text: string) => void;
  onEndSpeaking: () => void;
}

export function SpeechChatPanel({
  speeches,
  allSpeeches,
  currentRound,
  viewingRound,
  onViewingRoundChange,
  canSpeak,
  currentSpeakerName,
  onSend,
  onEndSpeaking,
}: SpeechChatPanelProps) {
  const availableRounds = useMemo(() => {
    const maxSpeechRound = allSpeeches.reduce((max, s) => Math.max(max, s.round), 0);
    const maxRound = Math.max(currentRound, maxSpeechRound, 1);
    return Array.from({ length: maxRound }, (_, i) => i + 1);
  }, [allSpeeches, currentRound]);

  const isViewingPast = viewingRound !== currentRound;

  return (
    <div className="card uc-chat-panel">
      <h3 style={{ margin: '0 0 0.5rem' }}>发言记录</h3>
      <div className="uc-round-picker">
        <span className="uc-round-picker-label">查看轮次</span>
        <div className="uc-round-tabs">
          {availableRounds.map((round) => (
            <button
              key={round}
              type="button"
              className={`uc-round-tab${viewingRound === round ? ' uc-round-tab-active' : ''}`}
              onClick={() => onViewingRoundChange(round)}
            >
              第 {round} 轮
            </button>
          ))}
        </div>
      </div>
      <div className="uc-chat-feed">
        {speeches.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            {isViewingPast ? '该轮暂无发言记录' : '暂无发言记录'}
          </p>
        )}
        {speeches.map((s) => (
          <div key={s.id} className="uc-chat-message">
            <strong>{s.playerName}</strong>：{s.text}
          </div>
        ))}
      </div>
      {canSpeak && !isViewingPast ? (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const text = String(fd.get('speech') ?? '').trim();
              if (!text) return;
              onSend(text);
              e.currentTarget.reset();
            }}
            style={{ display: 'flex', gap: '0.5rem' }}
          >
            <input className="input" name="speech" placeholder="输入描述…" autoComplete="off" />
            <button type="submit" className="btn">
              发送
            </button>
          </form>
          <button type="button" className="btn btn-secondary" onClick={onEndSpeaking}>
            发言结束
          </button>
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
          {isViewingPast
            ? `正在查看第 ${viewingRound} 轮发言`
            : currentSpeakerName
              ? `等待 ${currentSpeakerName} 发言…`
              : '等待发言…'}
        </p>
      )}
    </div>
  );
}
