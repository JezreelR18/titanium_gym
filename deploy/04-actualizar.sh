#!/usr/bin/env bash
# ==============================================================
# Desplegar cambios nuevos (después de hacer push a GitHub)
# USO (en la VM):  sudo bash /opt/titanium-gym/deploy/04-actualizar.sh
# ==============================================================
set -euo pipefail
[ "$EUID" -eq 0 ] || { echo "Ejecútalo con sudo"; exit 1; }

APP_USER="titanium"
APP_DIR="/opt/titanium-gym"
BRANCH="${BRANCH:-main}"

echo "==> Respaldo previo"
bash "$APP_DIR/deploy/backup.sh" || echo "    (respaldo falló, continúo)"

echo "==> Actualizando código"
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
git -C "$APP_DIR" reset --hard --quiet "origin/$BRANCH"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 600 "$APP_DIR/backend/.env"

echo "==> Dependencias"
sudo -u "$APP_USER" "$APP_DIR/backend/venv/bin/pip" install --quiet -r "$APP_DIR/backend/requirements.txt"

echo "==> Migraciones pendientes"
bash "$APP_DIR/deploy/db-migrate.sh"

echo "==> Reiniciando API"
systemctl restart titanium-api
sleep 5
if curl -fsS http://127.0.0.1:8000/api/health >/dev/null; then
  echo "==> OK, la API responde"
else
  echo "!! La API no responde. Últimos registros:"
  journalctl -u titanium-api -n 40 --no-pager
  exit 1
fi
