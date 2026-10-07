import React, { useState } from 'react';
import type { VocabularyItem, VocabStatus } from '../types';

export function VocabularyStatusSelect({ vocab, onUpdate }: { vocab: VocabularyItem; onUpdate: (id: string, status: VocabStatus) => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return <div className="font-ui" onClick={event => event.stopPropagation()}>
    <select aria-label={`${vocab.term} 的学习状态`} value={vocab.status} disabled={pending}
      aria-busy={pending}
      className="min-h-11 max-w-full text-[length:var(--type-label)] leading-[1.4] px-3 py-2 rounded-sm border border-[var(--border-control)] bg-[var(--surface-paper)] text-[var(--text-primary)] disabled:opacity-60"
      onChange={async event => {
        const status = event.target.value as VocabStatus;
        setPending(true);
        setError('');
        try { await onUpdate(vocab.id, status); }
        catch { setError('状态未保存，请重试。'); }
        finally { setPending(false); }
      }}>
      {(['New', 'Learning', 'Difficult', 'Mastered'] as const).map(status => <option key={status} value={status}>{status}</option>)}
    </select>
    {pending && <p role="status" className="type-meta text-[var(--text-secondary)] mt-1">正在保存…</p>}
    {error && <p role="alert" className="text-[length:var(--type-body)] leading-[1.6] mt-1 text-[var(--status-error)]">{error}</p>}
  </div>;
}
