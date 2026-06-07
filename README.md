# Codex Limit Watcher

Standalone Linux desktop app for monitoring Codex 5-hour and weekly usage-limit resets.

## Features

- ChatGPT OAuth sign-in using the Codex public client and PKCE.
- Authenticated Codex usage fetch for 5-hour and weekly reset windows.
- Optional auto-refresh with `1m`, `5m`, `10m`, `15m`, and `30m` intervals; fresh installs default to `5m`.
- Light and dark display modes.
- Account number masking by default, with an explicit show/hide control.
- Wayland-friendly Electron launch path for Kubuntu and other Linux desktops.
- Local token storage in the app user-data directory with owner-only file permissions.
- MIT licensed for open-source release.

## Status

This project uses the same ChatGPT OAuth issuer and localhost callback pattern used by the official Codex client. The Codex usage endpoint is not yet a stable public OpenAI API, so response normalization is intentionally isolated in `src/usageReader.js`.

## Run

```bash
npm install
npm run start:wayland
```

CLI status check using local development fallback:

```bash
CODEX_LIMIT_WATCHER_LOCAL_FALLBACK=1 npm run status
```

Install the desktop launcher:

```bash
./scripts/install-desktop-entry.sh
```

## Authentication

1. Launch the app.
2. Select `Sign in`.
3. Complete ChatGPT sign-in in the browser.
4. Return to the app after the localhost callback succeeds.

Tokens are stored locally for this app only and are not printed by tests or status output.

## Verification

```bash
npm test
npm audit
```

For Wayland verification, launch with `npm run start:wayland` and confirm the app opens under the active Wayland session.

## License

MIT
