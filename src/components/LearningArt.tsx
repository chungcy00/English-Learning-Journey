import React, { useLayoutEffect, useRef, useState } from 'react';

/** One shared atlas keeps every instance of the two learning companions consistent. */
export const mascotPoses = {
  'cat-welcome': 0, 'cat-reading': 1, 'cat-thinking': 2, 'cat-success': 3,
  'cat-reminder': 4, 'cat-rest': 5, 'cat-peek': 6, together: 7,
  'hamster-welcome': 8, 'hamster-reading': 9, 'hamster-thinking': 10, 'hamster-success': 11,
  'hamster-reminder': 12, 'hamster-rest': 13, 'hamster-peek': 14, sprig: 15,
} as const;
export function Mascot({ pose = 'together', className = '', eager = false }: {
  pose?: keyof typeof mascotPoses; className?: string; eager?: boolean;
}) {
  const cell = mascotPoses[pose];
  return <span className={`learning-art ${className}`} aria-hidden="true" data-pose={pose}>
    <img src="/illustrations/learning-companions.webp" alt="" width={1254} height={1254}
      loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false}
      style={{ transform: `translate(${-25 * (cell % 4)}%, ${-25 * Math.floor(cell / 4)}%)` }}/>
  </span>;
}
export function Companion({ pose = 'cat-peek', className = '' }: {
  pose?: keyof typeof mascotPoses; className?: string;
}) {
  return <Mascot pose={pose} className={`learning-companion ${className}`}/>;
}
/** Pure geometry; the stroke inherits the existing theme and never captures input. */
export function HandRule({ className = '' }: { className?: string }) {
  return <svg className={`hand-rule ${className}`} viewBox="0 0 1000 8" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M1 4 C75 1 115 7 190 4 S300 2 375 4 S465 7 545 4 S675 1 745 4 S885 7 999 3"/></svg>;
}
export function StudyEmptyState({ children, compact = false, pose = 'hamster-reading', busy = false }: {
  children: React.ReactNode; compact?: boolean; pose?: keyof typeof mascotPoses; busy?: boolean;
}) {
  return <div className={`study-empty ${compact ? 'study-empty--compact' : ''} ${busy ? 'study-empty--waiting' : ''}`}>
    {!compact&&<HandOutline/>}{!busy&&<Mascot pose={pose}/>}<div className="study-empty__copy">{children}</div>
  </div>;
}

/** Pixel-sized corners and a sub-pixel wave stay consistent on short and tall cards. */
export function HandOutline() {
  const ref = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const measure = () => { const { width, height } = parent.getBoundingClientRect();
      if (width && height) setBox(previous => Math.abs(previous.width-width)<.5 && Math.abs(previous.height-height)<.5 ? previous : { width, height }); };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  const { width: w, height: h } = box;
  const r = Math.min(16, w/4, h/4), x = w-2, y = h-2;
  const path = w && h ? `M ${r+2} 2 C ${w*.25} 1.4 ${w*.48} 2.7 ${w*.7} 2 S ${x-r} 1.5 ${x-r} 2 Q ${x} 2 ${x} ${r+2} C ${x-.6} ${h*.3} ${x+.5} ${h*.6} ${x} ${y-r} Q ${x} ${y} ${x-r} ${y} C ${w*.7} ${y+.5} ${w*.4} ${y-.6} ${r+2} ${y} Q 2 ${y} 2 ${y-r} C 1.4 ${h*.7} 2.6 ${h*.4} 2 ${r+2} Q 2 2 ${r+2} 2 Z` : '';
  return <svg ref={ref} className="hand-outline" viewBox={`0 0 ${w || 1} ${h || 1}`} preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d={path}/></svg>;
}
