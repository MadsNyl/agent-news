#!/bin/bash
cd "$(dirname "$0")/../.."

LOG=/tmp/agent-news-ingest.log

export PATH="/opt/homebrew/bin:$HOME/.bun/bin:$PATH"

if pgrep -x ollama > /dev/null; then
  echo "[$(date)] Ollama already running" >> "$LOG"
else
  echo "[$(date)] Starting Ollama..." >> "$LOG"
  launchctl start homebrew.mxcl.ollama
  sleep 5
  echo "[$(date)] Ollama started" >> "$LOG"
fi

bun run scripts/ingest/main.ts >> "$LOG" 2>&1
