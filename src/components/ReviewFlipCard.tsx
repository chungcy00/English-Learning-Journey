import React, { useEffect, useRef } from 'react';

/** Only the active face participates in layout and keyboard navigation. */
export function ReviewFlipCard({ revealed, front, children }: {
  revealed: boolean; front: React.ReactNode; children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef(revealed);
  useEffect(() => {
    if (previous.current !== revealed) {
      root.current?.querySelector<HTMLElement>('[data-active-face] [data-flip-focus]')?.focus({ preventScroll: true });
      previous.current = revealed;
    }
  }, [revealed]);
  return <div ref={root} className="review-flip-stage">
    <div className={`review-flip-inner ${revealed ? 'is-revealed' : ''}`}>
      <div className="review-flip-face review-flip-front" aria-hidden={revealed} inert={revealed} data-active-face={!revealed ? '' : undefined}>
        {front}
      </div>
      <div className="review-flip-face review-flip-back" aria-hidden={!revealed} inert={!revealed} data-active-face={revealed ? '' : undefined}>
        {children}
      </div>
    </div>
  </div>;
}
