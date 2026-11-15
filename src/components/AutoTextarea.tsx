import React, { useLayoutEffect, useRef } from 'react';

function resizeField(field: HTMLTextAreaElement) {
  if (!field.getClientRects().length) return;
  field.style.height = 'auto';
  const style = getComputedStyle(field);
  const borders = style.boxSizing === 'border-box' ? parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) : 0;
  const padding = style.boxSizing === 'content-box' ? parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) : 0;
  field.style.height = `${field.scrollHeight + borders - padding}px`;
}

export function AutoTextarea({ value, onChange, ...props }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string; onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    let frame = 0;
    let width = -1;
    const measure = () => {
      resizeField(field);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(entries => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      if (nextWidth !== width) { width = nextWidth; schedule(); }
    });
    observer.observe(field);
    const ancestors: HTMLDetailsElement[] = [];
    let parent = field.parentElement;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) { ancestors.push(parent); parent.addEventListener('toggle', schedule); }
      parent = parent.parentElement;
    }
    document.fonts?.addEventListener('loadingdone', schedule);
    measure();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      ancestors.forEach(details => details.removeEventListener('toggle', schedule));
      document.fonts?.removeEventListener('loadingdone', schedule);
    };
  }, [value]);
  return <textarea {...props} ref={ref} rows={1} value={value} onChange={event => onChange(event.target.value)} onInput={event => {
    resizeField(event.currentTarget);
  }}/>;
}
