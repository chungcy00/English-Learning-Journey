# Installed entry translation failure — 2026-10-24

The user confirmed Chrome can translate, but the installed Android entry still reports `Failed to fetch` after reopening. This does not establish a cache-only cause. The repository supplies a same-origin installed website, not a separate Android API client. No origin override or CORS bypass was added.

Added a bounded, uncached GET `/api/health` check only after translation transport failure. The error includes the actual entry origin, build commit and connectivity result. This differentiates an outdated/alternate entry, an unreachable service, and a reachable site whose translation connection was interrupted. It does not transmit diagnostic logs, read learning records, retry AI calls, clear storage, navigate or refresh an active task. User cancellation remains cancellation; HTTP quota and timeout responses remain intact.

Validation: lint and production build passed. Full suite: 180 tests, 179 passed, 1 skipped. Focused tests cover successful/unreachable/unexpected/timed-out probes, cancellation, preserving HTTP quota errors, and making no second translation POST. Existing build-size warning remains.

This change provides device-side evidence; the physical Android failure is not yet reproduced or fixed. A screenshot of the new diagnostic message is needed to identify the failing installed origin/session. If it still displays only the old English message, the installed entry has not loaded this frontend release.
