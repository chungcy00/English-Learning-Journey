import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ExpressionOption { term: string; type: string; selected: boolean }
export function ExpressionSelect({ options, value, disabled, loading, onOpen, onChange, identity }: {
  options: ExpressionOption[]; value: string; disabled: boolean; loading: boolean;
  onOpen: () => void; onChange: (term: string) => void; identity: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const keyboardNavigation = useRef(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const chosen = options.find(option => option.term === value);
  useEffect(() => { setOpen(false); setActive(0); }, [identity]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  useEffect(() => {
    if (open && keyboardNavigation.current) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);
  const choose = (term: string) => { setOpen(false); trigger.current?.focus(); onChange(term); };
  const label = (option: ExpressionOption) => <>
    <span className="type-example">{option.term}</span> <span className="type-label italic text-[var(--text-secondary)]">{option.type}</span>
    {option.selected && <span aria-label="已选"> ☑️</span>}
  </>;
  return <div ref={root} className="relative min-w-0 flex-1 basis-64" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <span id={`${id}-label`} className="block mb-1.5 text-[var(--text-primary)]">选择文中的单词、短语或习语</span>
    <button ref={trigger} type="button" role="combobox" aria-label="选择当前短文的同级表达"
      aria-haspopup="listbox" aria-controls={`${id}-list`} aria-expanded={open}
      aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined}
      disabled={disabled} onClick={() => { keyboardNavigation.current = false; onOpen(); setOpen(!open); }}
      onKeyDown={event => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); onOpen(); setOpen(true);
          keyboardNavigation.current = true;
          setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? Math.max(0, options.length - 1)
            : !open ? Math.max(0, options.findIndex(option => option.term === value))
            : Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
        } else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
        else if (open && ['Enter', ' '].includes(event.key)) {
          event.preventDefault(); if (options[active]) choose(options[active].term);
        }
      }} className="w-full min-h-11 flex items-center justify-between gap-3 px-3 py-2 text-base text-left border border-[var(--border-subtle)] rounded-sm bg-[var(--bg-primary)] text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--accent-vocab)] disabled:opacity-50">
      <span className="min-w-0 break-words">{chosen ? label(chosen) : '请选择文中的表达'}</span>
      <ChevronDown aria-hidden="true" className="w-4 h-4 shrink-0" />
    </button>
    {open && <div id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}
      className="expression-options absolute top-full left-0 right-0 mt-2 z-30 max-h-72 overflow-y-auto border border-[var(--border-subtle)] bg-[var(--surface-paper)] shadow-lg">
      {loading && <p role="status" className="p-3 text-sm text-[var(--text-secondary)]">正在识别短文中的表达…</p>}
      {!loading && !options.length && <p className="p-3 text-sm text-[var(--text-secondary)]">暂无可选的同级表达</p>}
      {options.map((option, index) => <button key={option.term} id={`${id}-${index}`} type="button"
        role="option" aria-selected={option.term === value} tabIndex={-1}
        onPointerMove={() => { keyboardNavigation.current = false; setActive(index); }} onClick={() => choose(option.term)}
        className={`w-full text-left px-3 py-2.5 text-base break-words border-b border-[var(--border-subtle)]/50 last:border-0 ${active === index ? 'bg-[var(--bg-alt)]' : 'hover:bg-[var(--bg-alt)]/60'}`}>
        {label(option)}
      </button>)}
    </div>}
  </div>;
}
