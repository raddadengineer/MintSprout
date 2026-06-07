#!/usr/bin/env bash
# MintSprout PostgreSQL backup script (Docker Compose).
# Usage: ./scripts/backup-db.sh [output_dir]
# Env: BACKUP_RETENTION_DAYS (default 14), DB_CONTAINER (default mintsprout-db),
#      DB_USER (default mintsprout), DB_NAME (default mintsprout)

set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
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

if [[ "$RETENTION" =~ ^[0-9]+$ ]] && [[ "$RETENTION" -gt 0 ]]; then
  find "$OUTPUT_DIR" -maxdepth 1 -type f \( -name 'mintsprout-*.sql' -o -name 'mintsprout-*.sql.gz' \) -mtime +"$RETENTION" -delete
  echo "Pruned backups older than ${RETENTION} days in $OUTPUT_DIR"
fi
