# V2.4.30 recovery and acceptance

Added local recovery notices for wordbook/review vocabulary translation, retaining existing meanings and words. Translation effect cleanup guards stale results; retries are explicit. Database loading now exposes failure rather than masquerading as no saved data. Clipboard success/failure is announced without deleting the translation.

Typecheck, production build and automated tests verify the changes. RecoveryNotice SSR verifies alert semantics, pending retry lock and no render-time mutation. No real AI translation failure or clipboard-permission denial was injected into the user's browser. The existing bundle-size warning remains.

## Phone acceptance still requires physical-device evidence

The user previously reported the old Android-entry migration passed; do not reset or delete their old installation/data to repeat it. New-version acceptance remains:

- Open the existing Android entry; confirm the latest version and saved readings/words remain.
- Keyboard open/close in home and rewrite: inputs and actions remain reachable, drafts survive leaving/returning.
- Review flip/back, audio and collocations: independent touch actions; no clipping on long text or landscape.
- Turn on OS reduced motion: review still reveals details and accepts ratings without 3D motion.
- Safe areas and bottom navigation: no overlap with actionable content.
- Refresh/update after editing: no forced loss of a pending draft or evaluation.
- Offline/server restriction: local history and saved meanings remain readable; failures name recovery, not a false empty state.

No connected Android tooling is available in this workspace; this checklist is not a claim of hardware/PWA validation. Do not declare all requirements accepted until these checks have actual results.
