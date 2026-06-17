import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import { disconnectSocket, getSocket } from '../lib/socket';

const COMPACT_QUERY = '(max-width: 640px)';

export function Layout() {
  const { user, token, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [isCompact, setIsCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches,
  );
  const [headerOpen, setHeaderOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      setIsCompact(e.matches);
      if (e.matches) setHeaderOpen(false);
    };
    setIsCompact(mq.matches);
    if (mq.matches) setHeaderOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const expanded = !isCompact || headerOpen || editing;

  function closePanel() {
    if (editing) return;
    setHeaderOpen(false);
  }

  function togglePanel() {
    if (expanded && !editing) setHeaderOpen(false);
    else setHeaderOpen(true);
  }

  function startEdit() {
    if (!user) return;
    setEditName(user.displayName);
    setHeaderOpen(true);
    setEditing(true);
  }

  async function saveDisplayName() {
    if (!token || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await api.updateProfile(token, editName.trim());
      updateUser(res.token, res.user);
      getSocket(res.token);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const userControls = (
    <div className="app-header-panel-actions">
      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            className="input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={64}
            style={{ width: '140px', padding: '0.35rem 0.5rem', fontSize: '0.9rem' }}
            autoFocus
          />
          <button
            className="btn"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            onClick={saveDisplayName}
            disabled={saving || !editName.trim()}
          >
            保存
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            onClick={() => setEditing(false)}
          >
            取消
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
          }}
          title="点击修改显示名称"
        >
          {user?.isGuest && <span style={{ marginRight: '0.25rem' }}>👤</span>}
          {user?.displayName}
        </button>
      )}
      <button
        className="btn btn-secondary"
        onClick={() => {
          disconnectSocket();
          logout();
          navigate('/login');
        }}
      >
        退出
      </button>
    </div>
  );

  return (
    <div>
      {!isCompact && (
        <header
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'rgba(26, 35, 50, 0.9)',
            backdropFilter: 'blur(8px)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div className="container app-header">
            <div className="app-header-bar">
              <Link to="/" style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>
                🎮 Game Lobby
              </Link>
              {userControls}
            </div>
          </div>
        </header>
      )}

      {isCompact && (
        <>
          <button
            type="button"
            className="app-header-fab"
            onClick={togglePanel}
            aria-expanded={expanded}
            aria-label={expanded ? '收起菜单' : '打开菜单'}
            disabled={expanded && editing}
          >
            {expanded ? '✕' : '🎮'}
          </button>
          {expanded && (
            <>
              <div className="app-header-backdrop" onClick={closePanel} aria-hidden />
              <div className="app-header-panel" role="dialog" aria-label="Game Lobby 菜单">
                <div className="app-header-panel-head">
                  <Link
                    to="/"
                    style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}
                    onClick={closePanel}
                  >
                    🎮 Game Lobby
                  </Link>
                  <button
                    type="button"
                    className="app-header-panel-close"
                    onClick={closePanel}
                    disabled={editing}
                    aria-label="关闭菜单"
                  >
                    收起 ▲
                  </button>
                </div>
                {userControls}
              </div>
            </>
          )}
        </>
      )}

      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
