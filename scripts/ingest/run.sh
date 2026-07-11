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

# Ensure the embedding model is present (no-op once pulled).
ollama pull "${OLLAMA_EMBED_MODEL:-nomic-embed-text}" >> "$LOG" 2>&1

bun run scripts/ingest/main.ts >> "$LOG" 2>&1
