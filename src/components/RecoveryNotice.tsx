import React from 'react';

export function RecoveryNotice({ message, onRetry, pending = false }: {
  message: string; onRetry: () => void; pending?: boolean;
}) {
  return <div className="recovery-notice font-ui">
    <p role="alert" className="type-label">{message}</p>
    <button type="button" disabled={pending} onClick={onRetry} className="type-label min-h-11 px-3 py-2 rounded-sm border border-current disabled:opacity-60">
      {pending ? '正在重试…' : '重试'}
    </button>
  </div>;
}
