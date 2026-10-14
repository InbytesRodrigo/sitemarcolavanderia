#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT/backend" && npm run dev &
BACKEND_PID=$!

cd "$ROOT/frontend" && npm run dev

trap "kill $BACKEND_PID" EXIT
