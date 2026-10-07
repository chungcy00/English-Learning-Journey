import React, { useState } from 'react';
import { useModalDialog } from '../hooks/useModalDialog';

export const WordbookRemovalDialog: React.FC<{
  term: string; onCancel: () => void; onConfirm: () => Promise<void>;
}> = ({ term, onCancel, onConfirm }) => {
  const ref = useModalDialog(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await onConfirm(); }
    catch { setError('移除未完成，请稍后重试。'); setBusy(false); }
  };
  return <dialog ref={ref} aria-labelledby="removal-title" aria-describedby="removal-description" onCancel={event => {
    event.preventDefault();
    if (!busy) onCancel();
  }} className="app-dialog word-detail-dialog m-auto w-[calc(100%_-_2rem)] max-w-md border border-[var(--border-subtle)] rounded-sm bg-[var(--bg-primary)] text-[var(--text-primary)] p-6 shadow-lg">
    <h2 id="removal-title" className="font-ui text-[length:var(--type-section)] leading-[1.3] font-semibold">移出生词本？</h2>
    <p id="removal-description" className="type-body mt-3 font-ui break-words">“{term}” 移除后将不再出现在复习中。</p>
    {error && <p role="alert" className="mt-3 text-[length:var(--type-body)] leading-[1.6] text-[var(--status-error)]">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button data-dialog-initial-focus type="button" disabled={busy} onClick={onCancel} className="min-h-11 px-4 py-2 border border-[var(--border-subtle)] rounded-sm text-[length:var(--type-label)] leading-[1.4] font-ui hover:bg-[var(--bg-alt)] disabled:opacity-50">取消</button>
      <button type="button" disabled={busy} onClick={() => void confirm()} className="min-h-11 px-4 py-2 rounded-sm text-[length:var(--type-label)] leading-[1.4] font-ui bg-[var(--accent-primary)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50">{busy ? '正在移除…' : '确认移除'}</button>
    </div>
  </dialog>;
};
