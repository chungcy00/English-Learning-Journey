import React, { useRef, useState } from 'react';
import { useModalDialog } from '../hooks/useModalDialog';
export function HistoryDeletionDialog({ title, onCancel, onConfirm }: {
  title: string; onCancel: () => void; onConfirm: () => Promise<void>;
}) {
  const ref = useModalDialog(true);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await onConfirm(); }
    catch { setError('删除未完成，历史记录已保留，请重试。'); lock.current = false; setBusy(false); }
  };
  return <dialog ref={ref} className="app-dialog history-deletion-dialog" aria-labelledby="history-delete-title" aria-describedby="history-delete-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="history-delete-title">确定删除这篇历史短文？</h2>
    <p id="history-delete-description">{title}</p>
    {error && <p role="alert">{error}</p>}
    <div><button type="button" data-dialog-initial-focus disabled={busy} onClick={onCancel}>取消</button><button type="button" disabled={busy} onClick={() => void confirm()}>{busy ? '正在删除…' : '确认删除'}</button></div>
  </dialog>;
}
