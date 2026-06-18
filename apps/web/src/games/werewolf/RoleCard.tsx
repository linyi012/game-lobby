import { useState } from 'react';
import { ROLE_LABELS, type WerewolfRole, type WerewolfRoleOrHidden } from '@game-lobby/game-engine';

const ROLE_DESCRIPTIONS: Record<WerewolfRole, string> = {
  werewolf: '夜晚与同伙投票刀杀一名好人。',
  villager: '无特殊技能，白天推理放逐狼人。',
  seer: '每晚可查验一名玩家的阵营。',
  witch: '拥有一瓶解药和一瓶毒药，各可使用一次。',
  hunter: '被放逐或被刀时可开枪带走一人（被毒杀不能开枪）。',
  guard: '每晚守护一名玩家，不能连续两夜守同一人。',
  idiot: '被投票出局时翻牌免死，但失去投票权。',
};

interface RoleCardProps {
  role: WerewolfRoleOrHidden;
  wolfTeammates: { id: string; name: string }[];
}

export function RoleCard({ role, wolfTeammates }: RoleCardProps) {
  const [expanded, setExpanded] = useState(false);
  if (role === 'unknown') return null;

  return (
    <div className="card ww-role-card">
      <button
        type="button"
        className="ww-role-card-toggle"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="ww-role-card-label">你的身份</span>
        <span className="ww-role-card-name">{ROLE_LABELS[role]}</span>
        <span className="ww-role-card-hint">{expanded ? '收起' : '点击查看技能'}</span>
      </button>
      {expanded && (
        <div className="ww-role-card-body">
          <p>{ROLE_DESCRIPTIONS[role]}</p>
          {role === 'werewolf' && wolfTeammates.length > 0 && (
            <p className="ww-wolf-team">
              狼队友：{wolfTeammates.map((w) => w.name).join('、')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
