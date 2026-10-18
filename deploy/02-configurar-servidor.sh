#!/usr/bin/env bash
# ==============================================================
# PASO 2 — Preparar el servidor (Ubuntu 24.04 en la VM e2-micro)
# DÓNDE SE EJECUTA: dentro de la VM, por SSH.
# USO:  sudo bash 02-configurar-servidor.sh
# Instala: swap, PostgreSQL 16 (afinado para 1 GB RAM), Python 3.12, Caddy
# ==============================================================
set -euo pipefail
[ "$EUID" -eq 0 ] || { echo "Ejecútalo con sudo"; exit 1; }

APP_USER="titanium"
DB_NAME="titanium_gym"
DB_USER="titanium"
SECRETS_FILE="/root/titanium-secrets.env"

echo "==> 1/6 Swap de 2 GB (la e2-micro sólo tiene 1 GB de RAM)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

echo "==> 2/6 Paquetes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  postgresql postgresql-contrib \
  python3 python3-venv python3-dev \
  build-essential git curl ca-certificates \
  debian-keyring debian-archive-keyring apt-transport-https unattended-upgrades

echo "==> 3/6 Caddy (HTTPS automático con Let's Encrypt)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy
fi

echo "==> 4/6 Afinando PostgreSQL para 1 GB de RAM"
PG_VER=$(ls /etc/postgresql | sort -n | tail -1)
PG_CONF="/etc/postgresql/${PG_VER}/main/conf.d/titanium.conf"
mkdir -p "$(dirname "$PG_CONF")"
cat > "$PG_CONF" <<'PGCONF'
# Afinado para VM e2-micro (1 GB RAM, ~7 usuarios concurrentes)
listen_addresses = 'localhost'
max_connections = 50
shared_buffers = 128MB
effective_cache_size = 512MB
maintenance_work_mem = 48MB
work_mem = 4MB
wal_buffers = 4MB
min_wal_size = 80MB
max_wal_size = 1GB
checkpoint_completion_target = 0.9
random_page_cost = 1.1
log_min_duration_statement = 2000
PGCONF
systemctl restart postgresql
systemctl enable postgresql >/dev/null

echo "==> 5/6 Base de datos y usuario"
if [ -f "$SECRETS_FILE" ]; then
  # shellcheck disable=SC1090
  . "$SECRETS_FILE"
  echo "    Reutilizando credenciales de $SECRETS_FILE"
else
  DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  SECRET_KEY="$(openssl rand -hex 32)"
  umask 077
  cat > "$SECRETS_FILE" <<SECRETS
DB_PASSWORD='${DB_PASSWORD}'
SECRET_KEY='${SECRET_KEY}'
SECRETS
  echo "    Credenciales generadas y guardadas en $SECRETS_FILE (sólo root)"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} PASSWORD '${DB_PASSWORD}';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
# Extensiones que pide el schema (requieren superusuario)
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pgcrypto";'

echo "==> 6/6 Usuario del sistema para la app"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"

# Actualizaciones de seguridad automáticas
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true

echo
echo "=============================================================="
echo "  SERVIDOR LISTO"
echo "    PostgreSQL ${PG_VER} escuchando sólo en localhost"
echo "    BD: ${DB_NAME}   Usuario: ${DB_USER}"
echo "    Secretos: ${SECRETS_FILE}"
echo "  Continúa con el PASO 3:  sudo bash 03-desplegar-app.sh"
echo "=============================================================="
