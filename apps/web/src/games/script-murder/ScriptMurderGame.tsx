import { useEffect, useMemo, useState } from 'react';
import type { ScriptMurderGameState, ScriptPhaseType } from '@game-lobby/game-engine';

const PHASE_LABELS: Record<ScriptPhaseType | 'ended', string> = {
  intro: '序幕',
  reading: '阅读角色本',
  discussion: '讨论',
  search: '搜证',
  vote: '投票',
  reveal: '揭晓',
  ended: '结束',
};

interface Props {
  state: ScriptMurderGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  isHost?: boolean;
  onSpeech: (text: string) => void;
  onVote: (targetId: string) => void;
  onSearchClue: (clueId: string) => void;
  onHostAdvance: () => void;
  onHostRevealClue: (clueId: string) => void;
  onHostPause: (paused: boolean) => void;
  onHostJumpAct: (actIndex: number) => void;
  onContinue: () => void;
}

export function ScriptMurderGame({
  state,
  myMemberId,
  isSpectator,
  isHost,
  onSpeech,
  onVote,
  onSearchClue,
  onHostAdvance,
  onHostRevealClue,
  onHostPause,
  onHostJumpAct,
  onContinue,
}: Props) {
  const [, setTick] = useState(0);
  const [speechText, setSpeechText] = useState('');

  const me = state.players.find((p) => p.id === myMemberId);
  const myCharacter = state.script.characters.find((c) => c.id === me?.characterId);
  const acts = useMemo(
    () => [...state.script.acts].sort((a, b) => a.order - b.order),
    [state.script.acts],
  );
  const currentAct = acts[state.currentActIndex];

  const visibleClues = state.script.clues.filter((c) => c.content !== '（尚未公开）');
  const searchClues = state.script.clues.filter(
    (c) =>
      c.visibility === 'search' &&
      c.revealAct <= (currentAct?.order ?? 1) &&
      !state.revealedClueIds.includes(c.id) &&
      !(state.discoveredClueIds[myMemberId ?? ''] ?? []).includes(c.id),
  );

  const unrevealedClues = state.script.clues.filter(
    (c) => !state.revealedClueIds.includes(c.id) && c.revealAct <= (currentAct?.order ?? 1),
  );

  const countdownSec =
    state.phaseDeadline != null
      ? Math.max(0, Math.ceil((state.phaseDeadline - Date.now()) / 1000))
      : null;

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (state.phase === 'ended') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ margin: 0 }}>游戏结束</h2>
        <p style={{ color: 'var(--text-muted)' }}>{state.message}</p>
        <p style={{ fontSize: '0.9rem' }}>剧本：{state.scriptTitle}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{state.scriptTitle}</h2>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {currentAct?.title ?? '—'} · {PHASE_LABELS[state.phase]}
            </p>
          </div>
          {countdownSec != null && !state.hostPaused && !state.awaitingContinue && (
            <span className="badge" style={{ marginLeft: 'auto' }}>
              {countdownSec}s
            </span>
          )}
          {state.hostPaused && (
            <span className="badge badge-waiting" style={{ marginLeft: 'auto' }}>
              已暂停
            </span>
          )}
        </div>
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.95rem' }}>{state.message}</p>
      </div>

      {currentAct && (state.phase === 'intro' || state.phase === 'reveal') && (
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem' }}>公开叙事</h3>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentAct.publicText}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {!isSpectator && myCharacter && (
          <div className="card">
            <h3 style={{ margin: '0 0 0.5rem' }}>
              我的角色：{me?.characterName ?? myCharacter.name}
            </h3>
            {state.phase === 'reading' || myCharacter.privateScript ? (
              <>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {myCharacter.publicProfile}
                </p>
                {myCharacter.privateScript && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <strong style={{ fontSize: '0.85rem' }}>角色本</strong>
                    <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                      {myCharacter.privateScript}
                    </p>
                  </div>
                )}
                {myCharacter.objectives && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <strong style={{ fontSize: '0.85rem' }}>目标</strong>
                    <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                      {myCharacter.objectives}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {myCharacter.publicProfile}
              </p>
            )}
          </div>
        )}

        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem' }}>线索板</h3>
          {visibleClues.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>暂无线索</p>
          ) : (
            visibleClues.map((c) => (
              <div key={c.id} style={{ marginBottom: '0.75rem' }}>
                <strong>{c.title}</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                  {c.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {state.phase === 'discussion' && !isSpectator && (
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem' }}>讨论</h3>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: '0.75rem' }}>
            {state.speeches
              .filter((s) => s.act === (currentAct?.order ?? 1))
              .map((s) => (
                <div key={s.id} style={{ marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                  <strong>{s.playerName}</strong>：{s.text}
                </div>
              ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!speechText.trim()) return;
              onSpeech(speechText.trim());
              setSpeechText('');
            }}
            style={{ display: 'flex', gap: '0.5rem' }}
          >
            <input
              className="input"
              value={speechText}
              onChange={(e) => setSpeechText(e.target.value)}
              placeholder="发表看法…"
            />
            <button type="submit" className="btn">
              发送
            </button>
          </form>
        </div>
      )}

      {state.phase === 'search' && !isSpectator && searchClues.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem' }}>可搜证线索</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {searchClues.map((c) => (
              <button key={c.id} type="button" className="btn btn-ghost" onClick={() => onSearchClue(c.id)}>
                调查：{c.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.phase === 'vote' && !isSpectator && (
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem' }}>投票指认</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {state.players
              .filter((p) => p.id !== myMemberId && p.isAlive)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn btn-ghost"
                  disabled={Boolean(state.votes[myMemberId ?? ''])}
                  onClick={() => onVote(p.id)}
                >
                  {p.name}（{p.characterName}）
                </button>
              ))}
          </div>
        </div>
      )}

      {state.phase === 'reveal' && state.awaitingContinue && (
        <div className="card" style={{ textAlign: 'center' }}>
          <button type="button" className="btn" onClick={() => onContinue()}>
            继续下一阶段
          </button>
        </div>
      )}

      {isHost && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <h3 style={{ margin: '0 0 0.75rem' }}>主持人控制</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <button type="button" className="btn" onClick={() => onHostAdvance()}>
              推进阶段
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onHostPause(!state.hostPaused)}
            >
              {state.hostPaused ? '恢复计时' : '暂停计时'}
            </button>
            {acts.map((act, idx) => (
              <button
                key={act.order}
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (window.confirm(`确定跳至「${act.title}」？`)) onHostJumpAct(idx);
                }}
              >
                跳至第 {act.order} 幕
              </button>
            ))}
          </div>
          {unrevealedClues.length > 0 && (
            <div>
              <p style={{ fontSize: '0.85rem', margin: '0 0 0.5rem' }}>公开线索</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {unrevealedClues.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onHostRevealClue(c.id)}
                  >
                    公开：{c.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>玩家</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {state.players.map((p) => (
            <span key={p.id} className="player-chip">
              {p.name} · {p.characterName}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
