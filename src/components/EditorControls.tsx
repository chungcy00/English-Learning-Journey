import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';

export function moveEditorItems<T>(items: T[], index: number, direction: number): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

type EditorUndoDetail = { undo: () => void; message: string };
const EDITOR_UNDO_EVENT = 'lexicon-editor-undo';

export function recordEditorUndo(undo: () => void, message = '已删除') {
  window.dispatchEvent(new CustomEvent<EditorUndoDetail>(EDITOR_UNDO_EVENT, { detail: { undo, message } }));
}

export function EditorUndoNotice() {
  const [pending, setPending] = useState<EditorUndoDetail | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const receive = (event: Event) => {
      if (timeout.current) clearTimeout(timeout.current);
      setPending((event as CustomEvent<EditorUndoDetail>).detail);
      timeout.current = setTimeout(() => setPending(null), 6000);
    };
    window.addEventListener(EDITOR_UNDO_EVENT, receive);
    return () => { window.removeEventListener(EDITOR_UNDO_EVENT, receive); if (timeout.current) clearTimeout(timeout.current); };
  }, []);
  if (!pending) return null;
  return <div className="editor-undo-toast" role="status"><span>{pending.message}</span><button type="button" onClick={() => { pending.undo(); if (timeout.current) clearTimeout(timeout.current); timeout.current = null; setPending(null); }}>撤销</button></div>;
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
