import {
  CHARACTER_LABELS,
  supplyCardLabel,
  type LifeboatActionPayload,
  type LifeboatGameState,
  type CombatSide,
} from '@game-lobby/game-engine';
import { BoatRow } from './BoatRow';
import { SupplyDraftPanel } from './SupplyDraftPanel';
import { ActionPanel } from './ActionPanel';
import { ResponsePanel } from './ResponsePanel';
import { CombatPanel } from './CombatPanel';
import { NavigationPanel } from './NavigationPanel';
import { ThirstPanel } from './ThirstPanel';
import { ScoreReveal } from './ScoreReveal';

const PHASE_LABELS: Record<string, string> = {
  supply_draft: '补给阶段',
  action: '行动阶段',
  pending_response: '等待回应',
  combat: '战斗',
  navigation_pick: '航海阶段',
  thirst_resolve: '口渴结算',
  ended: '游戏结束',
};

interface Props {
  state: LifeboatGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onSupplyPick: (cardIndex: number) => void;
  onAction: (action: LifeboatActionPayload) => void;
  onRespond: (accept: boolean) => void;
  onCombatSupport: (side: CombatSide) => void;
  onNavigationPick: (cardIndex: number) => void;
  onPlayWater: (cardId: string) => void;
  onSkipThirst: () => void;
}

export function LifeboatGame({
  state,
  myMemberId,
  isSpectator,
  onSupplyPick,
  onAction,
  onRespond,
  onCombatSupport,
  onNavigationPick,
  onPlayWater,
  onSkipThirst,
}: Props) {
  const me = state.players.find((p) => p.id === myMemberId);
  const sorted = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const actor = sorted.filter((p) => !p.isDead)[state.actionPlayerIndex];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            第 {state.round} 天 · {PHASE_LABELS[state.phase] ?? state.phase}
          </span>
          <h2 style={{ margin: '0.25rem 0 0' }}>怒海求生</h2>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
          <span>🕊️ 海鸥 {state.seagullCount}/4</span>
          <span>📦 物资库 {state.supplyDeck.length}</span>
          <span>⛵ 划船牌 {state.rowingPile.length}</span>
        </div>
      </div>

      {state.message && (
        <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem' }}>{state.message}</p>
      )}

      <BoatRow
        players={state.players}
        myMemberId={myMemberId}
        highlightPlayerId={actor?.id ?? state.navigatorId}
      />

      {me && state.phase !== 'ended' && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>我的信息</h3>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
            角色：{CHARACTER_LABELS[me.characterId]} · 爱 {CHARACTER_LABELS[me.loveCharacterId]} · 恨{' '}
            {CHARACTER_LABELS[me.hateCharacterId]}
          </p>
          {me.hand.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {me.hand.map((c) => (
                <span
                  key={c.id}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.2rem 0.5rem',
                    background: 'var(--surface-2)',
                    borderRadius: 4,
                  }}
                >
                  {supplyCardLabel(c)}
                </span>
              ))}
            </div>
          )}
          {me.faceUp.length > 0 && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              明牌：{me.faceUp.map((c) => supplyCardLabel(c)).join('、')}
            </p>
          )}
        </div>
      )}

      <ScoreReveal state={state} />

      {!isSpectator && state.phase === 'supply_draft' && (
        <SupplyDraftPanel state={state} myMemberId={myMemberId} onPick={onSupplyPick} />
      )}
      {!isSpectator && state.phase === 'action' && (
        <ActionPanel state={state} myMemberId={myMemberId} onAction={onAction} />
      )}
      {!isSpectator && (
        <ResponsePanel state={state} myMemberId={myMemberId} onRespond={onRespond} />
      )}
      {!isSpectator && (
        <CombatPanel state={state} myMemberId={myMemberId} onSupport={onCombatSupport} />
      )}
      {!isSpectator && (
        <NavigationPanel state={state} myMemberId={myMemberId} onPick={onNavigationPick} />
      )}
      {!isSpectator && (
        <ThirstPanel
          state={state}
          myMemberId={myMemberId}
          onPlayWater={onPlayWater}
          onSkip={onSkipThirst}
        />
      )}

      {state.lastAction && state.phase !== 'ended' && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
          最近：{state.lastAction.playerName} — {state.lastAction.detail ?? state.lastAction.type}
        </p>
      )}
    </div>
  );
}
