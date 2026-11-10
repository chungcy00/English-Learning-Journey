import React, { useEffect, useState } from 'react';

export type LoadingOperation = 'generate' | 'vocabulary' | 'reading' | 'history' | 'saved' | 'analysis' | 'examples' | 'usage' | 'search' | 'wait';
export const loadingMotion = {
  generate: { action: 'run', duration: 1.2 }, vocabulary: { action: 'run', duration: 1.2 },
  reading: { action: 'read', duration: 2.8 }, history: { action: 'read', duration: 2.8 }, saved: { action: 'read', duration: 2.8 },
  analysis: { action: 'write', duration: 2.6 }, examples: { action: 'write', duration: 2.6 }, usage: { action: 'write', duration: 2.6 },
  search: { action: 'search', duration: 2.6 }, wait: { action: 'rest', duration: 2.8 },
} as const;

/** Presentation only: no requests, progress estimates or minimum display duration. */
export function LoadingAnimation({ active, operation = 'wait', label, large = false }: {
  active: boolean; operation?: LoadingOperation; label?: string; large?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);
  const motion = loadingMotion[operation];
  useEffect(() => {
    setVisible(false);
    if (!active) return;
    const timer = window.setTimeout(() => setVisible(true), 300);
    return () => window.clearTimeout(timer);
  }, [active, motion.action]);
  // The active check hides an animation on the same render as completion/failure.
  if (!active || !visible) return null;
  return <div className={`loading-companions ${large ? 'loading-companions--large' : ''}`} role={label ? 'status' : undefined} aria-live={label ? 'polite' : undefined}>
    <span className={`loading-companions__viewport loading-companions--${motion.action}`} aria-hidden="true"
      data-action={motion.action} style={{ '--loading-duration': `${motion.duration}s`, visibility: loaded === motion.action ? 'visible' : 'hidden' } as React.CSSProperties}>
      <img key={motion.action} className="loading-companions__frames" src={`/illustrations/loading/${motion.action}.webp`} alt="" width={1536} height={1152} decoding="async" draggable={false}
        onLoad={() => setLoaded(motion.action)} onError={() => setLoaded(null)}/>
    </span>
    {label && <span className="loading-companions__label">{label}</span>}
  </div>;
}
