import { Suspense, lazy, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ALL_FRUITS,
  FRUIT_EMOJI,
  FRUIT_LABELS,
  cardLabel,
  type Fruit,
  type HeartAttackGameState,
  type HeartAttackLastAction,
} from '@game-lobby/game-engine';
import {
  isMusicEnabled,
  isSfxEnabled,
  playBombSound,
  playBellRing,
  playFlipSound,
  playSlapWrong,
  playTurnSound,
  playVictorySound,
  setMusicEnabled,
  setSfxEnabled,
  startBackgroundMusic,
  stopBackgroundMusic,
  unlockAudio,
} from './game-sounds';

const HeartAttackBoard3D = lazy(() =>
  import('./HeartAttackBoard3D').then((m) => ({ default: m.HeartAttackBoard3D })),
);

type SlapAnim = import('./HeartAttackBoard3D').SlapAnimation;

interface Props {
  state: HeartAttackGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onFlip: () => void;
  onSlap: () => void;
  onChooseWild: (fruit: Fruit) => void;
}

type HistoryEntry = HeartAttackLastAction & { id: number };

function formatAction(a: HeartAttackLastAction): string {
  if (a.type === 'flip' && a.card) return `${a.playerName} 翻出 ${cardLabel(a.card)}`;
  if (a.type === 'wild' && a.card) return `${a.playerName} 万能 → ${cardLabel(a.card)}`;
  if (a.type === 'bomb') return `${a.playerName} 翻出炸弹，中央清空`;
  if (a.type === 'slap') return `${a.playerName} 拍铃${a.correct ? '正确' : '错误'}`;
  return a.playerName;
}

