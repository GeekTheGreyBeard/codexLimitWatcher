#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
APP_BASENAME="$(basename "$APP_DIR")"
APP_LABEL="Codex Limit Watcher"
DESKTOP_ID="codex-limit-watcher"

if [[ "$APP_BASENAME" == *-staging ]]; then
  APP_LABEL="Codex Limit Watcher Staging"
  DESKTOP_ID="codex-limit-watcher-staging"
elif [[ "$APP_BASENAME" == *-prod ]]; then
  APP_LABEL="Codex Limit Watcher"
  DESKTOP_ID="codex-limit-watcher"
fi

DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DESKTOP_FILE="$DESKTOP_DIR/$DESKTOP_ID.desktop"

mkdir -p "$DESKTOP_DIR"
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=$APP_LABEL
Comment=Monitor Codex 5-hour and weekly usage reset windows
Exec=$APP_DIR/scripts/codex-limit-watcher
Terminal=false
Categories=Development;Utility;
StartupNotify=true
EOF

chmod 0644 "$DESKTOP_FILE"
echo "$DESKTOP_FILE"
