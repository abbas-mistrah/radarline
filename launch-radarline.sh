#!/usr/bin/env bash
# RADARLINE — macOS / Linux launcher (parity with launch-radarline.ps1).
# Starts the local server in the background if it is not already healthy,
# waits for /api/health, then opens the application in the browser.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${RADARLINE_HOST:-${HOST:-127.0.0.1}}"
PORT="${RADARLINE_PORT:-${PORT:-4335}}"
HEALTH_URL="http://${HOST}:${PORT}/api/health"
APP_URL="http://${HOST}:${PORT}/#command"
LOG_FILE="${PROJECT_ROOT}/.data/server.log"

is_running() {
  curl -fsS --max-time 1 "$HEALTH_URL" >/dev/null 2>&1
}

if ! command -v node >/dev/null 2>&1; then
  echo "RADARLINE: Node.js not found. Install Node.js 22.5 or newer." >&2
  exit 1
fi

NODE_VERSION="$(node -p 'process.versions.node')"
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=5)?0:1)'; then
  echo "RADARLINE: Node.js ${NODE_VERSION} detected; 22.5 or newer is required (node:sqlite)." >&2
  exit 1
fi

if ! is_running; then
  mkdir -p "${PROJECT_ROOT}/.data"
  (cd "$PROJECT_ROOT" && RADARLINE_HOST="$HOST" RADARLINE_PORT="$PORT" HOST="$HOST" PORT="$PORT" nohup node server.js >>"$LOG_FILE" 2>&1 &)
  for _ in $(seq 1 24); do
    sleep 0.25
    if is_running; then break; fi
  done
fi

if ! is_running; then
  echo "RADARLINE failed to start. Check ${LOG_FILE}." >&2
  exit 1
fi

echo "RADARLINE is ready: ${APP_URL}"
if [[ "${RADARLINE_NO_BROWSER:-0}" == "1" ]]; then
  exit 0
fi
case "$(uname -s)" in
  Darwin) open "$APP_URL" ;;
  Linux) command -v xdg-open >/dev/null 2>&1 && xdg-open "$APP_URL" >/dev/null 2>&1 || true ;;
esac
