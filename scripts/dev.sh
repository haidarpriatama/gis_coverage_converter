#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
FRONTEND_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:$BACKEND_PORT}"

if [ ! -x "$BACKEND_DIR/.venv/bin/python" ]; then
  echo "Backend virtualenv belum ada. Jalankan dulu:"
  echo "  cd backend"
  echo "  python -m venv .venv"
  echo "  source .venv/bin/activate"
  echo "  pip install -r requirements.txt"
  exit 1
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Frontend dependencies belum ada. Jalankan dulu:"
  echo "  cd frontend"
  echo "  npm install"
  exit 1
fi

cleanup() {
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "${FRONTEND_PID:-}" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting backend at http://localhost:$BACKEND_PORT"
(
  cd "$BACKEND_DIR"
  .venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

echo "Starting frontend at http://localhost:$FRONTEND_PORT"
(
  cd "$FRONTEND_DIR"
  NEXT_PUBLIC_API_BASE_URL="$FRONTEND_API_BASE_URL" npm run dev -- -p "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

wait -n "$BACKEND_PID" "$FRONTEND_PID"
