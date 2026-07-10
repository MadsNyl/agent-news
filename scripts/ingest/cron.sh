#!/bin/bash
# Stable cron entrypoint. Point the cronjob at THIS file, not run.sh.
# It updates the repo to the latest remote code, then hands off to run.sh
# in a fresh interpreter so the (possibly updated) run.sh is read cleanly.
cd "$(dirname "$0")/../.."

LOG=/tmp/agent-news-ingest.log

export PATH="/opt/homebrew/bin:$HOME/.bun/bin:$PATH"

echo "[$(date)] Pulling latest ingest code..." >> "$LOG"
git fetch origin >> "$LOG" 2>&1
git reset --hard origin/main >> "$LOG" 2>&1

exec bash scripts/ingest/run.sh
