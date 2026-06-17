import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';

export function WordPackManagePage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<api.WordPackCategory[]>([]);
  const [packs, setPacks] = useState<api.UserWordPack[]>([]);
  const [syncStatus, setSyncStatus] = useState<api.WordPackSyncStatus | null>(null);
  const [name, setName] = useState('');
  const [wordsText, setWordsText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function reload() {
    if (!token) return;
    const [cats, mine, sync] = await Promise.all([
      api.fetchWordPackCategories(token),
      api.fetchMyWordPacks(token),
      api.fetchWordPackSyncStatus(token),
    ]);
    setCategories(cats);
    setPacks(mine);
    setSyncStatus(sync);
  }

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : '加载失败'));
  }, [token]);

  function parseWords(text: string) {
    return [...new Set(text.split(/[,，\n]/).map((w) => w.trim()).filter(Boolean))];
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setMessage('');
    const words = parseWords(wordsText);
    if (!name.trim() || words.length === 0) {
      setError('请填写名称和至少一个词语');
      return;
    }
    try {
      if (editingId) {
        await api.updateWordPack(token, editingId, name.trim(), words);
        setMessage('词库已更新');
      } else {
        await api.createWordPack(token, name.trim(), words);
        setMessage('词库已创建');
      }
      setName('');
      setWordsText('');
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  async function handleDelete(id: string) {
    if (!token || !window.confirm('确定删除该词库？')) return;
    await api.deleteWordPack(token, id);
    await reload();
  }

  async function handleSync() {
    if (!token) return;
    setMessage('正在同步官方词库…');
    const status = await api.triggerWordPackSync(token);
    setSyncStatus(status);
    setMessage(status.success ? `同步完成（版本 ${status.version}）` : `同步失败：${status.error}`);
    await reload();
  }

  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link to="/" style={{ color: 'var(--text-muted)' }}>
          ← 返回首页
        </Link>
        <h1 style={{ margin: 0, flex: 1 }}>词语包管理</h1>
      </div>

      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      {message && <div style={{ color: 'var(--success)' }}>{message}</div>}

      <section className="card">
        <h3 style={{ marginTop: 0 }}>官方分类</h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {categories.map((c) => (
            <li key={c.id}>
              {c.name}（{c.wordCount} 词）
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
            '尚未同步官方词库（将使用内置种子）'
          )}
        </div>
        <button type="button" className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={handleSync}>
          手动同步官方词库
        </button>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>{editingId ? '编辑个人词库' : '新建个人词库'}</h3>
        <form onSubmit={handleSave} style={{ display: 'grid', gap: '0.75rem' }}>
          <input
            className="input"
            placeholder="词库名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className="input"
            rows={4}
            placeholder="词语列表，逗号或换行分隔"
            value={wordsText}
            onChange={(e) => setWordsText(e.target.value)}
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
                  setWordsText('');
                }}
              >
                取消
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>我的词库</h3>
        {packs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>暂无个人词库</p>
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
                    {p.name}（{p.words.length} 词）
                  </strong>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditingId(p.id);
                        setName(p.name);
                        setWordsText(p.words.join('\n'));
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
                  {p.words.slice(0, 12).join('、')}
                  {p.words.length > 12 ? '…' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
