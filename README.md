# Codex Limit Watcher - Production

Wayland-friendly Linux desktop app for monitoring Codex usage-limit windows on Kubuntu 26.04.

## Purpose

Display the latest local Codex usage-limit snapshot with:

- 5-hour usage percentage and reset countdown.
- Weekly usage percentage and reset countdown.
- Source session log used for the current reading.
- Scan evidence for local troubleshooting.

## Data Source

The app reads local OpenClaw/Codex JSONL session logs and extracts `event_msg` events where `payload.type` is `token_count`. Those events include `payload.rate_limits.primary` for the 300-minute window and `payload.rate_limits.secondary` for the 10080-minute weekly window.

No credentials are read, requested, stored, or transmitted.

## Run

```bash
npm install
npm run start:wayland
```

CLI status check:

```bash
npm run status
```

Install the production launcher:

```bash
./scripts/install-desktop-entry.sh
```

## Project Placement

- Filesystem production path: `/run/media/gtgb/GTGB-Files/OpenClaw/Projects/patriciAI/codexLimitWatcher-prod/`
- Obsidian documentation path: `OpenClaw/Projects/patriciAI/codexLimitWatcher-prod/`
- Promoted from staging on 2026-06-07 after local tests, audit, live status verification, and Wayland launch smoke test.

## Verification

```bash
npm test
npm run status
```

For Wayland verification, launch with `npm run start:wayland` and confirm the app opens under the active Kubuntu Wayland session.
