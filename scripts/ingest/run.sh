#!/bin/bash
cd "$(dirname "$0")/../.."

LOG=/tmp/agent-news-ingest.log

if pgrep -x ollama > /dev/null; then
  echo "[$(date)] Ollama already running" >> "$LOG"
else
  echo "[$(date)] Starting Ollama..." >> "$LOG"
  launchctl start homebrew.mxcl.ollama
  sleep 5
  echo "[$(date)] Ollama started" >> "$LOG"
fi

/Users/madsnylund/.bun/bin/bun run scripts/ingest/main.ts >> "$LOG" 2>&1
