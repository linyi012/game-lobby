import { useEffect, useState } from 'react';
import type { ActGuessTeamId } from '@game-lobby/game-engine';
import type { RoomSettingsProps } from '../registry';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../lib/api';
import { TeamAssignment } from './TeamAssignment';

const DEFAULT_CATEGORY_IDS = ['animal', 'daily', 'movie', 'sport'];

export function ActGuessRoomSettings({
  isHost,
  isPlaying,
  players = [],
  onStartOptionsChange,
}: RoomSettingsProps) {
  const { token } = useAuth();
  const [categories, setCategories] = useState<api.WordPackCategory[]>([]);
  const [userPacks, setUserPacks] = useState<api.UserWordPack[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>(() => [...DEFAULT_CATEGORY_IDS]);
  const [userPackIds, setUserPackIds] = useState<string[]>([]);
  const [roomExtraWords, setRoomExtraWords] = useState('');
  const [enableTeams, setEnableTeams] = useState(false);
  const [teamAssignments, setTeamAssignments] = useState<Record<string, ActGuessTeamId>>({});
  const [performDurationSec, setPerformDurationSec] = useState(60);

  useEffect(() => {
    onStartOptionsChange({
      categoryIds,
      userPackIds,
      roomExtraWords,
      enableTeams,
      teamAssignments: enableTeams ? teamAssignments : undefined,
      performDurationSec,
    });
  }, [
    categoryIds,
    userPackIds,
    roomExtraWords,
    enableTeams,
    teamAssignments,
    performDurationSec,
    onStartOptionsChange,
  ]);

  useEffect(() => {
    if (!token) return;
    api.fetchWordPackCategories(token).then(setCategories).catch(() => {});
    api.fetchMyWordPacks(token).then(setUserPacks).catch(() => {});
  }, [token]);

  if (!isHost || isPlaying) return null;

  const toggleCategory = (id: string) => {
    setCategoryIds(
      categoryIds.includes(id) ? categoryIds.filter((c) => c !== id) : [...categoryIds, id],
    );
  };

  const toggleUserPack = (id: string) => {
    setUserPackIds(
      userPackIds.includes(id) ? userPackIds.filter((c) => c !== id) : [...userPackIds, id],
    );
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem' }}>
        比划时长（秒）
        <input
          className="input"
          type="number"
          min={30}
          max={300}
          value={performDurationSec}
          onChange={(e) => setPerformDurationSec(Number(e.target.value) || 60)}
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
        <input
          type="checkbox"
          checked={enableTeams}
          onChange={(e) => {
            setEnableTeams(e.target.checked);
            if (!e.target.checked) setTeamAssignments({});
          }}
        />
        启用分队（至少 4 人，对方可见词语）
      </label>

      {enableTeams && (
        <TeamAssignment
          players={players}
          assignments={teamAssignments}
          onChange={setTeamAssignments}
        />
      )}

      <div>
        <div style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>官方分类</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {categories.map((c) => (
            <label
              key={c.id}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}
            >
              <input
                type="checkbox"
                checked={categoryIds.includes(c.id)}
                onChange={() => toggleCategory(c.id)}
              />
              {c.name}（{c.wordCount}）
            </label>
          ))}
        </div>
      </div>

      {userPacks.length > 0 && (
        <div>
          <div style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>个人词库</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {userPacks.map((p) => (
              <label
                key={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}
              >
                <input
                  type="checkbox"
                  checked={userPackIds.includes(p.id)}
                  onChange={() => toggleUserPack(p.id)}
                />
                {p.name}（{p.words.length}）
              </label>
            ))}
          </div>
        </div>
      )}

      <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem' }}>
        本局专用词（逗号或换行分隔）
        <textarea
          className="input"
          rows={2}
          value={roomExtraWords}
          onChange={(e) => setRoomExtraWords(e.target.value)}
          placeholder="例如：公司团建, 周末烧烤"
        />
      </label>
    </div>
  );
}
