#!/bin/bash
# Pulse — Smart Personal Music Workstation Launcher

echo "=========================================="
echo " Starting Pulse Workstation..."
echo "=========================================="

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

# Get local Wi-Fi IP
WIFI_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo " Starting Backend API server on http://localhost:3001..."
(cd backend && node dist/server.js) &
BACKEND_PID=$!

sleep 1

echo " Starting Frontend on http://localhost:5173..."
echo " Phone Wi-Fi Link: http://${WIFI_IP}:5173"
echo "=========================================="
(cd frontend && npm run dev -- --host 0.0.0.0) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
