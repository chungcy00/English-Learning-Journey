import React, { useRef, useState } from 'react';
import { exportMyData, importMyData } from '../db/dexie';
import { notifyVocabularyChange } from '../services/vocabularyDetails';
export function LocalDataBackup() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const backup = async () => { setBusy(true); setError(''); try {
    const json = await exportMyData();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `mine-english-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('备份已导出，包含词汇详情、独立收藏、短文和复习记录。');
  } catch { setError('备份导出失败，请重试。'); } finally { setBusy(false); } };
  const restore = async () => { if (!pending) return; setBusy(true); setError(''); try { await importMyData(pending); setPending(null); notifyVocabularyChange(); setMessage('备份已合并还原。重新打开页面可更新短文列表和设置。'); } catch { setError('备份还原失败，请检查文件格式，已有学习资料保持可用。'); } finally { setBusy(false); } };
  return <section className="wordbook-backup"><h2 className="type-section">本机数据备份</h2><p className="lexicon-muted">资料保存在当前浏览器，可通过备份文件迁移到其他设备。</p><button type="button" disabled={busy} onClick={() => void backup()}>导出完整备份</button><button type="button" disabled={busy} onClick={() => input.current?.click()}>从备份还原</button><input ref={input} className="sr-only" aria-label="选择本地备份文件" tabIndex={-1} type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void file.text().then(setPending).catch(() => setError('文件读取失败，请重试。')); }}/>
    {pending && <div className="lexicon-confirm"><p>还原将合并备份资料，相同编号的条目及其复习进度以备份内容为准。建议先导出当前资料。</p><button type="button" disabled={busy} onClick={() => void restore()}>确认合并还原</button><button type="button" disabled={busy} onClick={() => setPending(null)}>取消</button></div>}{error && <p role="alert" className="wordbook-error">{error}</p>}{message && <p role="status" className="lexicon-muted">{message}</p>}
  </section>;
}