export function HeartAttackGame({
  state,
  myMemberId,
  isSpectator,
  onFlip,
  onSlap,
  onChooseWild,
}: Props) {
  const current = state.players[state.currentPlayerIndex];
  const isMyTurn =
    !isSpectator && current?.id === myMemberId && state.phase === 'playing' && state.stage === 'flipping';
  const needWild =
    !isSpectator &&
    state.stage === 'choosing_fruit' &&
    state.wildFlipperId === myMemberId;

  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [sfxOn, setSfxOn] = useState(isSfxEnabled);
  const [musicOn, setMusicOn] = useState(isMusicEnabled);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const lastSigRef = useRef<string | null>(null);
  const histIdRef = useRef(0);
  const [slapAnimations, setSlapAnimations] = useState<SlapAnim[]>([]);
  const [bellSlapPulse, setBellSlapPulse] = useState(0);
  const slapAnimIdRef = useRef(0);
  const seenSlapKeysRef = useRef<Set<string>>(new Set());
  const slapAnimsRef = useRef<SlapAnim[]>([]);
  const localSlapPendingRef = useRef(false);
  const slapEventSeqRef = useRef(0);

  const registerSlapAnimation = useCallback((playerId: string, key: string) => {
    if (seenSlapKeysRef.current.has(key)) return false;
    seenSlapKeysRef.current.add(key);
    const id = `slap-${slapAnimIdRef.current++}`;
    const overlapIndex = slapAnimsRef.current.length;
    const anim: SlapAnim = { id, playerId, startTime: Date.now(), overlapIndex };
    slapAnimsRef.current = [...slapAnimsRef.current, anim];
    setSlapAnimations(slapAnimsRef.current);
    setBellSlapPulse((p) => p + 1);
    window.setTimeout(() => {
      slapAnimsRef.current = slapAnimsRef.current.filter((a) => a.id !== id);
      setSlapAnimations(slapAnimsRef.current);
      seenSlapKeysRef.current.delete(key);
    }, 720);
    return true;
  }, []);

  const handleSlap = useCallback(() => {
    unlockAudio();
    if (myMemberId) {
      localSlapPendingRef.current = true;
      registerSlapAnimation(myMemberId, `local-${Date.now()}-${myMemberId}`);
      playBellRing();
    }
    onSlap();
  }, [myMemberId, onSlap, registerSlapAnimation]);

  useEffect(() => {
    const la = state.lastAction;
    if (!la) {
      if (lastSigRef.current !== null) {
        lastSigRef.current = null;
        setHistory([]);
      }
      return;
    }
    const sig = `${la.type}|${la.playerId}|${la.correct}|${cardLabel(la.card ?? { kind: 'normal' })}`;
    if (sig !== lastSigRef.current) {
      lastSigRef.current = sig;
      setHistory((h) => [{ ...la, id: histIdRef.current++ }, ...h].slice(0, 60));
    }
  }, [state.lastAction]);

  useEffect(() => {
    if (state.phase !== 'ended') startBackgroundMusic();
    else stopBackgroundMusic();
    return () => stopBackgroundMusic();
  }, [state.phase]);

  const prevPhaseRef = useRef(state.phase);
  useEffect(() => {
    if (prevPhaseRef.current !== 'ended' && state.phase === 'ended' && state.winnerId) {
      playVictorySound();
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase, state.winnerId]);

  const actionSigRef = useRef<string | null>(null);
  useEffect(() => {
    const la = state.lastAction;
    if (!la || state.phase !== 'playing') return;
    const slapSeq = la.type === 'slap' ? ++slapEventSeqRef.current : 0;
    const sig =
      la.type === 'slap'
        ? `${la.type}|${la.playerId}|${la.correct}|${slapSeq}`
        : `${la.type}|${la.playerId}|${la.correct}`;
    if (sig === actionSigRef.current) return;
    actionSigRef.current = sig;
    if (la.type === 'flip') playFlipSound();
    else if (la.type === 'bomb') playBombSound();
    else if (la.type === 'slap') {
      const isLocalEcho = la.playerId === myMemberId && localSlapPendingRef.current;
      localSlapPendingRef.current = false;
      if (!isLocalEcho) {
        registerSlapAnimation(la.playerId, `action-${sig}`);
        playBellRing();
      }
      if (!la.correct) setTimeout(() => playSlapWrong(), isLocalEcho ? 0 : 90);
    }
  }, [state.lastAction, state.phase, myMemberId, registerSlapAnimation]);

  useEffect(() => {
    if (state.stage !== 'resolving_slap' || state.slapQueue.length === 0) return;
    let anyNew = false;
    for (const { playerId, at } of state.slapQueue) {
      if (registerSlapAnimation(playerId, `queue-${at}-${playerId}`)) anyNew = true;
    }
    if (anyNew) playBellRing();
  }, [state.slapQueue, state.stage, registerSlapAnimation]);

  const prevTurnRef = useRef(state.currentPlayerIndex);
  useEffect(() => {
    if (state.phase !== 'playing') {
      prevTurnRef.current = state.currentPlayerIndex;
      return;
    }
    if (prevTurnRef.current !== state.currentPlayerIndex && state.stage === 'flipping') {
      playTurnSound();
    }
    prevTurnRef.current = state.currentPlayerIndex;
  }, [state.currentPlayerIndex, state.stage, state.phase]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space' || isSpectator || state.phase !== 'playing') return;
      if (state.stage === 'choosing_fruit') return;
      e.preventDefault();
      unlockAudio();
      handleSlap();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSpectator, state.phase, state.stage, handleSlap]);

  const ended = state.phase === 'ended';
  const winner =
    state.winnerId != null ? (state.players.find((p) => p.id === state.winnerId) ?? null) : null;
  const iWon = state.winnerId != null && state.winnerId === myMemberId;

  return (
    <div
      className="card"
      style={{
        position: 'relative',
        padding: 0,
        height: 'min(72vh, 640px)',
        overflow: 'hidden',
      }}
      onPointerDown={unlockAudio}
    >
      <Suspense
        fallback={
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              background: 'radial-gradient(ellipse at top, #16243f 0%, #0a0f18 70%)',
            }}
          >
            正在加载 3D 牌桌…
          </div>
        }
      >
        <HeartAttackBoard3D
          state={state}
          myMemberId={myMemberId}
          bellActive={state.bellActive}
          slapAnimations={slapAnimations}
          bellSlapPulse={bellSlapPulse}
        />
      </Suspense>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
        {/* Fruit HUD */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '0.45rem',
            pointerEvents: 'none',
          }}
        >
          {ALL_FRUITS.map((fruit) => {
            const count = state.fruitTotals[fruit];
            const warn = count === 4;
            const hot = count === 5;
            return (
              <div
                key={fruit}
                style={{
                  padding: '0.35rem 0.55rem',
                  borderRadius: 10,
                  textAlign: 'center',
                  minWidth: 52,
                  background: hot
                    ? 'rgba(239, 68, 68, 0.85)'
                    : warn
                      ? 'rgba(245, 158, 11, 0.75)'
                      : 'rgba(12, 18, 30, 0.72)',
                  border: hot
                    ? '2px solid #fecaca'
                    : warn
                      ? '1px solid #fde047'
                      : '1px solid rgba(255,255,255,0.08)',
                  animation: hot ? 'dv-banner-glow 0.8s ease-in-out infinite' : undefined,
                }}
              >
                <div style={{ fontSize: '1.2rem', lineHeight: 1 }}>{FRUIT_EMOJI[fruit]}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{count}</div>
              </div>
            );
          })}
        </div>

        {/* Top-left info */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            maxWidth: infoPanelOpen ? 'min(55%, 340px)' : undefined,
            pointerEvents: 'auto',
            ...panelStyle,
          }}
        >
          <button
            type="button"
            onClick={() => setInfoPanelOpen((o) => !o)}
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              padding: 0,
              marginBottom: infoPanelOpen ? '0.35rem' : 0,
            }}
          >
            <strong>德国心脏病</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {infoPanelOpen ? '▼' : '▶'}
            </span>
          </button>
          {infoPanelOpen && (
            <>
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {state.message}
              </p>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <AudioToggle
                  label="音效"
                  active={sfxOn}
                  onToggle={() => {
                    const next = !sfxOn;
                    setSfxOn(next);
                    setSfxEnabled(next);
                  }}
                />
                <AudioToggle
                  label="音乐"
                  active={musicOn}
                  onToggle={() => {
                    const next = !musicOn;
                    setMusicOn(next);
                    setMusicEnabled(next);
                    if (next) startBackgroundMusic();
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* History */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: historyOpen ? 'min(38%, 260px)' : 'auto',
            maxHeight: '40%',
            overflow: 'auto',
            pointerEvents: 'auto',
            ...panelStyle,
          }}
        >
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              padding: 0,
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            记录 {historyOpen ? '▼' : '▶'}
          </button>
          {historyOpen && (
            <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem', fontSize: '0.78rem' }}>
              {history.map((h) => (
                <li key={h.id} style={{ marginBottom: '0.2rem' }}>
                  {formatAction(h)}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Bottom action panel */}
        {!ended && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.6rem',
              pointerEvents: 'auto',
            }}
          >
            {needWild && (
              <div style={{ ...panelStyle, textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>选择万能水果计入哪种水果</p>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {ALL_FRUITS.map((fruit) => (
                    <button
                      key={fruit}
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onChooseWild(fruit)}
                      style={{ minWidth: 56 }}
                    >
                      {FRUIT_EMOJI[fruit]}
                      <br />
                      <span style={{ fontSize: '0.75rem' }}>{FRUIT_LABELS[fruit]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isMyTurn && !needWild && (
              <button type="button" className="btn" onClick={onFlip} style={{ minWidth: 140, fontSize: '1.1rem' }}>
                翻牌
              </button>
            )}

            {!isSpectator && state.phase === 'playing' && !needWild && (
              <button
                type="button"
                onClick={handleSlap}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  border: state.bellActive ? '4px solid #fde047' : '3px solid rgba(255,255,255,0.2)',
                  background: state.bellActive
                    ? 'radial-gradient(circle at 30% 30%, #fde047, #f59e0b)'
                    : 'radial-gradient(circle at 30% 30%, #ef4444, #b91c1c)',
                  color: state.bellActive ? '#1a1206' : '#fff',
                  fontSize: '1.6rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: state.bellActive
                    ? '0 0 24px rgba(251, 191, 36, 0.6)'
                    : '0 8px 24px rgba(0,0,0,0.4)',
                  animation: state.bellActive ? 'dv-banner-glow 0.9s ease-in-out infinite' : undefined,
                }}
              >
                拍！
              </button>
            )}

            {!isMyTurn && !needWild && state.phase === 'playing' && (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', ...panelStyle }}>
                等待 {current?.name ?? '玩家'} 翻牌 · 空格键拍铃
              </p>
            )}
          </div>
        )}

        {ended && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.42)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '36%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                padding: '1.1rem 1.8rem',
                borderRadius: 16,
                background: iWon
                  ? 'linear-gradient(160deg, rgba(245,158,11,0.95), rgba(217,119,6,0.95))'
                  : 'rgba(12, 18, 30, 0.92)',
                border: iWon ? '1px solid #fde047' : '1px solid rgba(255,255,255,0.12)',
                color: iWon ? '#1a1206' : 'var(--text)',
                animation: 'dv-banner-pop 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: '2rem' }}>{iWon ? '🎉' : '🏆'}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                {iWon ? '胜利！' : winner ? `${winner.name} 获胜` : '游戏结束'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AudioToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        padding: '0.2rem 0.55rem',
        fontSize: '0.72rem',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.12)',
        background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
        color: active ? '#c7d2fe' : 'var(--text-muted)',
        cursor: 'pointer',
      }}
    >
      {active ? '🔊' : '🔇'} {label}
    </button>
  );
}

const panelStyle: CSSProperties = {
  background: 'rgba(12, 18, 30, 0.72)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '0.6rem 0.75rem',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
};
