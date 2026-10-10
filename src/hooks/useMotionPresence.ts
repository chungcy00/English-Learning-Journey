import { useEffect, useState } from 'react';

/** Keep an exiting surface mounted briefly; business callbacks run immediately. */
export function useMotionPresence(open: boolean, exitDuration?: number) {
  const [retained, setRetained] = useState(open);
  useEffect(() => {
    if (open) { setRetained(true); return; }
    if (!retained) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRetained(false); return;
    }
    const duration = exitDuration ?? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-form')) || 160);
    const timer = window.setTimeout(() => setRetained(false), duration);
    return () => window.clearTimeout(timer);
  }, [open, retained, exitDuration]);
  return { present: open || retained, closing: !open && retained };
}
