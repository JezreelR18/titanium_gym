#!/usr/bin/env bash
# ==============================================================
# PASO 4 (opcional pero MUY recomendado) — Respaldos automáticos
# DÓNDE SE EJECUTA: dentro de la VM.
# USO:  sudo bash 05-respaldos.sh
# Crea el bucket de Cloud Storage (gratis hasta 5 GB en us-central1),
# instala el cron diario y hace un respaldo de prueba.
# ==============================================================
set -euo pipefail
[ "$EUID" -eq 0 ] || { echo "Ejecútalo con sudo"; exit 1; }

APP_DIR="/opt/titanium-gym"
PROJECT_ID="$(curl -s -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/project/project-id)"
BUCKET="${BUCKET:-gs://${PROJECT_ID}-titanium-backups}"
REGION="us-central1"

echo "==> Bucket: $BUCKET"
if ! gcloud storage buckets describe "$BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "$BUCKET" \
    --location="$REGION" \
    --default-storage-class=STANDARD \
    --uniform-bucket-level-access
  # Borra respaldos de más de 30 días para no salir del nivel gratuito
  cat > /tmp/lifecycle.json <<JSON
{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}
JSON
  gcloud storage buckets update "$BUCKET" --lifecycle-file=/tmp/lifecycle.json
  rm -f /tmp/lifecycle.json
else
  echo "    (ya existía)"
fi

echo "==> Cron diario a las 03:00 (hora del servidor, UTC)"
cat > /etc/cron.d/titanium-backup <<CRON
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
BACKUP_BUCKET=${BUCKET}
0 3 * * * root ${APP_DIR}/deploy/backup.sh >> /var/log/titanium-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/titanium-backup

echo "==> Respaldo de prueba"
BACKUP_BUCKET="$BUCKET" bash "$APP_DIR/deploy/backup.sh"

echo
echo "Listo. Para restaurar un respaldo:"
echo "  sudo -u postgres pg_restore -d titanium_gym --clean --if-exists /var/backups/titanium/ARCHIVO.dump"
