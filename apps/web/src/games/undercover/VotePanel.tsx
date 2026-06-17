interface VotePanelProps {
  alivePlayers: { id: string; name: string }[];
  myMemberId: string;
  hasVoted: boolean;
  onVote: (targetId: string) => void;
}

export function VotePanel({ alivePlayers, myMemberId, hasVoted, onVote }: VotePanelProps) {
  const targets = alivePlayers.filter((p) => p.id !== myMemberId);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>投票</h3>
      {hasVoted ? (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>你已投票，等待其他玩家…</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {targets.map((p) => (
            <button key={p.id} type="button" className="btn btn-secondary" onClick={() => onVote(p.id)}>
              投 {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
