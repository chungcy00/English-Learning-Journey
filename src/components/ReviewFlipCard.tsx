import React, { useEffect, useRef } from 'react';

/** Only the active face participates in layout and keyboard navigation. */
export function ReviewFlipCard({ revealed, front, children, onFlip, disabled = false }: {
  revealed: boolean; front: React.ReactNode; children: React.ReactNode; onFlip?: () => void; disabled?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(revealed);
  const gesture = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  useEffect(() => {
    if (previous.current !== revealed) {
      root.current?.querySelector<HTMLElement>('[data-active-face]')?.focus({ preventScroll: true });
      previous.current = revealed;
    }
  }, [revealed]);
  const flipProps = {
    role: 'group', tabIndex: disabled ? -1 : 0,
    'aria-roledescription': '可翻转单词卡',
    'aria-label': revealed ? '翻回词条' : '翻转查看释义', 'aria-disabled': disabled,
    onPointerDown: (event: React.PointerEvent) => {
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    },
    onPointerMove: (event: React.PointerEvent) => {
      const start = gesture.current;
      if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) start.moved = true;
    },
    onPointerCancel: () => { if (gesture.current) gesture.current.moved = true; },
    onScrollCapture: () => { if (gesture.current) gesture.current.moved = true; },
    onClick: (event: React.MouseEvent) => {
      const dragged = event.detail > 0 && gesture.current?.moved;
      gesture.current = null;
      // Nested controls keep their own actions (audio, ratings and collocations).
      if (!disabled && !dragged && event.detail < 2 && window.getSelection()?.isCollapsed !== false
        && !(event.target as Element).closest('[data-flip-ignore]')
        && !(event.target as Element).closest('button, summary, input, select, textarea, label, a, [role="button"]')) onFlip?.();
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.target === event.currentTarget && !disabled && ['Enter', ' '].includes(event.key)) {
        event.preventDefault(); onFlip?.();
      }
    },
  };
  return <div ref={root} className="review-flip-stage">
    <div className={`review-flip-inner ${revealed ? 'is-revealed' : ''}`}>
      <div {...flipProps} tabIndex={!revealed && !disabled ? 0 : -1} className="review-flip-face review-flip-front" aria-hidden={revealed} inert={revealed} data-active-face={!revealed ? '' : undefined}>
        {front}
      </div>
      <div {...flipProps} tabIndex={revealed && !disabled ? 0 : -1} className="review-flip-face review-flip-back" aria-hidden={!revealed} inert={!revealed} data-active-face={revealed ? '' : undefined}>
        {children}
      </div>
    </div>
  </div>;
}
