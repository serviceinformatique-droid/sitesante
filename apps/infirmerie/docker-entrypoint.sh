#!/bin/sh
# Rend le cahier des charges RGPD persistant : la version modifiée dans l'application
# est conservée dans /app/data (volume) et survit aux reconstructions de l'image.
set -e
mkdir -p /app/data/archives
if [ ! -L /app/CAHIER_DES_CHARGES_RGPD.md ]; then
  [ -f /app/data/CAHIER_DES_CHARGES_RGPD.md ] || cp /app/CAHIER_DES_CHARGES_RGPD.md /app/data/CAHIER_DES_CHARGES_RGPD.md
  rm -f /app/CAHIER_DES_CHARGES_RGPD.md
  ln -s /app/data/CAHIER_DES_CHARGES_RGPD.md /app/CAHIER_DES_CHARGES_RGPD.md
fi
cp -f /app/data/CAHIER_DES_CHARGES_RGPD.md /app/public/CAHIER_DES_CHARGES_RGPD.md 2>/dev/null || true
exec "$@"
