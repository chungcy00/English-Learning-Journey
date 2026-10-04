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
  }} className="word-detail-dialog m-auto w-[calc(100%_-_2rem)] max-w-md border border-[#D4CCBC] rounded-sm bg-[#F2EEE4] text-[#292B25] p-6 shadow-lg">
    <h2 id="removal-title" className="font-ui text-lg font-semibold">移出生词本？</h2>
    <p id="removal-description" className="mt-3 text-sm font-ui break-words">“{term}” 移除后将不再出现在复习中。取消会保留词条和当前学习进度。</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button data-dialog-initial-focus type="button" disabled={busy} onClick={onCancel} className="min-h-11 px-4 py-2 border border-[#D4CCBC] rounded-sm text-sm font-ui hover:bg-[#E5DED0] disabled:opacity-50">取消</button>
      <button type="button" disabled={busy} onClick={() => void confirm()} className="min-h-11 px-4 py-2 rounded-sm text-sm font-ui bg-[#62694D] text-[#F2EEE4] hover:bg-[#5F654D] disabled:opacity-50">{busy ? '正在移除…' : '确认移除'}</button>
    </div>
  </dialog>;
};
