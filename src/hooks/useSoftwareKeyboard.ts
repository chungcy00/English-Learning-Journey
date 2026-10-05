import { useEffect, useState } from 'react';

export function isSoftwareKeyboardVisible(baseline: number, visibleHeight: number, focusedEditable: boolean, scale: number): boolean {
  return focusedEditable && scale === 1 && baseline - visibleHeight > Math.max(150, baseline * 0.2);
}

// A resized viewport is evidence of a keyboard only while editing, not pinch zoom.
export function useSoftwareKeyboard() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let baseline = viewport.height;
    const update = () => {
      const element = document.activeElement;
      const editing = element instanceof HTMLTextAreaElement ||
        element instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'file'].includes(element.type) ||
        element instanceof HTMLElement && element.isContentEditable;
      if (!editing) baseline = Math.max(viewport.height, window.innerHeight);
      else baseline = Math.max(baseline, window.innerHeight, viewport.height);
      setOpen(isSoftwareKeyboardVisible(baseline, viewport.height, editing, viewport.scale));
    };
    const reset = () => { baseline = viewport.height; update(); };
    viewport.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    window.addEventListener('orientationchange', reset);
    update();
    return () => {
      viewport.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      window.removeEventListener('orientationchange', reset);
    };
  }, []);
  return open;
}
