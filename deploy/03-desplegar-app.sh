#!/usr/bin/env bash
# ==============================================================
# PASO 3 — Desplegar la API (FastAPI + Caddy + systemd)
# DÓNDE SE EJECUTA: dentro de la VM, por SSH.
# USO:  sudo bash 03-desplegar-app.sh
# ==============================================================
set -euo pipefail
[ "$EUID" -eq 0 ] || { echo "Ejecútalo con sudo"; exit 1; }

APP_USER="titanium"
APP_DIR="/opt/titanium-gym"
REPO_URL="${REPO_URL:-https://github.com/JezreelR18/titanium_gym.git}"
BRANCH="${BRANCH:-main}"
DB_NAME="titanium_gym"
DB_USER="titanium"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://titanium-gym-orizaba.netlify.app}"
SECRETS_FILE="/root/titanium-secrets.env"

[ -f "$SECRETS_FILE" ] || { echo "Falta $SECRETS_FILE — corre antes 02-configurar-servidor.sh"; exit 1; }
# shellcheck disable=SC1090
. "$SECRETS_FILE"

# IP pública y dominio gratuito sslip.io
IP=$(curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)
DOMAIN="${DOMAIN:-${IP//./-}.sslip.io}"
echo "==> IP pública: $IP"
echo "==> Dominio   : $DOMAIN"

echo "==> 1/6 Código fuente"
# El repo queda en poder del usuario 'titanium' pero git corre como root
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" reset --hard --quiet "origin/$BRANCH"
else
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> 2/6 Entorno virtual y dependencias"
sudo -u "$APP_USER" bash -c "
  set -e
  cd '$APP_DIR/backend'
  [ -d venv ] || python3 -m venv venv
  ./venv/bin/pip install --quiet --upgrade pip wheel
  ./venv/bin/pip install --quiet -r requirements.txt
"

echo "==> 3/6 Archivo .env"
install -o "$APP_USER" -g "$APP_USER" -m 600 /dev/null "$APP_DIR/backend/.env"
cat > "$APP_DIR/backend/.env" <<ENVFILE
APP_NAME=Titanium Gym API
VERSION=1.0.0
DEBUG=false

DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}

SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

CORS_ORIGINS=${FRONTEND_ORIGIN},https://${DOMAIN},http://localhost:5173
ENVFILE
chown "$APP_USER:$APP_USER" "$APP_DIR/backend/.env"
chmod 600 "$APP_DIR/backend/.env"

echo "==> 4/6 Base de datos"
APP_DIR="$APP_DIR" DB_NAME="$DB_NAME" bash "$APP_DIR/deploy/db-migrate.sh"

echo "==> 5/6 Servicio systemd"
cat > /etc/systemd/system/titanium-api.service <<UNIT
[Unit]
Description=Titanium Gym API (FastAPI)
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
ExecStart=${APP_DIR}/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --proxy-headers --forwarded-allow-ips='127.0.0.1'
Restart=always
RestartSec=5
# Endurecimiento
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now titanium-api
systemctl restart titanium-api

echo "==> 6/6 Caddy (HTTPS automático)"
cat > /etc/caddy/Caddyfile <<CADDY
${DOMAIN} {
    encode gzip
    reverse_proxy 127.0.0.1:8000
    log {
        output file /var/log/caddy/titanium.log {
            roll_size 10MiB
            roll_keep 3
        }
    }
}
CADDY
systemctl reload caddy || systemctl restart caddy

echo "==> Esperando a que levante la API..."
sleep 8
systemctl --no-pager --lines=5 status titanium-api || true
echo
echo "Prueba local:"
curl -fsS http://127.0.0.1:8000/api/health && echo || echo "  (la API aún no responde, revisa: journalctl -u titanium-api -n 50)"

cat <<RESUMEN

==============================================================
  DESPLIEGUE TERMINADO
==============================================================
  API      : https://${DOMAIN}/api
  Health   : https://${DOMAIN}/api/health
  Docs     : https://${DOMAIN}/api/docs

  Falta UN paso: apuntar el frontend a esta URL.
  En tu Mac, edita frontend/.env.production:

      VITE_API_URL=https://${DOMAIN}/api

  luego:  git commit -am "chore: apuntar API a GCP" && git push
  (Netlify reconstruye solo.)

  Comandos útiles en la VM:
    sudo systemctl status titanium-api
    sudo journalctl -u titanium-api -f
    sudo bash ${APP_DIR}/deploy/04-actualizar.sh    # desplegar cambios
==============================================================
RESUMEN
