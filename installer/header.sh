#!/usr/bin/env bash
grep -q $'\r' "$0" 2>/dev/null && { sed -i 's/\r$//' "$0"; exec bash "$0" "$@"; } # corrige les fins de ligne Windows (CRLF)
# ==============================================================================
#  INSTALLATEUR TOUT-EN-UN — NDM SANTÉ v__VERSION__  (généré le __DATE__)
#  Fusion de 4 projets : Portail santé (hub iframe) + Fiche Sanitaire de Liaison
#  + Fiche Infirmerie Numérique + Suivi des Voyages Scolaires (DocuSeal)
#  __COUNT__ fichiers intégrés (backend + frontend + Docker + scripts + documentation)
#
#  1) FileZilla (SFTP, utilisateur root) : déposer ce fichier dans   /root/
#  2) Console du LXC Proxmox (root)     :   bash /root/installer-ndm-sante.sh
#
#  Même commande pour les MISES À JOUR : .env, donnees/ et bases PostgreSQL sont conservés,
#  une sauvegarde complète est faite avant, l'ancien code est archivé dans
#  /opt/ndm-sante/backups-installateur/.
#  Options : IP_PUBLIQUE=192.168.1.50  GITHUB_TOKEN=ghp_xxx  GITHUB_PUSH=0  SANS_BUILD=1
#  Prérequis LXC : Debian 12, options « Imbrication » (nesting) + « keyctl » cochées.
# ==============================================================================
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "❌ Lancez ce script en root : bash $0"; exit 1; }
. /etc/os-release 2>/dev/null || true
[ "${VERSION_ID:-}" = "12" ] || echo "⚠️  Prévu pour Debian 12 (détecté : ${PRETTY_NAME:-inconnu}) — on continue."

BASE_DIR=/opt/ndm-sante
STAMP="$(date +%Y%m%d_%H%M%S)"
echo "==> NDM SANTÉ v__VERSION__ → $BASE_DIR"
mkdir -p "$BASE_DIR"

if [ -f "$BASE_DIR/docker-compose.yml" ]; then
  echo "==> Installation existante détectée : sauvegarde des données puis archivage du code"
  bash "$BASE_DIR/scripts/ndm.sh" sauvegarde || echo "⚠️  Sauvegarde des données impossible (on continue)"
  mkdir -p "$BASE_DIR/backups-installateur"
  tar czf "$BASE_DIR/backups-installateur/code_${STAMP}.tgz" -C "$BASE_DIR" \
    --exclude=./donnees --exclude=./sauvegardes --exclude=./backups-installateur --exclude=./.git \
    --exclude='*/node_modules' --exclude='*/dist' .
  ls -1t "$BASE_DIR"/backups-installateur/code_*.tgz 2>/dev/null | tail -n +11 | xargs -r rm -f
  # Le code est entièrement fourni par cet installateur : on repart de dossiers sources propres
  rm -rf "$BASE_DIR/apps" "$BASE_DIR/scripts" "$BASE_DIR/passerelle" "$BASE_DIR/postgres-init" "$BASE_DIR/installer" "$BASE_DIR/docs/origine"
fi

w()  { mkdir -p "$(dirname "$BASE_DIR/$1")"; cat > "$BASE_DIR/$1"; }
wb() { mkdir -p "$(dirname "$BASE_DIR/$1")"; base64 -d > "$BASE_DIR/$1"; }
echo "==> Écriture des fichiers du projet"
