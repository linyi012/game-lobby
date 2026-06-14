import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RoomSummary } from '@game-lobby/shared';
import { GAME_META } from '@game-lobby/shared';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import { getSocket, subscribeLobby } from '../lib/socket';

export function LobbyPage() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!token) return;
    getSocket(token);
    const unsub = subscribeLobby(setRooms);
    api.fetchRooms(token).then(setRooms).finally(() => setLoading(false));
    return unsub;
  }, [token]);

  async function handleCreate() {
    if (!token || !roomName.trim()) return;
    setCreating(true);
    try {
      const room = await api.createRoom(token, roomName.trim());
      window.location.href = `/room/${room.id}`;
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>游戏大厅</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
            查看正在进行的房间，或创建新房间邀请好友
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flex: '1 1 280px' }}>
          <input
            className="input"
            placeholder="新房间名称"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
          <button className="btn" onClick={handleCreate} disabled={creating}>
            创建房间
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>加载中…</p>
      ) : rooms.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>暂无房间，创建第一个吧！</p>
        </div>
      ) : (
        <div className="grid grid-rooms">
          {rooms.map((room) => (
            <Link key={room.id} to={`/room/${room.id}`} style={{ color: 'inherit' }}>
              <article className="card" style={{ height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{room.name}</h2>
                  <span className={`badge badge-${room.status}`}>
                    {room.status === 'playing' ? '游戏中' : '等待中'}
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.5rem 0' }}>
                  {room.currentGame
                    ? `正在玩：${GAME_META[room.currentGame].name}`
                    : '尚未开始游戏'}
                </p>
                <p style={{ fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
                  玩家 {room.playerCount} · 旁观 {room.spectatorCount}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {room.players.slice(0, 6).map((p) => (
                    <span key={p.id} className="player-chip">
                      {p.isBot ? '🤖' : '👤'} {p.displayName}
                    </span>
                  ))}
                  {room.players.length > 6 && (
                    <span className="player-chip">+{room.players.length - 6}</span>
                  )}
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
