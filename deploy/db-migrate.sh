#!/usr/bin/env bash
# ==============================================================
# Aplica el schema, las migraciones pendientes y el seed inicial.
# Idempotente: lleva registro en la tabla schema_migrations.
# USO (en la VM):  sudo bash deploy/db-migrate.sh
# ==============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/titanium-gym}"
DB_NAME="${DB_NAME:-titanium_gym}"
SQL_DIR="$APP_DIR/database"
PSQL=(sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME")

run_sql_file() {  # archivo, etiqueta
  local file="$1" tag="$2"
  echo "    aplicando $tag"
  "${PSQL[@]}" -f "$file" >/dev/null
  "${PSQL[@]}" -c "INSERT INTO schema_migrations(filename) VALUES ('$tag') ON CONFLICT DO NOTHING;" >/dev/null
}

already_applied() {
  [ "$("${PSQL[@]}" -tAc "SELECT count(*) FROM schema_migrations WHERE filename='$1'")" != "0" ]
}

echo "==> Tabla de control de migraciones"
"${PSQL[@]}" -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);" >/dev/null

echo "==> Schema base"
HAS_USERS=$("${PSQL[@]}" -tAc "SELECT to_regclass('public.users') IS NOT NULL")
if [ "$HAS_USERS" != "t" ]; then
  run_sql_file "$SQL_DIR/titanium_gym_schema.sql" "000_titanium_gym_schema.sql"
else
  "${PSQL[@]}" -c "INSERT INTO schema_migrations(filename) VALUES ('000_titanium_gym_schema.sql') ON CONFLICT DO NOTHING;" >/dev/null
  echo "    ya existía"
fi

echo "==> Migraciones"
for f in "$SQL_DIR"/migrations/*.sql; do
  tag="$(basename "$f")"
  if already_applied "$tag"; then
    echo "    omitida $tag"
  else
    run_sql_file "$f" "$tag"
  fi
done

echo "==> Seed de producción (roles, permisos y usuario inicial)"
USER_COUNT=$("${PSQL[@]}" -tAc "SELECT count(*) FROM users")
if [ ! -f "$SQL_DIR/seed_production.sql" ]; then
  echo "    !! FALTA $SQL_DIR/seed_production.sql — no se creó el usuario inicial."
  echo "       Haz commit de ese archivo en GitHub y vuelve a correr este script."
elif [ "$USER_COUNT" = "0" ]; then
  run_sql_file "$SQL_DIR/seed_production.sql" "seed_production.sql"
  echo
  echo "    Usuario inicial creado -> usuario: admin / correo: admin@titaniumgym.com"
  echo "    La contraseña es la que ya definiste en database/seed_production.sql."
  echo "    CÁMBIALA desde el sistema en cuanto entres por primera vez."
else
  echo "    omitido (ya hay $USER_COUNT usuarios)"
fi

echo "==> Permisos del usuario de la aplicación"
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" <<SQL >/dev/null
GRANT ALL ON SCHEMA public TO titanium;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO titanium;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO titanium;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO titanium;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO titanium;
SQL

echo "==> Base de datos lista"
