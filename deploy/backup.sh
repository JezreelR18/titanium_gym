#!/usr/bin/env bash
# ==============================================================
# Respaldo diario de la base de datos.
# Local: /var/backups/titanium (14 días)
# Nube : bucket de Cloud Storage (opcional, 30 días, dentro de los 5 GB gratis)
# Se instala como cron desde 05-respaldos.sh
# ==============================================================
set -euo pipefail

DB_NAME="${DB_NAME:-titanium_gym}"
DEST="/var/backups/titanium"
BUCKET="${BACKUP_BUCKET:-}"          # ej. gs://titanium-gym-backups
STAMP="$(date +%Y%m%d-%H%M)"
FILE="$DEST/${DB_NAME}-${STAMP}.dump"

mkdir -p "$DEST"
sudo -u postgres pg_dump -Fc "$DB_NAME" > "$FILE"
chmod 600 "$FILE"
echo "Respaldo creado: $FILE ($(du -h "$FILE" | cut -f1))"

# Rotación local: conservar 14 días
find "$DEST" -name "${DB_NAME}-*.dump" -mtime +14 -delete

# Copia a Cloud Storage si hay bucket configurado
if [ -n "$BUCKET" ] && command -v gcloud >/dev/null; then
  gcloud storage cp "$FILE" "$BUCKET/" --quiet && echo "Subido a $BUCKET"
fi
