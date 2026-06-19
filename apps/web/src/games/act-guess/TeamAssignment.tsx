import type { ActGuessTeamId } from '@game-lobby/game-engine';

export interface TeamPlayer {
  id: string;
  name: string;
  role: string;
}

interface TeamAssignmentProps {
  players: TeamPlayer[];
  assignments: Record<string, ActGuessTeamId>;
  onChange: (assignments: Record<string, ActGuessTeamId>) => void;
}

export function TeamAssignment({ players, assignments, onChange }: TeamAssignmentProps) {
  const activePlayers = players.filter((p) => p.role !== 'spectator');

  const assign = (playerId: string, team: ActGuessTeamId) => {
    onChange({ ...assignments, [playerId]: team });
  };

  const teamA = activePlayers.filter((p) => assignments[p.id] === 'A');
  const teamB = activePlayers.filter((p) => assignments[p.id] === 'B');
  const unassigned = activePlayers.filter((p) => !assignments[p.id]);

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="card" style={{ padding: '0.75rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>A 队</div>
          {teamA.length === 0 && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>暂无队员</p>
          )}
          {teamA.map((p) => (
            <div key={p.id} style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              {p.name}
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: '0.75rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>B 队</div>
          {teamB.length === 0 && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>暂无队员</p>
          )}
          {teamB.map((p) => (
            <div key={p.id} style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              {p.name}
            </div>
          ))}
        </div>
      </div>

      {unassigned.length > 0 && (
        <div>
          <div style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>点击分配队员</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {unassigned.map((p) => (
              <div key={p.id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem' }}>{p.name}</span>
                <button type="button" className="btn btn-secondary" onClick={() => assign(p.id, 'A')}>
                  → A
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => assign(p.id, 'B')}>
                  → B
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(teamA.length > 0 || teamB.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {[...teamA, ...teamB].map((p) => (
            <button
              key={p.id}
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem' }}
              onClick={() => {
                const next = { ...assignments };
                delete next[p.id];
                onChange(next);
              }}
            >
              重分 {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
