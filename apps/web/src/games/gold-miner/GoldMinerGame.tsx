import { useCallback, useEffect, useState } from 'react';
import type { GoldMinerGameState, ShopItemType } from '@game-lobby/game-engine';
import { MineCanvas } from './MineCanvas';
import { ShopPanel } from './ShopPanel';

export interface GoldMinerGameProps {
  state: GoldMinerGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onLaunch: () => void;
  onUseDynamite: () => void;
  onShopBuy: (item: ShopItemType) => void;
  onShopDone: () => void;
}

export function GoldMinerGame({
  state,
  myMemberId,
  isSpectator,
  onLaunch,
  onUseDynamite,
  onShopBuy,
  onShopDone,
}: GoldMinerGameProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, []);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (state.phase !== 'playing' || state.hookStage !== 'swinging') return;
      if (isSpectator || state.currentPlayerId !== myMemberId) return;
      e.preventDefault();
      onLaunch();
    },
    [state.phase, state.hookStage, state.currentPlayerId, myMemberId, isSpectator, onLaunch],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const current = state.players.find((p) => p.id === state.currentPlayerId);
  const me = state.players.find((p) => p.id === myMemberId);
  const isMyTurn =
    !isSpectator && state.currentPlayerId === myMemberId && state.phase === 'playing';
  const canLaunch = isMyTurn && state.hookStage === 'swinging';
  const canDynamite =
    isMyTurn &&
    state.hookStage === 'retracting' &&
    state.hook.attachedItemId != null &&
    (me?.inventory.dynamite ?? 0) > 0;

  const levelCountdown =
    state.phase === 'playing'
      ? Math.max(0, Math.ceil((state.levelStartedAt + state.levelTimeLimitMs - Date.now()) / 1000))
      : null;

  const sorted = [...state.players].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          alignItems: 'center',
        }}
      >
        <div>
          <strong>
            第 {state.level}/{state.maxLevels} 关
          </strong>
          <span style={{ marginLeft: '0.75rem', color: 'var(--text-muted)' }}>
            目标 ${state.levelTarget}
          </span>
          {levelCountdown != null && (
            <span style={{ marginLeft: '0.75rem' }}>剩余 {levelCountdown}s</span>
          )}
        </div>
        <div style={{ fontSize: '0.9rem' }}>{state.message}</div>
      </div>

      {state.phase !== 'shop' && state.phase !== 'ended' && (
        <>
          <MineCanvas state={state} />
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {canLaunch && (
              <button type="button" className="btn btn-primary" onClick={onLaunch}>
                下钩（空格）
              </button>
            )}
            {canDynamite && (
              <button type="button" className="btn" onClick={onUseDynamite}>
                使用炸药
              </button>
            )}
            {!isSpectator && state.phase === 'playing' && !isMyTurn && (
              <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>
                等待 {current?.name} 操作…
              </span>
            )}
            {state.hookStage === 'extending' && isMyTurn && (
              <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>钩子延伸中…</span>
            )}
            {state.hookStage === 'retracting' && isMyTurn && (
              <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>收回中…</span>
            )}
          </div>
        </>
      )}

      {state.phase === 'shop' && (
        <ShopPanel
          state={state}
          myMemberId={myMemberId}
          isSpectator={isSpectator}
          onBuy={onShopBuy}
          onDone={onShopDone}
        />
      )}

      {state.phase === 'ended' && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <h2 style={{ marginTop: 0 }}>游戏结束</h2>
          <ol style={{ textAlign: 'left', maxWidth: 320, margin: '0 auto' }}>
            {sorted.map((p, i) => (
              <li key={p.id} style={{ fontWeight: state.winnerIds.includes(p.id) ? 700 : 400 }}>
                {i + 1}. {p.name} — ${p.totalScore}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div
        style={{
          marginTop: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.5rem',
        }}
      >
        {state.players.map((p) => (
          <div
            key={p.id}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 6,
              border:
                p.id === state.currentPlayerId && state.phase === 'playing'
                  ? '2px solid var(--accent)'
                  : '1px solid var(--border)',
              background: p.id === myMemberId ? 'rgba(99,102,241,0.08)' : undefined,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</div>
            <div style={{ fontSize: '0.8rem' }}>总分 ${p.totalScore}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              本关 ${p.levelMoney}
            </div>
          </div>
        ))}
      </div>

      {state.lastGrab && state.phase === 'turn_result' && (
        <p style={{ marginTop: '0.75rem', textAlign: 'center', fontSize: '0.9rem' }}>
          {state.lastGrab.playerName} 抓到 {state.lastGrab.itemType}，获得 ${state.lastGrab.value}
        </p>
      )}
    </div>
  );
}
