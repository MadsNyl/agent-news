#!/bin/bash
# Stable cron entrypoint. Point the cronjob at THIS file, not run.sh.
# It updates the repo to the latest remote code, then hands off to run.sh
# in a fresh interpreter so the (possibly updated) run.sh is read cleanly.
cd "$(dirname "$0")/../.."

LOG=/tmp/agent-news-ingest.log
LOCK=/tmp/agent-news-ingest.lock

export PATH="/opt/homebrew/bin:$HOME/.bun/bin:$PATH"

# Prevent overlapping runs. mkdir is atomic, so only one run can hold the lock.
# If the lock exists but its owner is dead, it's stale — reclaim it.
if ! mkdir "$LOCK" 2>/dev/null; then
  OLDPID=$(cat "$LOCK/pid" 2>/dev/null)
  if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then
    echo "[$(date)] Previous run (pid $OLDPID) still active — skipping." >> "$LOG"
    exit 0
  fi
  echo "[$(date)] Reclaiming stale lock (pid ${OLDPID:-unknown})." >> "$LOG"
fi
echo $$ > "$LOCK/pid"
# Clean up our lock on any exit (normal, error, or signal).
trap 'rm -rf "$LOCK"' EXIT INT TERM

# We now hold the only run lock, so any leftover git index.lock is stale
# (a previous run was killed mid-operation) and safe to remove.
rm -f .git/index.lock

echo "[$(date)] Pulling latest ingest code..." >> "$LOG"
git fetch origin >> "$LOG" 2>&1
git reset --hard origin/main >> "$LOG" 2>&1

# Note: not exec'd, so the EXIT trap fires and releases the lock after run.sh
# finishes. run.sh is still read fresh by a new interpreter.
bash scripts/ingest/run.sh
