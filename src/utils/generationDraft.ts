const DRAFT_KEY = 'mine_english_generation_draft';

// Per-tab/session only; unavailable or full storage must not block typing.
export function readGenerationDraft(): string {
  try { return typeof window === 'undefined' ? '' : window.sessionStorage.getItem(DRAFT_KEY) || ''; }
  catch { return ''; }
}

export function saveGenerationDraft(value: string): void {
  try {
    if (typeof window === 'undefined') return;
    if (value) window.sessionStorage.setItem(DRAFT_KEY, value);
    else window.sessionStorage.removeItem(DRAFT_KEY);
  } catch { /* Keep the in-memory draft when browser storage is unavailable. */ }
}
