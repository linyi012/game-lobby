import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { GAME_META } from '@game-lobby/shared';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../lib/api';

export function PairPackManagePage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<api.PairPackCategory[]>([]);
  const [packs, setPacks] = useState<api.UserPairPack[]>([]);
  const [syncStatus, setSyncStatus] = useState<api.PairPackSyncStatus | null>(null);
  const [name, setName] = useState('');
  const [pairsText, setPairsText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const meta = GAME_META.undercover;

  async function reload() {
    if (!token) return;
    const [cats, mine, sync] = await Promise.all([
      api.fetchPairPackCategories(token),
      api.fetchMyPairPacks(token),
      api.fetchPairPackSyncStatus(token),
    ]);
    setCategories(cats);
    setPacks(mine);
    setSyncStatus(sync);
  }

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : '加载失败'));
  }, [token]);

  function pairsToText(pairs: [string, string][]) {
    return pairs.map(([a, b]) => `${a},${b}`).join('\n');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setMessage('');
    const pairs = api.parsePairLines(pairsText);
    if (!name.trim() || pairs.length === 0) {
      setError('请填写名称和至少一组词对（每行：平民词,卧底词）');
      return;
    }
    try {
      if (editingId) {
        await api.updatePairPack(token, editingId, name.trim(), pairs);
        setMessage('词对库已更新');
      } else {
        await api.createPairPack(token, name.trim(), pairs);
        setMessage('词对库已创建');
      }
      setName('');
      setPairsText('');
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  async function handleDelete(id: string) {
    if (!token || !window.confirm('确定删除该词对库？')) return;
    await api.deletePairPack(token, id);
    await reload();
  }

  async function handleSync() {
    if (!token) return;
    setMessage('正在同步官方词对库…');
    const status = await api.triggerPairPackSync(token);
    setSyncStatus(status);
    setMessage(status.success ? `同步完成（版本 ${status.version}）` : `同步失败：${status.error}`);
    await reload();
  }

  if (!meta.hasPairPacks) {
    return <Navigate to="/games/undercover" replace />;
  }

  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link to="/games/undercover" style={{ color: 'var(--text-muted)' }}>
          ← 返回{meta.name}大厅
        </Link>
        <h1 style={{ margin: 0, flex: 1 }}>词对包管理</h1>
      </div>

      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      {message && <div style={{ color: 'var(--success)' }}>{message}</div>}

      <section className="card">
        <h3 style={{ marginTop: 0 }}>官方分类</h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {categories.map((c) => (
            <li key={c.id}>
              {c.name}（{c.pairCount} 组词对）
            </li>
          ))}
        </ul>
        <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {syncStatus?.lastSyncedAt ? (
            <>
              最近同步：{new Date(syncStatus.lastSyncedAt).toLocaleString()} · 版本{' '}
              {syncStatus.version ?? '—'}
              {syncStatus.error && ` · 错误：${syncStatus.error}`}
            </>
          ) : (
            '尚未同步官方词对库（将使用内置种子）'
          )}
        </div>
        <button type="button" className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={handleSync}>
          手动同步官方词对库
        </button>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>{editingId ? '编辑个人词对库' : '新建个人词对库'}</h3>
        <form onSubmit={handleSave} style={{ display: 'grid', gap: '0.75rem' }}>
          <input
            className="input"
            placeholder="词对库名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className="input"
            rows={5}
            placeholder="每行一组词对：平民词,卧底词"
            value={pairsText}
            onChange={(e) => setPairsText(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn">
              {editingId ? '保存' : '创建'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setName('');
                  setPairsText('');
                }}
              >
                取消
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>我的词对库</h3>
        {packs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>暂无个人词对库</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {packs.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: '0.75rem',
                  background: 'var(--surface-2)',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <strong>
                    {p.name}（{p.pairs.length} 组）
                  </strong>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditingId(p.id);
                        setName(p.name);
                        setPairsText(pairsToText(p.pairs));
                      }}
                    >
                      编辑
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => handleDelete(p.id)}>
                      删除
                    </button>
                  </div>
                </div>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {p.pairs
                    .slice(0, 6)
                    .map(([a, b]) => `${a}/${b}`)
                    .join(' · ')}
                  {p.pairs.length > 6 ? '…' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
