# Open Source OAuth Update - 2026-06-07

## Outcome

Codex Limit Watcher was corrected from a local OpenClaw telemetry utility into a standalone open-source desktop app target.

## Changes

- Added MIT license metadata and `LICENSE`.
- Added ChatGPT OAuth sign-in, sign-out, token refresh, and local token storage.
- Added authenticated usage fetching from the Codex usage endpoint.
- Kept the local JSONL reader as an explicit development fallback only.
- Updated the UI to show authentication state and authenticated usage source.
- Rewrote the README for public release without private infrastructure paths.
- Added security notes for credential handling.

## Verification Required

- `npm test`
- `npm audit`
- Wayland launch smoke test
- Manual OAuth sign-in against a ChatGPT account with Codex entitlement

## Notes

The authenticated usage endpoint is isolated behind `src/usageReader.js` because OpenAI has not documented it as a stable public API. If a supported usage API becomes available, that module is the intended replacement point.
