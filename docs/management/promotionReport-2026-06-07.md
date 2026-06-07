# Codex Limit Watcher Production Promotion - 2026-06-07

## Result

Promoted to production folder after staging verification.

## Production Path

`/run/media/gtgb/GTGB-Files/OpenClaw/Projects/patriciAI/codexLimitWatcher-prod/`

## Evidence

- `npm test`: passed, 3 tests.
- `npm audit`: found 0 vulnerabilities after Electron upgrade to `42.3.3`.
- `npm run status`: read live Codex usage-limit state from local OpenClaw/Codex JSONL logs.
- Wayland smoke launch: app process started under `XDG_SESSION_TYPE=wayland` and stayed alive until timeout termination.

## Current Live Reading At Promotion

- 5-hour window: 2 percent used, reset at `2026-06-07T21:17:39.000Z`.
- Weekly window: 63 percent used, reset at `2026-06-11T00:31:02.000Z`.

## Notes

- Runtime target is Kubuntu 26.04 Wayland.
- Electron is used for this first production release because the host lacks the Tauri build chain (`cargo`, `rustc`, WebKitGTK pkg-config).
- Tauri remains the recommended future native packaging route once that toolchain is provisioned.
