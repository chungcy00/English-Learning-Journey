# History vocabulary ownership and shared flashcards — 2026-11-02

User browser comments require vocabulary to follow its source passage and history review to match the existing practice flashcard on both faces.

Deletion now uses one IndexedDB transaction across readings, vocabulary, reviews, passage exercises and notes. A word exclusive to the deleted passage is removed even when bookmarked; words still used by another passage retain their saved ID, meaning and review schedule and are reassigned to an existing source. Source discovery supports explicit source IDs, manually added source IDs and legacy deduplicated passage term copies. Saves accumulate only live source references. The existing deletion confirmation explains the cascade and shared-word exception.

History vocabulary charts, tasks, level wordbooks and review requests use only saved words with an existing source passage. Legacy orphans are excluded from those history surfaces without automatically destroying ambiguous independent records. Deleting the last passage records initialization so the next load does not recreate bundled sample vocabulary.

The same embedded review component now owns all flashcard layout rules and type tokens. They formerly depended on a practice-hub ancestor, leaving history cards unpadded and at inherited text size. No alternate card design or removed feature was introduced.

Validation: lint, frontend and server builds passed; 189 tests, 188 passed, 1 skipped. New fake IndexedDB tests exercise real Dexie cascade operations, preservation of shared scheduling, rollback after a midway storage failure, and no sample resurrection. Ownership tests cover legacy term copies, manual links and live history filtering. Existing bundle warning remains.

Browser QA used a temporary fixture with one labelled synthetic vocabulary item, no learning database writes and no submitted ratings. Desktop practice/history cards both measured 512px wide, 20px padding and 40px term text. At 390px viewport, history card width was 358px, term text 28px and page width 390px; nested collocation expansion retained the reverse face. Temporary fixture files/tab and viewport override were removed. No physical Android test or production deletion was performed.

Screenshots:
- `/Users/caiying/.codex/visualizations/2026/10/10/01a1261b-9f20-76f1-929f-8a9256f37c97/history-shared-card-front.png`
- `/Users/caiying/.codex/visualizations/2026/10/10/01a1261b-9f20-76f1-929f-8a9256f37c97/history-shared-card-back.png`
- `/Users/caiying/.codex/visualizations/2026/10/10/01a1261b-9f20-76f1-929f-8a9256f37c97/history-shared-card-mobile-front.png`
