import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../lib/api';

const PHASE_OPTIONS: api.MurderScriptAct['phases'][number][] = [
  'intro',
  'reading',
  'discussion',
  'search',
  'vote',
  'reveal',
];

const PHASE_LABELS: Record<(typeof PHASE_OPTIONS)[number], string> = {
  intro: '序幕',
  reading: '阅读',
  discussion: '讨论',
  search: '搜证',
  vote: '投票',
  reveal: '揭晓',
};

function newCharacter(index: number): api.MurderScriptCharacter {
  const id = `char-${Date.now()}-${index}`;
  return {
    id,
    name: `角色 ${index + 1}`,
    publicProfile: '',
    privateScript: '',
    objectives: '',
  };
}

function defaultContent(): api.MurderScriptContent {
  return {
    characters: [newCharacter(0), newCharacter(1), newCharacter(2), newCharacter(3)],
    acts: [
      {
        order: 1,
        title: '第一幕',
        publicText: '故事从这里开始……',
        phases: ['intro', 'reading', 'discussion', 'vote', 'reveal'],
        autoAdvanceSec: 120,
      },
    ],
    clues: [],
  };
}

export function ScriptEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { token } = useAuth();
  const [tab, setTab] = useState<'basic' | 'characters' | 'acts' | 'clues'>('basic');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minPlayers, setMinPlayers] = useState(4);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [content, setContent] = useState<api.MurderScriptContent>(defaultContent);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || isNew) return;
    api
      .fetchMurderScript(token, id!)
      .then((script) => {
        setTitle(script.title);
        setDescription(script.description);
        setMinPlayers(script.minPlayers);
        setMaxPlayers(script.maxPlayers);
        setContent(script.content);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [token, id, isNew]);

  const validationHint = useMemo(() => {
    const n = content.characters.length;
    if (n < minPlayers || n > maxPlayers) {
      return `角色数（${n}）须在 ${minPlayers}–${maxPlayers} 之间`;
    }
    return '';
  }, [content.characters.length, minPlayers, maxPlayers]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setMessage('');
    const body = { title, description, minPlayers, maxPlayers, content };
    try {
      if (isNew) {
        const created = await api.createMurderScript(token, body);
        setMessage('剧本已创建');
        navigate(`/games/script_murder/scripts/${created.id}/edit`, { replace: true });
      } else {
        await api.updateMurderScript(token, id!, body);
        setMessage('剧本已保存');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <p style={{ color: 'var(--text-muted)' }}>加载中…</p>;

  return (
    <div>
      <Link to="/games/script_murder/scripts" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        ← 返回剧本列表
      </Link>
      <h1 style={{ margin: '0.25rem 0 1rem' }}>{isNew ? '新建剧本' : '编辑剧本'}</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {(['basic', 'characters', 'acts', 'clues'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn${tab === t ? '' : ' btn-ghost'}`}
            onClick={() => setTab(t)}
          >
            {t === 'basic' && '基本信息'}
            {t === 'characters' && '角色'}
            {t === 'acts' && '幕次'}
            {t === 'clues' && '线索'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="card" style={{ display: 'grid', gap: '1rem' }}>
        {tab === 'basic' && (
          <>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>标题</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>简介</span>
              <textarea
                className="input"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>最少人数</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={8}
                  value={minPlayers}
                  onChange={(e) => setMinPlayers(Number(e.target.value))}
                />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>最多人数</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={8}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                />
              </label>
            </div>
          </>
        )}

        {tab === 'characters' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {content.characters.map((char, i) => (
              <div key={char.id} className="card" style={{ background: 'var(--surface-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong>角色 {i + 1}</strong>
                  {content.characters.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        setContent({
                          ...content,
                          characters: content.characters.filter((c) => c.id !== char.id),
                        })
                      }
                    >
                      删除
                    </button>
                  )}
                </div>
                <label style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <span>名称</span>
                  <input
                    className="input"
                    value={char.name}
                    onChange={(e) => {
                      const characters = [...content.characters];
                      characters[i] = { ...char, name: e.target.value };
                      setContent({ ...content, characters });
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <span>公开简介</span>
                  <textarea
                    className="input"
                    rows={2}
                    value={char.publicProfile}
                    onChange={(e) => {
                      const characters = [...content.characters];
                      characters[i] = { ...char, publicProfile: e.target.value };
                      setContent({ ...content, characters });
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <span>角色本（私密）</span>
                  <textarea
                    className="input"
                    rows={4}
                    value={char.privateScript}
                    onChange={(e) => {
                      const characters = [...content.characters];
                      characters[i] = { ...char, privateScript: e.target.value };
                      setContent({ ...content, characters });
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  <span>目标</span>
                  <textarea
                    className="input"
                    rows={2}
                    value={char.objectives}
                    onChange={(e) => {
                      const characters = [...content.characters];
                      characters[i] = { ...char, objectives: e.target.value };
                      setContent({ ...content, characters });
                    }}
                  />
                </label>
              </div>
            ))}
            {content.characters.length < 8 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setContent({
                    ...content,
                    characters: [...content.characters, newCharacter(content.characters.length)],
                  })
                }
              >
                添加角色
              </button>
            )}
          </div>
        )}

        {tab === 'acts' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {content.acts.map((act, i) => (
              <div key={act.order} className="card" style={{ background: 'var(--surface-2)' }}>
                <label style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <span>幕标题</span>
                  <input
                    className="input"
                    value={act.title}
                    onChange={(e) => {
                      const acts = [...content.acts];
                      acts[i] = { ...act, title: e.target.value };
                      setContent({ ...content, acts });
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <span>公开叙事</span>
                  <textarea
                    className="input"
                    rows={3}
                    value={act.publicText}
                    onChange={(e) => {
                      const acts = [...content.acts];
                      acts[i] = { ...act, publicText: e.target.value };
                      setContent({ ...content, acts });
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <span>阶段超时（秒）</span>
                  <input
                    className="input"
                    type="number"
                    min={10}
                    max={3600}
                    value={act.autoAdvanceSec ?? 120}
                    onChange={(e) => {
                      const acts = [...content.acts];
                      acts[i] = { ...act, autoAdvanceSec: Number(e.target.value) };
                      setContent({ ...content, acts });
                    }}
                  />
                </label>
                <div>
                  <span style={{ fontSize: '0.9rem' }}>阶段序列</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.35rem' }}>
                    {PHASE_OPTIONS.map((phase) => (
                      <label key={phase} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <input
                          type="checkbox"
                          checked={act.phases.includes(phase)}
                          onChange={(e) => {
                            const acts = [...content.acts];
                            const phases = e.target.checked
                              ? [...act.phases, phase]
                              : act.phases.filter((p) => p !== phase);
                            acts[i] = { ...act, phases };
                            setContent({ ...content, acts });
                          }}
                        />
                        {PHASE_LABELS[phase]}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                setContent({
                  ...content,
                  acts: [
                    ...content.acts,
                    {
                      order: content.acts.length + 1,
                      title: `第 ${content.acts.length + 1} 幕`,
                      publicText: '',
                      phases: ['intro', 'reading', 'discussion', 'vote', 'reveal'],
                      autoAdvanceSec: 120,
                    },
                  ],
                })
              }
            >
              添加幕次
            </button>
          </div>
        )}

        {tab === 'clues' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {content.clues.map((clue, i) => (
              <div key={clue.id} className="card" style={{ background: 'var(--surface-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong>线索 {i + 1}</strong>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setContent({
                        ...content,
                        clues: content.clues.filter((c) => c.id !== clue.id),
                      })
                    }
                  >
                    删除
                  </button>
                </div>
                <label style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <span>标题</span>
                  <input
                    className="input"
                    value={clue.title}
                    onChange={(e) => {
                      const clues = [...content.clues];
                      clues[i] = { ...clue, title: e.target.value };
                      setContent({ ...content, clues });
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <span>内容</span>
                  <textarea
                    className="input"
                    rows={3}
                    value={clue.content}
                    onChange={(e) => {
                      const clues = [...content.clues];
                      clues[i] = { ...clue, content: e.target.value };
                      setContent({ ...content, clues });
                    }}
                  />
                </label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'grid', gap: '0.35rem' }}>
                    <span>最早出现幕</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={clue.revealAct}
                      onChange={(e) => {
                        const clues = [...content.clues];
                        clues[i] = { ...clue, revealAct: Number(e.target.value) };
                        setContent({ ...content, clues });
                      }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '0.35rem' }}>
                    <span>可见性</span>
                    <select
                      className="input"
                      value={clue.visibility}
                      onChange={(e) => {
                        const clues = [...content.clues];
                        clues[i] = {
                          ...clue,
                          visibility: e.target.value as api.MurderScriptClue['visibility'],
                        };
                        setContent({ ...content, clues });
                      }}
                    >
                      <option value="public">公开</option>
                      <option value="character">角色专属</option>
                      <option value="search">搜证获得</option>
                    </select>
                  </label>
                  {clue.visibility === 'character' && (
                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                      <span>关联角色</span>
                      <select
                        className="input"
                        value={clue.characterId ?? ''}
                        onChange={(e) => {
                          const clues = [...content.clues];
                          clues[i] = { ...clue, characterId: e.target.value || undefined };
                          setContent({ ...content, clues });
                        }}
                      >
                        <option value="">选择角色</option>
                        {content.characters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                setContent({
                  ...content,
                  clues: [
                    ...content.clues,
                    {
                      id: `clue-${Date.now()}`,
                      title: '新线索',
                      content: '',
                      revealAct: 1,
                      visibility: 'search',
                    },
                  ],
                })
              }
            >
              添加线索
            </button>
          </div>
        )}

        {validationHint && <p style={{ color: 'var(--danger)', margin: 0 }}>{validationHint}</p>}
        {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
        {message && <p style={{ color: 'var(--success)', margin: 0 }}>{message}</p>}

        <button type="submit" className="btn" disabled={Boolean(validationHint)}>
          保存剧本
        </button>
      </form>
    </div>
  );
}
