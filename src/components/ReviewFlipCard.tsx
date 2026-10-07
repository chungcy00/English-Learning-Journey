import React, { useEffect, useRef } from 'react';

/** Only the active face participates in layout and keyboard navigation. */
export function ReviewFlipCard({ revealed, front, children, onFlip, disabled = false }: {
  revealed: boolean; front: React.ReactNode; children: React.ReactNode; onFlip?: () => void; disabled?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(revealed);
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
    onClick: (event: React.MouseEvent) => {
      // Nested controls keep their own actions (audio, ratings and collocations).
      if (!disabled && !(event.target as Element).closest('button, summary, input, select, a')) onFlip?.();
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
