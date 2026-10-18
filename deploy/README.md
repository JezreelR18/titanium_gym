# Migración a Google Cloud — Titanium Gym

Guía para mover la API y la base de datos a una VM **e2-micro del nivel "Always Free"** de Google Cloud.
El frontend se queda en Netlify (gratis, no hay nada que cambiar ahí salvo una variable).

---

## Qué vamos a montar

```
Netlify  (frontend React, gratis)
   │  HTTPS
   ▼
VM e2-micro · us-central1 · 1 GB RAM · 30 GB disco standard
   ├── Caddy        → HTTPS automático (Let's Encrypt) en <ip>.sslip.io
   ├── FastAPI      → uvicorn + systemd, siempre encendido, sin "cold starts"
   └── PostgreSQL 16 → local, sólo escucha en 127.0.0.1
          └── respaldo diario → Cloud Storage (5 GB gratis)
```

Con esto desaparecen los dos problemas actuales: la base de datos ya no se pausa por
inactividad y la API ya no se duerme como en el plan gratuito de Render.

---

## Costo real

| Concepto | Costo mensual |
|---|---|
| VM e2-micro (1 por mes, en us-central1 / us-east1 / us-west1) | **USD 0.00** |
| Disco **pd-standard** de 30 GB | **USD 0.00** |
| Salida de datos < 1 GB a Norteamérica | **USD 0.00** |
| Cloud Storage para respaldos (< 5 GB) | **USD 0.00** |
| **Dirección IPv4 externa** (USD 0.005/hora) | **≈ USD 3.65** |
| **Total** | **≈ USD 3.65/mes (≈ $70 MXN)** |

Dos advertencias importantes, por eso usamos los scripts y no la consola:

1. La consola de Google propone por defecto un disco **"balanced"**, que **sí se cobra** (~USD 3/mes).
   El script fuerza `pd-standard`, que es el que entra en el nivel gratuito.
2. Los créditos de prueba de esta cuenta (USD 300) **vencieron el 17 de noviembre de 2025**,
   así que lo que se gaste se cobra a la tarjeta. Por eso el paso 0 es poner una alerta de presupuesto.

### ¿Cómo bajarlo a USD 0.00?
El único cargo es la IPv4. Se puede eliminar con una VM **sólo IPv6** detrás de **Cloudflare gratis**
(Cloudflare traduce a los visitantes IPv4), pero eso requiere un dominio propio (~USD 12/año ≈ $220 MXN).
Sale **más barato al año** que pagar la IPv4 (USD 44/año). Si en algún momento compras un dominio, avísame y
cambiamos a ese esquema. Por ahora, sin dominio, usamos sslip.io + IPv4.

---

## Datos de la cuenta (ya verificados)

- Proyecto: `careful-striker-451805-s1` ("My First Project")
- Cuenta de facturación: `01176D-CD807C-B9B0F8`, activa, gasto actual **$0.00**
- Compute Engine API: **sin habilitar** (el script la habilita)
- Créditos de prueba: **vencidos**

---

## ⚠️ Paso 0a — Credenciales expuestas en GitHub (atiéndelo ya)

El repositorio `JezreelR18/titanium_gym` es **público** y tenía versionado el archivo
`backend/.env`, accesible para cualquiera en
`https://raw.githubusercontent.com/JezreelR18/titanium_gym/main/backend/.env`.

Contenía la contraseña de tu PostgreSQL local y el `SECRET_KEY` de ejemplo. También está
versionado `backend/scripts/seed_owner.py` con esa misma contraseña en texto plano.

Ya saqué `backend/.env` del control de versiones (junto con 1,795 archivos `.pyc` que no
deberían estar ahí) y endurecí el `.gitignore`. Pero **quitarlo del repo no lo quita del
historial**: sigue siendo recuperable desde commits anteriores. Por eso:

1. **Cambia esa contraseña** en tu Mac y en cualquier otro lugar donde la hayas reutilizado.
2. El `SECRET_KEY` de producción se genera nuevo y aleatorio en el Paso 2, se queda en la VM
   y nunca entra a Git.
3. Para limpiar el historial: `git filter-repo`, o lo más simple, hacer el repo **privado**
   (GitHub → Settings → Danger Zone → Change visibility). Dime si quieres que lo hagamos;
   si lo haces privado, el clonado en la VM necesitará un token de acceso.

La contraseña del usuario `admin` también está en claro en `database/seed_production.sql`.
Cámbiala desde el sistema en cuanto entres la primera vez.

---

## Paso 0b — Subir el código a GitHub (obligatorio antes de empezar)

La VM clona el repositorio, así que todo esto tiene que estar en GitHub primero.
Ojo: `database/seed_production.sql` **no estaba versionado** y el Paso 3 lo necesita.

```bash
cd /Users/jezreel/Downloads/download/gym
git add -A
git commit -m "chore: kit de despliegue en GCP; dejar de versionar secretos y .pyc"
git push
```

---

## Paso 0c — Alerta de presupuesto (toma 2 minutos)

