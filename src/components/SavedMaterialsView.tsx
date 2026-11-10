import { LoadingAnimation } from './LoadingAnimation';
import React, { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { db } from '../db/dexie';
import type { SavedMaterial } from '../types';
import { materialKey } from '../utils/vocabularyDetails';
import { notifyVocabularyChange } from '../services/vocabularyDetails';
import { speakEnglishTerm } from '../utils/speech';

export function SavedMaterialsView({ type, search, hideWhenEmpty = false }: { type: SavedMaterial['type']; search: string; hideWhenEmpty?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [items, setItems] = useState<SavedMaterial[]>([]);
  const [draft, setDraft] = useState<SavedMaterial | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => { setLoading(true); setLoadError(false); setError(''); void db.savedMaterials.where('type').equals(type).toArray().then(result => { if (active) setItems(result); }).catch(() => { if (active) { setLoadError(true); setError('收藏读取失败，请重试。'); } }).finally(() => { if (active) setLoading(false); }); };
    refresh(); window.addEventListener('vocabulary-data-changed', refresh);
    return () => { active = false; window.removeEventListener('vocabulary-data-changed', refresh); };
  }, [type, reload]);
  useEffect(() => { setDraft(null); setError(''); }, [type]);
  const action = async (work: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); try { await work(); notifyVocabularyChange(); } catch (error) { setError(error instanceof Error ? error.message : '操作失败，请重试。'); } finally { setBusy(false); } };
  const filtered = items.filter(item => `${item.text} ${item.translation} ${item.note}`.toLowerCase().includes(search.toLowerCase()));
  if (hideWhenEmpty && !filtered.length && !error && !loading) return null;
  return <section className="saved-materials" aria-label={type === 'example' ? '独立收藏的例句' : '独立收藏的词组'}><p className="lexicon-muted">{items.length} 项独立学习素材 · 取消完整词条收藏后仍保留。</p>
    {filtered.map(item => draft?.id === item.id ? <form key={item.id} className="lexicon-editor" onSubmit={event => { event.preventDefault(); void action(async () => {
      if (!draft.text.trim()) throw new Error('英文内容不能为空。');
      const key = materialKey(draft.type, draft.text);
      await db.transaction('rw', db.savedMaterials, async () => { const duplicate = await db.savedMaterials.where('key').equals(key).first(); if (duplicate && duplicate.id !== draft.id) throw new Error('已收藏相同内容，请修改后保存。'); await db.savedMaterials.put({ ...draft, text: draft.text.trim(), key, source: 'user', updatedAt: Date.now() }); }); setDraft(null);
    }); }}><label>英文内容<textarea value={draft.text} onChange={event => setDraft({ ...draft, text: event.target.value })}/></label><label>中文翻译<textarea value={draft.translation} onChange={event => setDraft({ ...draft, translation: event.target.value })}/></label><label>个人备注<textarea value={draft.note} onChange={event => setDraft({ ...draft, note: event.target.value })}/></label><div className="lexicon-actions"><button type="submit" disabled={busy}>保存</button><button type="button" disabled={busy} onClick={() => setDraft(null)}>取消</button></div></form> : <article key={item.id} className="lexicon-entry"><div className="lexicon-entry-heading"><p lang="en">{item.text}</p><button type="button" aria-label={`朗读：${item.text}`} onClick={() => speakEnglishTerm(item.text, setError)}><Volume2 size={18}/></button></div><p className="lexicon-muted">{item.translation}</p>{item.note && <p>{item.note}</p>}<div className="lexicon-actions"><button type="button" disabled={busy} onClick={() => setDraft({ ...item })}>编辑</button><button type="button" disabled={busy} onClick={() => void action(async () => { await db.savedMaterials.delete(item.id); })}>取消收藏</button></div></article>)}
    <LoadingAnimation active={loading || busy} operation={loading ? 'saved' : 'wait'} label={loading ? '正在读取收藏…' : '正在保存…'}/>{!loading && !filtered.length && <p className="lexicon-empty">{search ? '没有匹配的收藏。' : `暂无独立收藏的${type === 'example' ? '例句' : '词组'}，可在词汇详情中点击书签收藏。`}</p>}{error && <div role="alert" className="wordbook-error"><p>{error}</p>{loadError&&<button type="button" className="lexicon-link" disabled={loading} onClick={()=>setReload(value=>value+1)}>重新读取收藏</button>}</div>}
  </section>;
}
