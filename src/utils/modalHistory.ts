let nextModal = 0;
const STATE_KEY = '__mineEnglishWordDialog';

// A temporary same-URL entry lets browser / Android Back dismiss a dialog first.
// Cleanup only consumes our own entry; it never backs out of an unrelated page.
export function registerModalBack(onClose: () => void, browser: Pick<Window, 'history' | 'addEventListener' | 'removeEventListener'> = window): () => void {
  const token = `${Date.now()}-${++nextModal}`;
  const oldState = browser.history.state;
  browser.history.pushState({ ...(oldState && typeof oldState === 'object' ? oldState : {}), [STATE_KEY]: token }, '');
  let active = true;
  const back = () => {
    if (!active || browser.history.state?.[STATE_KEY] === token) return;
    active = false;
    onClose();
  };
  browser.addEventListener('popstate', back);
  return () => {
    active = false;
    browser.removeEventListener('popstate', back);
    if (browser.history.state?.[STATE_KEY] === token) browser.history.back();
  };
}
