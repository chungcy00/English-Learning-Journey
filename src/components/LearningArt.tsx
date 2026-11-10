import React, { useLayoutEffect, useRef, useState } from 'react';

/** Official independent PNGs, copied without pixel or alpha changes. */
export const mascotPoses = {
  'cat-peek-vocabulary': { file: 'cat-peeking-vocabulary.png', width: 928, height: 662, perch: '-71.6%' },
  'hamster-peek-flashcard': { file: 'hamster-peeking-flashcard.png', width: 1049, height: 641, perch: '-69.1%' },
  'cat-peek-reading': { file: 'cat-peeking-reading-page.png', width: 693, height: 673, perch: '-73.8%' },
  'hamster-peek-reading': { file: 'hamster-peeking-reading-page.png', width: 723, height: 609, perch: '-74.1%' },
  'cat-peek-history': { file: 'cat-peeking-history-page.png', width: 704, height: 674, perch: '-72.6%' },
  together: { file: 'cat-hamster-book-logo.png', width: 708, height: 724, perch: '-75.7%' },
  'cat-peek': { file: 'cat-peeking.png', width: 651, height: 639, perch: '-70.9%' },
  'cat-peek-alt': { file: 'cat-peeking-alt.png', width: 724, height: 685, perch: '-74.6%' },
  'hamster-peek': { file: 'hamster-peeking.png', width: 723, height: 696, perch: '-74.6%' },
  'cat-reading': { file: 'cat-reading.png', width: 724, height: 659, perch: '-86.8%' },
  'hamster-reading': { file: 'hamster-reading.png', width: 709, height: 631, perch: '-89.1%' },
  'hamster-reading-alt': { file: 'hamster-reading-alt.png', width: 723, height: 715, perch: '-79.7%' },
  'hamster-az': { file: 'hamster-az.png', width: 695, height: 674, perch: '-89.6%' },
  'cat-thinking': { file: 'cat-thinking.png', width: 724, height: 717, perch: '-79.1%' },
  'cat-rest': { file: 'cat-sleeping.png', width: 709, height: 691, perch: '-73.1%' },
  'cat-success': { file: 'cat-celebrating.png', width: 723, height: 724, perch: '-79.4%' },
  'hamster-reminder': { file: 'hamster-reminder.png', width: 701, height: 715, perch: '-79.1%' },
} as const;
type MascotPose = keyof typeof mascotPoses | 'sprig';
export function Mascot({ pose = 'together', className = '', eager = false }: {
  pose?: MascotPose; className?: string; eager?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  // Keep the existing foliage unchanged. No character uses the legacy atlas.
  const art = pose === 'sprig' ? null : mascotPoses[pose];
  const src = art ? `/illustrations/mascots/${art.file}` : '/illustrations/learning-companions.webp';
  return <span className={`learning-art ${art ? 'learning-art--character' : 'learning-art--sprig'} ${className}`} aria-hidden="true" data-pose={pose} data-asset={art?.file}
    style={{ '--art-aspect': art ? `${art.width} / ${art.height}` : '1', '--mascot-perch': art?.perch, visibility: failedSource === src ? 'hidden' : undefined } as React.CSSProperties}>
    <img src={src} alt="" width={art?.width || 1254} height={art?.height || 1254}
      loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} onError={() => setFailedSource(src)}
      style={art ? undefined : { transform: 'translate(-75%, -75%)' }}/>
  </span>;
}
export function Companion({ pose = 'cat-peek', className = '' }: {
  pose?: MascotPose; className?: string;
}) {
  return <Mascot pose={pose} className={`learning-companion ${className}`}/>;
}
/** Pure geometry; the stroke inherits the existing theme and never captures input. */
export function HandRule({ className = '' }: { className?: string }) {
  return <svg className={`hand-rule ${className}`} viewBox="0 0 1000 8" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M1 4 C75 1 115 7 190 4 S300 2 375 4 S465 7 545 4 S675 1 745 4 S885 7 999 3"/></svg>;
}
export function StudyEmptyState({ children, compact = false, pose = 'hamster-reading', busy = false }: {
  children: React.ReactNode; compact?: boolean; pose?: MascotPose; busy?: boolean;
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
