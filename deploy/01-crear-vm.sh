#!/usr/bin/env bash
# ==============================================================
# PASO 1 — Crear la VM "Always Free" en Google Cloud
# DÓNDE SE EJECUTA: Cloud Shell (https://shell.cloud.google.com)
#                   NO en tu Mac. Cloud Shell ya trae gcloud listo.
# USO:  bash 01-crear-vm.sh
# ==============================================================
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-careful-striker-451805-s1}"
REGION="${REGION:-us-central1}"      # us-central1 | us-east1 | us-west1  <- únicas regiones del nivel gratuito
ZONE="${ZONE:-us-central1-a}"
VM_NAME="${VM_NAME:-titanium-gym}"

echo "==> Proyecto: $PROJECT_ID   Zona: $ZONE"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "==> Habilitando Compute Engine API (tarda ~1 min la primera vez)"
gcloud services enable compute.googleapis.com storage.googleapis.com

echo "==> Reservando IP estática"
# Misma tarifa que una IP efímera mientras está en uso (~USD 3.65/mes),
# pero no cambia al reiniciar la VM (si cambiara, se rompería el dominio y el certificado HTTPS).
gcloud compute addresses create "${VM_NAME}-ip" --region "$REGION" 2>/dev/null || echo "    (ya existía)"
STATIC_IP=$(gcloud compute addresses describe "${VM_NAME}-ip" --region "$REGION" --format='value(address)')
echo "    IP: $STATIC_IP"

echo "==> Reglas de firewall 80/443"
gcloud compute firewall-rules create allow-http  --network=default --allow=tcp:80  --target-tags=http-server  2>/dev/null || echo "    (ya existía)"
gcloud compute firewall-rules create allow-https --network=default --allow=tcp:443 --target-tags=https-server 2>/dev/null || echo "    (ya existía)"

echo "==> Creando VM e2-micro"
# OJO: disco pd-standard de 30 GB. El disco "balanced" que propone la consola SÍ se cobra (~USD 3/mes).
gcloud compute instances create "$VM_NAME" \
  --zone="$ZONE" \
  --machine-type=e2-micro \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --boot-disk-device-name="$VM_NAME" \
  --address="$STATIC_IP" \
  --tags=http-server,https-server \
  --metadata=enable-oslogin=TRUE \
  --scopes=https://www.googleapis.com/auth/cloud-platform \
  --labels=app=titanium-gym

DOMAIN="${STATIC_IP//./-}.sslip.io"

cat <<RESUMEN

==============================================================
  VM CREADA
==============================================================
  Nombre   : $VM_NAME
  Zona     : $ZONE
  IP       : $STATIC_IP
  Dominio  : $DOMAIN      <-- HTTPS gratis vía sslip.io
  API final: https://$DOMAIN/api

  Conéctate con:
    gcloud compute ssh $VM_NAME --zone=$ZONE

  Luego dentro de la VM continúa con el PASO 2 (ver deploy/README.md)
==============================================================
RESUMEN
