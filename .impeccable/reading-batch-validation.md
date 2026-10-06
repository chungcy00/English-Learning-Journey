# Reading refinement — V2.4.28

Scope: requirements §7, a bounded refinement using the incumbent compact typography, forest-green palette and responsive reading layout. No database schema, review scheduling, AI prompts or Humanise version mechanisms changed.

Implemented: device/audio pause and resume, end/error notices, queue-gap pause protection; visible word count; rewrite disclosure state, Escape and focus-leave dismissal; 44px rewrite choices; named translation select; keeping an existing translation visible while refreshing or after a failed refresh; a named keyboard-scrollable word-detail body with independent header/footer.

Browser checks: localhost Chrome at 1280px (wide original / narrow translation), 768px (existing responsive web breakpoint, no horizontal overflow), 390px sheet and 320px sheet (320px document width). Modal close receives focus and closing restores the triggering word. Native narration play, pause, resume, stop and end states checked. No manual AI generation/translation or destructive UI actions performed. Existing missing-translation auto-load reached the quota-service error state; successful paid dialogue audio and translated-content refresh were not exercised end-to-end.

Static detector: one scoped scan of ReadingView, WordDetailModal and index.css returned 2 primary findings and 37 advisories; its quiet output did not identify locations. This is not a clean-detector claim. Existing visual identity and outside-scope CSS were preserved.

Not complete: remaining practice/wordbook refinements, 3D review flip, real Android/PWA acceptance. No hardware or multiple-browser verification claimed.
