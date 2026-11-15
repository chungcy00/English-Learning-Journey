import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';

export function moveEditorItems<T>(items: T[], index: number, direction: number): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

type EditorUndoDetail = { undo: () => void; message: string };
const UndoContext = createContext({
  record: (_undo: () => void, _message?: string) => {}, clear: () => {},
  pending: null as EditorUndoDetail | null,
});

export function EditorUndoProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<EditorUndoDetail | null>(null);
  const generation = useRef(0);
  const clear = useCallback(() => { generation.current++; setPending(null); }, []);
  const record = useCallback((undo: () => void, message = '已删除') => {
    const current = generation.current;
    setPending({ message, undo: () => { if (generation.current === current) undo(); } });
  }, []);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(null), 6000);
    return () => clearTimeout(timer);
  }, [pending]);
  return <UndoContext.Provider value={{ record, clear, pending }}>{children}</UndoContext.Provider>;
}

export const useEditorUndo = () => useContext(UndoContext).record;
export const useClearEditorUndo = () => useContext(UndoContext).clear;

export function EditorUndoNotice() {
  const { pending, clear } = useContext(UndoContext);
  if (!pending) return null;
  return <div className="editor-undo-toast" role="status"><span>{pending.message}</span><button type="button" onClick={() => { pending.undo(); clear(); }}>撤销</button></div>;
}

export function EditorOrderActions({ label, first, last, onMove, onRemove, className = '' }: {
  label: string; first: boolean; last: boolean; onMove: (direction: number) => void; onRemove: () => void; className?: string;
}) {
  return <div className={`editor-order-actions ${className}`.trim()}>
    {!(first && last) && <>
      <button type="button" aria-label={`上移${label}`} title="上移" disabled={first} onClick={() => onMove(-1)}><ArrowUp size={16}/></button>
      <button type="button" aria-label={`下移${label}`} title="下移" disabled={last} onClick={() => onMove(1)}><ArrowDown size={16}/></button>
    </>}
    <button type="button" aria-label={`删除${label}`} title="删除" onClick={onRemove}><Trash2 size={16}/></button>
  </div>;
}
