# Explicit all/due history review — 2026-11-02

The user saw nine collected words but only one card after entering review. The old entry silently selected due IDs whenever any existed. Total collection size and due review size were both correct, but the generic entry obscured the different scope.

History summary, level cards and level detail now expose “复习全部（N词）” and a separate “到期复习（M词）” when due items exist. The primary entry uses the entire collection/level. It reuses free-practice semantics and does not write ratings or alter scheduling. Explicit due review retains the original saved-rating behavior. Requests and refreshes carry the selected mode throughout; a due refresh with no due words remains empty, rather than silently switching to all words.

Validation: lint, frontend build and server build passed; 190 tests, 189 passed and 1 skipped. Regression coverage includes nine B1 words with only one due, absent due items, stable session IDs after rating, and explicit queue rebuilding. Existing bundle-size warning remains.

An isolated browser fixture using synthetic words verified the primary level entry opens 1/9 and advances to 2/9, while the due entry opens 1/1. Level detail also opens the full nine-word queue. At 390px width, the page stayed 390px wide and both actions met 44px minimum height. No learning database writes, real ratings or AI requests were made. Temporary sources, tab and viewport override were removed.

Screenshot: `/Users/caiying/.codex/visualizations/2026/10/10/01a1261b-9f20-76f1-929f-8a9256f37c97/history-nine-word-review-verified.png`.
