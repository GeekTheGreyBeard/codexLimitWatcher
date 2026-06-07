# UI Controls Update - 2026-06-07

## Outcome

Added user-facing token counts, configurable auto-refresh, and dark mode to Codex Limit Watcher.

## Changes

- Added a token-count panel that renders numeric token usage values from the latest usage snapshot.
- Replaced the hidden 60-second refresh loop with an explicit auto-refresh toggle.
- Added refresh interval options: 5m, 10m, 15m, and 30m.
- Added persistent dark mode using local storage.
- Added persistent refresh settings using local storage.

## Verification

- `npm test`: passed, 5 tests.
- `npm audit`: found 0 vulnerabilities.
- `npm run status`: reports signed-out OAuth state.
- Wayland smoke launch: app started and remained alive until timeout termination.