1. Abre https://console.cloud.google.com/billing/01176D-CD807C-B9B0F8/budgets
2. **Crear presupuesto** → Nombre: `Titanium Gym` → Importe: **USD 10/mes**
3. Alertas al 50 %, 90 % y 100 % a tu correo. Guardar.

Así te enteras por correo si algo se sale de lo previsto.

---

## Paso 1 — Crear la VM (desde Cloud Shell, no desde tu Mac)

Tu Mac no tiene `gcloud` instalado y no hace falta: Cloud Shell lo trae listo y es gratis.

1. Abre https://shell.cloud.google.com y acepta la activación.
2. Pega esto:

```bash
git clone https://github.com/JezreelR18/titanium_gym.git
cd titanium_gym
bash deploy/01-crear-vm.sh
```

Al terminar te imprime la **IP** y el **dominio** (`<ip-con-guiones>.sslip.io`). Anótalos.

---

## Paso 2 — Preparar el servidor

Desde la misma Cloud Shell:

```bash
gcloud compute ssh titanium-gym --zone=us-central1-a
```

Ya dentro de la VM:

```bash
sudo apt-get update && sudo apt-get install -y git
sudo git clone https://github.com/JezreelR18/titanium_gym.git /opt/titanium-gym
sudo bash /opt/titanium-gym/deploy/02-configurar-servidor.sh
```

Instala PostgreSQL afinado para 1 GB de RAM, Python, Caddy, 2 GB de swap y genera
las contraseñas (quedan en `/root/titanium-secrets.env`, sólo legible por root).

---

## Paso 3 — Desplegar la API

Todavía dentro de la VM:

```bash
sudo bash /opt/titanium-gym/deploy/03-desplegar-app.sh
```

Esto crea el entorno virtual, el `.env`, carga el **schema + las 8 migraciones + el seed inicial**,
levanta el servicio `titanium-api` y configura Caddy con HTTPS.

Verifica desde tu Mac (sustituye el dominio por el tuyo):

```bash
curl https://34-56-78-90.sslip.io/api/health
# {"status":"ok","app":"Titanium Gym API","version":"1.0.0"}
```

> El certificado HTTPS tarda entre 10 y 60 segundos la primera vez. Si falla, espera y reintenta.

---

## Paso 4 — Respaldos automáticos

```bash
sudo bash /opt/titanium-gym/deploy/05-respaldos.sh
```

Crea el bucket, instala el cron diario de las 03:00 y hace un respaldo de prueba.

---

## Paso 5 — Apuntar el frontend

En tu Mac, edita `frontend/.env.production`:

```
VITE_API_URL=https://TU-DOMINIO.sslip.io/api
```

```bash
git commit -am "chore: apuntar frontend a la API en Google Cloud"
git push
```

Netlify reconstruye solo. Entra a https://titanium-gym-orizaba.netlify.app/login y prueba.

---

## Paso 6 — Apagar lo viejo (sólo cuando todo funcione)

- Render: suspende o borra el servicio `titanium-gym-api`.
- El proveedor anterior de la base de datos: bórralo cuando confirmes que no lo necesitas.

---

## Operación del día a día

| Qué quieres hacer | Comando (dentro de la VM) |
|---|---|
| Desplegar cambios tras un `git push` | `sudo bash /opt/titanium-gym/deploy/04-actualizar.sh` |
| Ver el estado de la API | `sudo systemctl status titanium-api` |
| Ver registros en vivo | `sudo journalctl -u titanium-api -f` |
| Reiniciar la API | `sudo systemctl restart titanium-api` |
| Respaldo manual | `sudo bash /opt/titanium-gym/deploy/backup.sh` |
| Entrar a la base de datos | `sudo -u postgres psql titanium_gym` |
| Ver uso de memoria | `free -h` |

**Restaurar un respaldo:**
```bash
sudo -u postgres pg_restore -d titanium_gym --clean --if-exists /var/backups/titanium/ARCHIVO.dump
```

---

## Si algo falla

| Síntoma | Revisa |
|---|---|
| La API no responde | `sudo journalctl -u titanium-api -n 50` |
| HTTPS no levanta | `sudo journalctl -u caddy -n 50` · ¿el firewall 80/443 está abierto? |
| El frontend marca error de CORS | `CORS_ORIGINS` en `/opt/titanium-gym/backend/.env` debe incluir la URL de Netlify |
| "out of memory" | `free -h`; el swap de 2 GB debe estar activo (`swapon --show`) |
| Aparece un cobro inesperado | Informes de facturación → filtra por SKU; casi siempre es el disco "balanced" o una IP de más |

### Reglas para no salirte del nivel gratuito
- **Una sola** VM e2-micro en todo el proyecto, y sólo en us-central1 / us-east1 / us-west1.
- Disco **pd-standard**, máximo 30 GB en total.
- No crear instancias de **Cloud SQL** (no tiene nivel gratuito: ~USD 10/mes mínimo).
- No dejar IPs estáticas reservadas sin usar (una IP reservada y **no** asignada se cobra igual).
- Si borras la VM, borra también la IP: `gcloud compute addresses delete titanium-gym-ip --region=us-central1`
