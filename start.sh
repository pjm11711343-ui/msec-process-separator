#!/usr/bin/env bash
# macOS / Linux 용 시작 스크립트
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js 가 없습니다. https://nodejs.org 에서 설치하세요."; exit 1
fi
[ -f .env ] || cp .env.example .env
PORT=$(grep -E '^PORT=' .env | cut -d= -f2); PORT=${PORT:-3000}
[ -d node_modules ] || npm install --no-audit --no-fund || exit 1
( for i in $(seq 1 60); do
    curl -s -o /dev/null "http://localhost:$PORT/api/health" && { (open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT") ; break; }
    sleep 1
  done ) &
echo "실행 중: http://localhost:$PORT  (Ctrl+C 로 종료)"
npm run dev
