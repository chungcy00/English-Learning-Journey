import { useEffect, useRef } from 'react';

// Native modal dialogs make the background inert and trap keyboard focus.
export function useModalDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
      else document.querySelector<HTMLElement>('nav button:not([disabled])')?.focus();
    };
  }, [open]);
  return ref;
}
