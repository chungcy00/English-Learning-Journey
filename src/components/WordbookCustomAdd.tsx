import { vocabularyHeadword } from '../utils/vocabularyCase';
import { LoadingAnimation } from './LoadingAnimation';
import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ReadingRecord, VocabularyItem } from '../types';
import { isEnglishTermQuery } from '../utils/englishSearch';
import { basicVocabulary, cleanTerm, vocabularyKey } from '../utils/vocabularyDetails';
import { readVocabularyDetails } from '../services/vocabularyDetails';
import { VocabularyDetailsPanel } from './VocabularyDetailsPanel';

// Kept for older importers; new manual entries do not require a passage.
export function customWordbookItem(details: Partial<VocabularyItem>, reading: ReadingRecord | null, now: number, id: string): VocabularyItem {
  return { ...basicVocabulary(details.term || '', details.type), ...details, id, savedManually: true, createdAt: now, updatedAt: now };
}
export function WordbookCustomAdd({ vocabulary, onSave, initiallyOpen = false }: { reading: ReadingRecord | null; vocabulary: VocabularyItem[]; onSave: (item: VocabularyItem) => Promise<void>; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<VocabularyItem | null>(null);
  const [duplicate, setDuplicate] = useState<VocabularyItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const prepare = (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setMessage(''); setPreview(null); setDuplicate(null);
    const term = vocabularyHeadword(cleanTerm(query));
    if (!isEnglishTermQuery(term) || term.length > 160) { setError('请输入有效英文单词、短语、习语或搭配。'); return; }
    const type = term.includes(' ') ? 'phrase' : 'word';
    const existing = vocabulary.find(item => vocabularyKey(vocabularyHeadword(item.term, item.partOfSpeech), item.type) === vocabularyKey(term, type));
    if (existing) { setDuplicate(existing); return; }
    setPreview(basicVocabulary(term, type));
  };
  const save = async () => {
    if (!preview || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const details = await readVocabularyDetails(preview);
      await onSave({ ...preview, cefrLevel: preview.cefrLevel || details.cefrLevel, details, type: details.type, category: details.category, phonetic: details.phoneticUK || details.phoneticUS,
        meaningZh: details.senses.map(item => item.meaningZh || item.text).join('；'), partOfSpeech: details.senses.map(item => item.partOfSpeech).filter(Boolean).join(' / '),
        example: details.sections.examples[0]?.text || '', definitionEn: details.sections.definitions.map(item => item.text).join('\n'), collocations: details.sections.phrases.map(item => item.text), savedManually: true, updatedAt: Date.now() });
      setMessage(`已保存“${vocabularyHeadword(preview.term, preview.partOfSpeech)}”，可在全部词条中查看。`); setPreview(null); setQuery(''); setDuplicate(null);
    } catch (error) { setError(error instanceof Error ? error.message : '保存失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="wordbook-custom-add">
    {!initiallyOpen && <button type="button" className="wordbook-custom-toggle" aria-expanded={open} aria-controls="wordbook-custom-panel" onClick={() => setOpen(!open)}><Plus size={17}/>添加单词／词组</button>}
    {open && <div id="wordbook-custom-panel">
      <form onSubmit={prepare} className="lexicon-add-form"><label>英语词条<input value={query} disabled={busy} maxLength={160} placeholder="例如 considerate 或 break the ice" onChange={event => { setQuery(event.target.value); setPreview(null); setDuplicate(null); setError(''); }}/></label><button className="lexicon-primary" type="submit" disabled={busy || !query.trim()}>检查并预览</button></form>
      {duplicate && <div className="lexicon-confirm"><p>“{vocabularyHeadword(duplicate.term, duplicate.partOfSpeech)}”已存在，不会创建重复词条。</p><button type="button" onClick={() => { setPreview(duplicate); setDuplicate(null); }}>打开原词条</button><button type="button" onClick={() => { setPreview(duplicate); setDuplicate(null); setMessage('在原词条中编辑或补充资料，复习进度保持。'); }}>合并／补充资料</button><button type="button" onClick={() => setDuplicate(null)}>取消</button></div>}
      {preview && <div className="lexicon-add-preview"><h3>{vocabularyHeadword(preview.term, preview.partOfSpeech)}</h3><VocabularyDetailsPanel key={preview.id} vocab={preview} loadingOperation="analysis"/><div className="lexicon-actions"><button type="button" className="lexicon-primary" disabled={busy} onClick={() => void save()}>{busy ? '保存中…' : '保存到单词本'}</button><button type="button" disabled={busy} onClick={() => setPreview(null)}>取消预览</button></div><p className="lexicon-muted">可以先保存基本词条，以后再补充资料。</p></div>}
      <LoadingAnimation active={busy} operation="wait" label="正在保存词条…"/>
    </div>}{error && <p role="alert" className="wordbook-error">{error}</p>}{message && <p role="status" className="wordbook-message">{message}</p>}
  </section>;
}
