#!/usr/bin/env bash
# MintSprout PostgreSQL backup script (Docker Compose host).
# Usage: ./scripts/backup-db.sh [tier] [output_dir]
#   tier: manual (default), daily, or weekly — subfolder under MINTSPROUT_BACKUPS_DIR
# Env: MINTSPROUT_BACKUPS_DIR, BACKUP_RETENTION_DAYS, BACKUP_DAILY_RETENTION_DAYS,
#      BACKUP_WEEKLY_RETENTION_WEEKS, DB_CONTAINER, DB_USER, DB_NAME

set -euo pipefail

TIER="${1:-manual}"
if [[ "$TIER" == /* ]] || [[ "$TIER" == ./* ]]; then
  # Allow legacy: first arg was output_dir path
  OUTPUT_DIR="$TIER"
  TIER="manual"
else
  case "$TIER" in
    manual|daily|weekly) ;;
    *)
      echo "Unknown tier '$TIER' (use manual, daily, or weekly)" >&2
      exit 1
      ;;
  esac
  OUTPUT_DIR="${2:-${MINTSPROUT_BACKUPS_DIR:-./data/backups}/${TIER}}"
fi

RETENTION="${BACKUP_RETENTION_DAYS:-${BACKUP_DAILY_RETENTION_DAYS:-14}}"
CONTAINER="${DB_CONTAINER:-mintsprout-db}"
DB_USER="${DB_USER:-mintsprout}"
DB_NAME="${DB_NAME:-mintsprout}"

mkdir -p "$OUTPUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUTFILE="$OUTPUT_DIR/mintsprout-${STAMP}.sql"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Error: container '$CONTAINER' is not running." >&2
  echo "Start the stack with: docker compose up -d postgres" >&2
  exit 1
fi

echo "Backing up $DB_NAME from $CONTAINER -> $OUTFILE"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$OUTFILE"

if command -v gzip >/dev/null 2>&1; then
  gzip -f "$OUTFILE"
  OUTFILE="${OUTFILE}.gz"
fi

echo "Backup written: $OUTFILE"

if [[ "$TIER" == "weekly" ]]; then
  WEEKS="${BACKUP_WEEKLY_RETENTION_WEEKS:-8}"
  if [[ "$WEEKS" =~ ^[0-9]+$ ]] && [[ "$WEEKS" -gt 0 ]]; then
    find "$OUTPUT_DIR" -maxdepth 1 -type f \( -name 'mintsprout-*.sql' -o -name 'mintsprout-*.sql.gz' \) -mtime +$((WEEKS * 7)) -delete
    echo "Pruned weekly backups older than ${WEEKS} weeks in $OUTPUT_DIR"
  fi
elif [[ "$RETENTION" =~ ^[0-9]+$ ]] && [[ "$RETENTION" -gt 0 ]]; then
  find "$OUTPUT_DIR" -maxdepth 1 -type f \( -name 'mintsprout-*.sql' -o -name 'mintsprout-*.sql.gz' \) -mtime +"$RETENTION" -delete
  echo "Pruned backups older than ${RETENTION} days in $OUTPUT_DIR"
fi
