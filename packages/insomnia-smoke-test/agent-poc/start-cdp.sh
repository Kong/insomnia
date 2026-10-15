#!/usr/bin/env bash
#
# start-cdp.sh — bring up the full Insomnia dev stack with a CDP debug port so
# the official @playwright/mcp (wired in repo .mcp.json as server "insomnia-cdp")
# can attach to the LIVE Electron renderer for closed-loop exploration.
#
# This is the substrate for the closed-loop planner/healer: instead of writing
# JSON step files and reading artifacts after the fact, the agent drives the
# real renderer through mcp__insomnia-cdp__browser_* tools (act -> observe ->
# decide -> act), exactly like the official Playwright Test Agents do against a
# browser. The renderer is a Chromium target, so connectOverCDP (what the MCP
# uses) sees the real React/React-Aria DOM.
#
# Idempotent: reuses already-running services, leaves everything running.
#   echo server  :4010   test backend mock        (npm run serve)
#   vite dev     :3334   renderer                  (npm run watch:app)
#   electron     :9222   renderer CDP endpoint     (explore.ts --keep-open --debug-port)
#                         ^-- @playwright/mcp --cdp-endpoint attaches here
#
# Usage:
#   bash packages/insomnia-smoke-test/agent-poc/start-cdp.sh           # bring up + wait for CDP
#   bash packages/insomnia-smoke-test/agent-poc/start-cdp.sh --stop    # tear down what it started
#
set -euo pipefail

CDP_PORT=9222
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LOG_DIR="$REPO_ROOT/packages/insomnia-smoke-test/agent-poc/.cdp-logs"
MAIN_BUNDLE="$REPO_ROOT/packages/insomnia/src/entry.main.min.js"
mkdir -p "$LOG_DIR"

# Optional: seed the app to a known state by importing a YAML fixture before
# exploration (the Playwright "seed test" analog). Only applies on a fresh launch.
SEED=""
if [ "${1:-}" = "--seed" ] && [ -n "${2:-}" ]; then SEED="$2"; fi

port_up() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }

# Select the repo's required Node (fnm or nvm); fall back to whatever is active.
use_node() {
  local want; want="$(cat "$REPO_ROOT/.nvmrc" 2>/dev/null || true)"
  if command -v fnm >/dev/null 2>&1; then fnm use "$want" >/dev/null 2>&1 || true; return; fi
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh"; nvm use "$want" >/dev/null 2>&1 || true
  fi
}

wait_port() {
  local p="$1" name="$2" i
  for i in $(seq 1 90); do
    port_up "$p" && { echo "  ✓ $name (:$p) ready"; return 0; }
    sleep 1
  done
  echo "  ✗ $name (:$p) did not come up within 90s — check $LOG_DIR"; return 1
}

stop() {
  echo "[start-cdp] stopping services started by this script…"
  for p in "$CDP_PORT" 3334; do
    pid="$(lsof -nP -iTCP:"$p" -sTCP:LISTEN -t 2>/dev/null || true)"
    if [ -n "$pid" ]; then kill $pid 2>/dev/null && echo "  killed :$p ($pid)" || true; fi
  done
  pkill -f "agent-poc/explore.ts" 2>/dev/null || true
  echo "[start-cdp] note: the echo server (:4010) is left running on purpose."
}

if [ "${1:-}" = "--stop" ]; then stop; exit 0; fi

cd "$REPO_ROOT"
use_node
echo "[start-cdp] node $(node -v 2>/dev/null || echo '?')"

# 1) echo server (test backend mock)
if port_up 4010; then
  echo "  • echo server already on :4010"
else
  echo "  • starting echo server…"
  nohup npm run serve -w insomnia-smoke-test >"$LOG_DIR/echo.log" 2>&1 &
  wait_port 4010 "echo server"
fi

# 2) vite dev server (+ builds the electron entrypoints). watch:app == build
#    entrypoints then `vite dev`, so this also produces entry.main.min.js.
if port_up 3334; then
  echo "  • vite dev already on :3334"
else
  echo "  • starting vite dev server (npm run watch:app)…"
  nohup npm run watch:app >"$LOG_DIR/vite.log" 2>&1 &
  wait_port 3334 "vite dev"
fi

# Safety: dev main bundle must exist for explore.ts/paths.ts guards.
if [ ! -f "$MAIN_BUNDLE" ]; then
  echo "  • building electron entrypoints (entry.main.min.js missing)…"
  npm run build:electron-entrypoints -w insomnia >"$LOG_DIR/entrypoints.log" 2>&1
fi

# 3) Electron app with the renderer CDP debug port.
if port_up "$CDP_PORT"; then
  echo "  • Insomnia already exposing CDP on :$CDP_PORT"
else
  if [ -n "$SEED" ]; then
    echo "  • launching Insomnia (--keep-open --debug-port $CDP_PORT --seed $SEED)…"
    nohup npm run explore -w insomnia-smoke-test -- --keep-open --debug-port "$CDP_PORT" --seed "$SEED" \
      >"$LOG_DIR/explore.log" 2>&1 &
  else
    echo "  • launching Insomnia (explore.ts --keep-open --debug-port $CDP_PORT)…"
    nohup npm run explore -w insomnia-smoke-test -- --keep-open --debug-port "$CDP_PORT" \
      >"$LOG_DIR/explore.log" 2>&1 &
  fi
  wait_port "$CDP_PORT" "renderer CDP"
fi

cat <<EOF

[start-cdp] READY ✅
  renderer CDP endpoint : http://localhost:$CDP_PORT
  @playwright/mcp        : repo .mcp.json -> server "insomnia-cdp"  (--cdp-endpoint http://localhost:$CDP_PORT)
  logs                   : $LOG_DIR

The closed-loop planner subagent now drives the live renderer via
mcp__insomnia-cdp__browser_* tools. Tear down with:
  bash packages/insomnia-smoke-test/agent-poc/start-cdp.sh --stop
EOF
