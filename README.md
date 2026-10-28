# Codex Limit Watcher

Linux desktop app that shows your Codex 5-hour and weekly usage limits, and when each one resets.

## What it does

Sign in with ChatGPT. The app opens ChatGPT OAuth in your browser, finishes sign-in with PKCE and a localhost callback, and saves tokens in the Electron user-data directory as `auth.json` with owner-only `0600` permissions. A saved access token is refreshed when fewer than two minutes remain before it expires.

It then reads the Codex usage endpoint and shows each limit window:

- Used percent, percent left, and time until reset
- Codex 5-hour and weekly windows
- Extra windows included in the response, including Spark (`GPT-5.3-Codex-Spark`) when that data is present

The header shows your plan and when the numbers were read. The status line lists Codex and Spark reset times. Missing Spark data shows as unknown. If Codex reports a reached limit, the status line names that limit. Cards use a warning style at 85% used and a critical style at 100%.

Auto-refresh is optional and starts off. Intervals are 1, 5, 10, 15, and 30 minutes; a fresh install uses 5 minutes. Dark mode is a toggle, and light mode is the default. Mini mode shrinks the window to a compact card view and hides sign-in, theme, auto-refresh, account details, and About. The account id stays masked until you show it.

The usage endpoint is not a documented stable public API. Parsing lives in `src/usageReader.js`.

## Requirements

- Linux
- Node.js 22.12 or newer, and npm (the Electron 42 dependency requires this Node version)
- A browser for ChatGPT sign-in
- Localhost callback on `127.0.0.1` port `1455`, or port `1457` if `1455` is already in use

## Setup

```bash
npm install
npm run start:wayland
```

`npm run start:wayland` launches Electron on Wayland, with Wayland window decorations, Vulkan disabled, and the GPU disabled. `npm start` launches Electron with the switches the app sets on Linux: Wayland window decorations, Vulkan disabled, GPU disabled, and an automatic Ozone platform hint.

Add a desktop launcher:

```bash
./scripts/install-desktop-entry.sh
```

That writes `codex-limit-watcher.desktop` under `${XDG_DATA_HOME:-~/.local/share}/applications`. The launcher runs `scripts/codex-limit-watcher`, which starts the app with the same Wayland flags.

## Usage

1. Choose **Sign in**.
2. Complete ChatGPT sign-in in the browser.
3. After the localhost page says sign-in is complete, return to the app.
4. Read the cards, or choose **Refresh**. **Sign out** deletes `auth.json`.

Print a JSON snapshot from the terminal:

```bash
npm run status
```

That command prints a signed-out snapshot. To print the newest `token_count` rate-limit event from session logs in `~/.codex` and `~/.openclaw/agents`:

```bash
CODEX_LIMIT_WATCHER_LOCAL_FALLBACK=1 npm run status
```

Status output and tests leave OAuth tokens out of what they print.

```bash
npm test
npm audit
```

## License

MIT. See [LICENSE](LICENSE).
