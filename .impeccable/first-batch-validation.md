# First-batch validation — 2026-10-07

Scope: shared forest-green palette; home composer and fully expanded parameters; history cards; saved reading level distribution. This is not full-document acceptance.

- TypeScript and production build pass. Existing large-bundle warning remains.
- 86 automatic tests: 85 pass, 1 Redis integration test skipped.
- Browser layout checked at 320, 390, 1440 and actual browser width 1800px: no document-level horizontal overflow.
- Phone main heading 28px; textarea and placeholder 16px UI font on desktop and phone.
- Vocabulary stepper tested interactively: decrement disabled at1; increment disabled at20; restored original8. No AI generation or saved-reading deletion performed.
- Single-level chart and factual card shown with existing local record. Empty, mixed, missing/unsupported level, add/delete recomputation covered by tests.
- Finish reviewer initial disposition fix: input typography and encoded/rgba olive remnants. One batch corrected both; verdict ship for reviewed first batch, both findings resolved.
- No real-device/PWA installed-app verification performed this batch. Existing data schema, prompts and review algorithm unchanged.
- Remaining: reading/detail/toolbars/dialogs; practice/wordbook/review improvements and 3D flip; comprehensive feedback, accessibility and PWA acceptance.

Evidence: `.impeccable/review/desktop.png`, `mobile.png`, `mobile-320.png`, `user-viewport.png`, `history-desktop.png`, `history-mobile.png`.
