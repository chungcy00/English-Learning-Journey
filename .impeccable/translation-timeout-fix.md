# Sentence translation timeout repair — 2026-10-24

The Android screenshot reports HTTP 504. This is a timeout response, not evidence of account quota exhaustion. The translation provider fallback previously had no aggregate deadline, while the repository deployment configuration allows 60 seconds.

Implemented a 45-second provider deadline for translation only, with an abort signal and explicit timeout response. Clicking an untranslated sentence now prioritizes a request for that single sentence. Repairs request only missing sentences using indexed results mapped back to the exact original source; existing full and sentence translations survive errors. Complete sentence mappings can assemble a full translation while preserving paragraphs and dialogue speakers. Explicit full-translation refresh remains available.

Validation: lint passed; 176 tests, 175 passed and 1 skipped; frontend and server builds passed. The frontend retains its existing bundle-size warning. Backend route tests use a mocked provider and verify indexed repairs; deadline tests cover cancellation and expired budgets. An isolated browser fixture verified a simulated HTTP 504 followed by a one-sentence repair and a visible Chinese sentence translation, without changing user data or calling real AI.

Screenshot: `/Users/caiying/.codex/visualizations/2026/10/10/01a1261b-9f20-76f1-929f-8a9256f37c97/sentence-translation-repair-verified.png`.

Not pushed or deployed. Actual provider latency and physical Android behavior have not been validated. No removed features were restored.
