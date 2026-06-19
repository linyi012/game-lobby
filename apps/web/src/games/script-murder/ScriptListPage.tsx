import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../lib/api';

export function ScriptListPage() {
  const { token } = useAuth();
  const [mine, setMine] = useState<api.MurderScriptSummary[]>([]);
  const [official, setOfficial] = useState<api.MurderScriptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    if (!token) return;
    const [myScripts, officialScripts] = await Promise.all([
      api.fetchMyMurderScripts(token),
      api.fetchOfficialMurderScripts(token),
    ]);
    setMine(myScripts);
    setOfficial(officialScripts);
  }

  useEffect(() => {
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDelete(id: string) {
    if (!token || !window.confirm('确定删除该剧本？')) return;
    await api.deleteMurderScript(token, id);
    await reload();
  }

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/games/script_murder" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          ← 返回剧本杀大厅
        </Link>
        <h1 style={{ margin: '0.25rem 0 0' }}>管理剧本</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
          创建或编辑你的剧本，在房间开局时选择使用
        </p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <Link to="/games/script_murder/scripts/new/edit" className="btn">
          新建剧本
        </Link>
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>加载中…</p>
      ) : (
        <>
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem' }}>官方剧本</h2>
            {official.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>暂无官方剧本</p>
            ) : (
              <div className="grid grid-rooms">
                {official.map((s) => (
                  <article key={s.id} className="card">
                    <h3 style={{ margin: 0 }}>{s.title}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{s.description}</p>
                    <p style={{ fontSize: '0.85rem' }}>
                      {s.characterCount} 角色 · {s.actCount} 幕
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 style={{ fontSize: '1.1rem' }}>我的剧本</h2>
            {mine.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>还没有剧本，点击上方按钮创建</p>
            ) : (
              <div className="grid grid-rooms">
                {mine.map((s) => (
                  <article key={s.id} className="card">
                    <h3 style={{ margin: 0 }}>{s.title}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{s.description}</p>
                    <p style={{ fontSize: '0.85rem' }}>
                      {s.characterCount} 角色 · {s.actCount} 幕 · {s.minPlayers}–{s.maxPlayers} 人
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <Link to={`/games/script_murder/scripts/${s.id}/edit`} className="btn">
                        编辑
                      </Link>
                      <button type="button" className="btn btn-ghost" onClick={() => handleDelete(s.id)}>
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
