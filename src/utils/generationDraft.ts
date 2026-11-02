const DRAFT_KEY = 'mine_english_generation_draft';

// Per-tab/session only; unavailable or full storage must not block typing.
export function readGenerationDraft(kind: 'topic' | 'transcript' = 'topic'): string {
  try { return typeof window === 'undefined' ? '' : window.sessionStorage.getItem(kind === 'transcript' ? `${DRAFT_KEY}_transcript` : DRAFT_KEY) || ''; }
  catch { return ''; }
}

export function saveGenerationDraft(value: string, kind: 'topic' | 'transcript' = 'topic'): void {
  try {
    if (typeof window === 'undefined') return;
    const key = kind === 'transcript' ? `${DRAFT_KEY}_transcript` : DRAFT_KEY;
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch { /* Keep the in-memory draft when browser storage is unavailable. */ }
}
