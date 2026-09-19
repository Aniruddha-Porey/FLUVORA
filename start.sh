#!/usr/bin/env bash
# FLUVORA one-command launcher.
# Installs deps if missing, starts the API, then serves a PRODUCTION build
# (hashed assets = no stale CSS/JS cache issues in any browser).
set -e
cd "$(dirname "$0")"

echo "🌊 FLUVORA — starting…"

(cd server && [ -d node_modules ] || npm install --no-audit --no-fund --loglevel=error)
(cd client && [ -d node_modules ] || npm install --no-audit --no-fund --loglevel=error)

node server/server.js &
API_PID=$!

(cd client && npx vite build --logLevel error && npx vite preview --host 0.0.0.0 --port 5173) &
UI_PID=$!

trap "kill $API_PID $UI_PID 2>/dev/null" INT TERM
echo "✅ API on :5000 · UI on :5173 (login: admin / fluvora123)"
wait
