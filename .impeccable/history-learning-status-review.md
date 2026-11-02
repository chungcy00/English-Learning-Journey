# Learning-status review selection — 2026-11-02

The user explicitly chose learning states (未学习 / 学习中 / 困难 / 已掌握), rather than last-rating categories, to replace the due-review entry.

History summary, CEFR task cards and level detail now offer a native learning-state selector with real per-state counts and a “复习所选” action. The full-collection entry remains available. Counts and selection use persisted `VocabularyItem.status`, intersected with the actual word CEFR scope and existing passage-linked collection. No inference is made from last rating or due date. Empty selections are disabled. Time-based counts/entry and the history-only due-count timer have been removed.

Classification sessions save ratings through the existing review handler and scheduling algorithm. Existing full-review practice remains non-writing. Session requests carry the chosen state and freeze IDs for the current round: rating a word into another state must not shrink the queue and skip the next card. Explicit refresh rebuilds the same chosen state and stays empty if none remain; it never falls back to another category. Empty scoped review explains returning to the history dashboard.

Validation: lint, frontend/server builds passed; 190 tests, 189 passed and 1 skipped. Regression cases cover 4/3/1/1 status counts across nine words, CEFR intersections, no dependence on due dates, stable IDs after status changes, same-state refresh and missing categories. Existing bundle-size warning remains.

Browser validation used the actual history component callback chain with a temporary synthetic fixture. Selecting B1/Learning opened three cards; an explicitly simulated Easy rating moved the word into Mastered while the queue correctly advanced to 2/3. A one-word Difficult simulation completed; refreshing yielded zero, and selecting Difficult on the dashboard disabled its zero-word action. State counts updated to 4/2/0/3 with all nine words retained. At 390px viewport there was no horizontal overflow. No learning database writes, real user ratings or AI calls were made. Temporary sources, tab and viewport override were removed.

Screenshots:
- `/Users/caiying/.codex/visualizations/2026/10/10/01a1261b-9f20-76f1-929f-8a9256f37c97/history-status-selection-desktop.png`
- `/Users/caiying/.codex/visualizations/2026/10/10/01a1261b-9f20-76f1-929f-8a9256f37c97/history-learning-status-three-cards.png`
- `/Users/caiying/.codex/visualizations/2026/10/10/01a1261b-9f20-76f1-929f-8a9256f37c97/history-status-selection-mobile.png`
