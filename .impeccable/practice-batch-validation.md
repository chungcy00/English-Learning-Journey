# Practice refinement — V2.4.29

Requirements §§8–10: preserve existing two entry cards, inline review, mobile progress-above / desktop progress-right rewrite layout, current-reading wordbook scope and alphabetic ordering, native simple status selector and draft storage.

Added a two-face 3D review card. Only the active face is in normal layout; the hidden face is inert, aria-hidden and not clickable. Explicit flip/back controls move focus to the active face; audio, collocations and ratings do not trigger flip. Long content grows naturally. Reduced-motion uses no transforms or transitions. Four ratings, duplicate-save protection and retry remain intact.

The displayed delay and Dexie rating handler share exactly the incumbent interval formula. Again is 30 minutes, Hard is one day, Good/Easy reflect the stored interval (including fractional days before persisted interval rounding). No scheduling behavior or database schema changed.

Rewrite issue feedback uses explicit original/suggestion labels rather than emoji; native vocabulary status retains its current value on failure and announces pending saves. Existing hub, progress and accordion behavior is preserved, not rebuilt.

Scoped static detector returned no primary findings. Browser checks use Chrome viewport simulation; no claim of actual phone/PWA or hardware reduced-motion testing. No real rating was submitted and no stored word was deleted for QA. Automated tests cover hidden-face semantics, reduced-motion CSS, interval formula, drafts and rating persistence.

Remaining: final cross-flow feedback/error coverage and real Android/PWA acceptance; existing large-bundle build warnings remain outside this visual batch.
