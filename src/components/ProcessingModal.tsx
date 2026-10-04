import React from 'react';
import { Loader2 } from 'lucide-react';
import { useModalDialog } from '../hooks/useModalDialog';

interface ProcessingModalProps { isOpen: boolean; status: string; canCancel: boolean; onCancel: () => void }
export const ProcessingModal: React.FC<ProcessingModalProps> = ({ isOpen, status, canCancel, onCancel }) => {
  const ref = useModalDialog(isOpen);
  if (!isOpen) return null;
  const saving = status === 'Saving';
  return <dialog ref={ref} aria-labelledby="processing-title" aria-describedby="processing-note"
    onCancel={event => { event.preventDefault(); if (canCancel) onCancel(); }}
    className="m-auto w-[calc(100%-2rem)] max-w-md bg-[#F2EEE4] text-[#292B25] border border-[#D4CCBC] rounded-sm p-6 sm:p-8 shadow-md backdrop:bg-[#292B25]/40">
    <h2 id="processing-title" role="status" className="font-editorial text-2xl font-semibold flex items-center gap-2 mb-6">
      <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
      {saving ? '正在保存短文' : '正在生成短文'}
    </h2>
    <p id="processing-note" className="font-ui text-xs text-[#555848] mb-5">取消不会更改已有短文或清空输入。已发送的 AI 请求仍可能计入额度。</p>
    <button data-dialog-initial-focus disabled={!canCancel} onClick={onCancel}
      className="font-ui min-h-11 px-4 border border-[#62694D] rounded-sm text-sm disabled:opacity-60">
      {canCancel ? '取消本次操作' : '正在保存…'}
    </button>
  </dialog>;
};
