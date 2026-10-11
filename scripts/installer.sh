#!/usr/bin/env bash
# ==============================================================================
#  NDM SANTÉ — installation / mise à jour (idempotent, sans perte de données)
#  Emplacement : /opt/ndm-sante/scripts/installer.sh
#  Normalement lancé par l'installateur tout-en-un : bash /root/installer-ndm-sante.sh
#  Peut être relancé seul :                         bash /opt/ndm-sante/scripts/installer.sh
#  Variables optionnelles :
#     IP_PUBLIQUE=192.168.1.50   adresse utilisée pour les URL par défaut (sinon IP du LXC)
#     GITHUB_PUSH=0              ne pas pousser sur GitHub à la fin
#     GITHUB_TOKEN=ghp_xxx       jeton GitHub (enregistré dans /root/.github-token)
#     SANS_BUILD=1               ne pas reconstruire les images Docker
# ==============================================================================
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # /opt/ndm-sante
ENV_FILE="$BASE_DIR/.env"
CRED_FILE="/root/ndm-sante-identifiants.txt"
README_DIR="/opt/readme"
VERSION="$(cat "$BASE_DIR/VERSION" 2>/dev/null || echo inconnue)"

VERT='\033[0;32m'; BLEU='\033[0;34m'; JAUNE='\033[1;33m'; ROUGE='\033[0;31m'; NC='\033[0m'
etape() { echo -e "\n${BLEU}==> $*${NC}"; }
ok()    { echo -e "${VERT}✔ $*${NC}"; }
warn()  { echo -e "${JAUNE}⚠ $*${NC}"; }
err()   { echo -e "${ROUGE}✘ $*${NC}"; }

[ "$(id -u)" -eq 0 ] || { err "Lancez ce script en root."; exit 1; }
cd "$BASE_DIR"

echo -e "${BLEU}======================================================================${NC}"
echo -e "${BLEU}  NDM SANTÉ v${VERSION} — Portail + Fiche Sanitaire + Infirmerie + Voyages${NC}"
echo -e "${BLEU}  Dossier : ${BASE_DIR}${NC}"
echo -e "${BLEU}======================================================================${NC}"

# ------------------------------------------------------------------------------
etape "[1/9] Paquets système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg git openssl rsync cron tar gzip

# ------------------------------------------------------------------------------
etape "[2/9] Docker + plugin Compose"
install_docker_officiel() {
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME:-bookworm} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker absent : installation depuis le dépôt officiel Docker…"
  install_docker_officiel
elif ! docker compose version >/dev/null 2>&1; then
  echo "Plugin « docker compose » absent : installation…"
  apt-get install -y docker-compose-plugin 2>/dev/null || install_docker_officiel
fi
systemctl enable --now docker >/dev/null 2>&1 || true
if ! docker info >/dev/null 2>&1; then
  err "Docker ne démarre pas."
  if [ "$(systemd-detect-virt 2>/dev/null || true)" = "lxc" ]; then
    err "Conteneur LXC détecté : dans Proxmox > CT > Options > Fonctionnalités, cochez « Imbrication » (nesting=1)"
    err "et « keyctl » (CT non privilégié), redémarrez le CT puis relancez ce script."
  fi
  exit 1
fi
ok "$(docker --version) / $(docker compose version | head -n1)"

# ------------------------------------------------------------------------------
etape "[3/9] Fichier de configuration .env (jamais écrasé)"
rnd() { openssl rand -base64 32 | tr -d '/+=\n' | cut -c1-"${1:-20}"; }
IP="${IP_PUBLIQUE:-$(hostname -I 2>/dev/null | awk '{print $1}')}"; IP="${IP:-127.0.0.1}"
touch "$ENV_FILE"; chmod 600 "$ENV_FILE"
envget() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }
add_env() { grep -qE "^$1=" "$ENV_FILE" || { printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"; echo "  + $1"; }; }
if [ ! -s "$ENV_FILE" ]; then
  echo "# NDM SANTÉ — configuration générée le $(date '+%d/%m/%Y %H:%M') (voir .env.example pour la documentation)" > "$ENV_FILE"
fi
add_env TZ "Europe/Paris"
add_env FRAME_ANCESTORS "*"
add_env PORT_PORTAIL 8080
add_env PORT_FICHESANITAIRE 8099
add_env PORT_INFIRMERIE 3001
add_env PORT_VOYAGES 3000
add_env URL_PORTAIL        "http://${IP}:$(envget PORT_PORTAIL)"
add_env URL_FICHESANITAIRE "http://${IP}:$(envget PORT_FICHESANITAIRE)"
add_env URL_INFIRMERIE     "http://${IP}:$(envget PORT_INFIRMERIE)"
add_env URL_VOYAGES        "http://${IP}:$(envget PORT_VOYAGES)"
add_env DB_PASSWORD "$(rnd 28)"
add_env SESSION_SECRET "$(rnd 48)"
add_env NDM_INTERNAL_SECRET "$(rnd 48)"
add_env ETABLISSEMENT_NOM "Ensemble Scolaire Notre-Dame des Missions"
add_env PORTAIL_ADMIN_PASSWORD "$(rnd 14)"
add_env PORTAIL_MENU_PASSWORD "$(rnd 10)"
add_env FICHESANITAIRE_ADMIN_PASSWORD "$(rnd 14)"
add_env VOYAGES_ADMIN_PASSWORD "$(rnd 14)"
add_env INFIRMERIE_STAFF_PASSWORD "$(rnd 14)"
add_env VOYAGES_CONSULTATION_PASSWORD "$(rnd 12)"
add_env SMTP_HOST ""
add_env SMTP_PORT 587
add_env SMTP_SECURE false
add_env SMTP_USER ""
add_env SMTP_PASSWORD ""
add_env SMTP_FROM "fichesanitaire@ndmissions.fr"
add_env CRON_SCHEDULE "0 8 * * 1"
add_env TRASH_RETENTION_DAYS 30
add_env BACKUP_RETENTION_HOURS 336
add_env NEXTCLOUD_URL ""
add_env NEXTCLOUD_USERNAME ""
add_env NEXTCLOUD_PASSWORD ""
add_env NEXTCLOUD_ROOT_FOLDER "FICHES INFIRMERIE"
add_env SESSION_TTL_HOURS 12
add_env WEBHOOK_SECRET ""
add_env ALLOW_INSECURE_TLS false
add_env PIECES_PAR_VOYAGE true
add_env PIECES_TAILLE_MAX_MO 30
add_env AUTO_SYNC_MINUTES 15
add_env SAUVEGARDE_RETENTION_JOURS 14
add_env GITHUB_USER "serviceinformatique-droid"
add_env GITHUB_REPO "ndm-sante"
ok ".env prêt ($ENV_FILE, chmod 600)"

# ------------------------------------------------------------------------------
etape "[4/9] Dossiers de données persistantes"
mkdir -p donnees/fichesanitaire/fiches-pdf donnees/fichesanitaire/backups \
         donnees/infirmerie/archives \
         donnees/voyages/data donnees/voyages/backups donnees/voyages/pieces-jointes \
         sauvegardes "$README_DIR"
chmod 700 donnees sauvegardes
chmod +x scripts/*.sh postgres-init/*.sh apps/infirmerie/docker-entrypoint.sh 2>/dev/null || true
ok "donnees/ (fichiers des applications) et sauvegardes/ prêts"

# ------------------------------------------------------------------------------
etape "[5/9] Base PostgreSQL"
docker compose up -d postgres
# -h 127.0.0.1 : on attend l'écoute TCP, qui n'existe qu'une fois l'initialisation (1re fois) terminée
pg_pret() { docker compose exec -T postgres pg_isready -h 127.0.0.1 -U ndm -d fichesanitaire >/dev/null 2>&1; }
for i in $(seq 1 90); do pg_pret && break; sleep 2; done
pg_pret || { err "PostgreSQL ne répond pas"; docker compose logs --tail 50 postgres; exit 1; }
for i in 1 2 3 4 5; do
  if docker compose exec -T postgres psql -h 127.0.0.1 -U ndm -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='portail'" 2>/dev/null | grep -q 1; then break; fi
  docker compose exec -T postgres psql -h 127.0.0.1 -U ndm -d postgres -c "CREATE DATABASE portail OWNER ndm" && break
  sleep 3
done
ok "PostgreSQL prêt (bases : fichesanitaire, portail)"

# ------------------------------------------------------------------------------
etape "[6/9] Construction et démarrage des applications (peut prendre 5 à 10 min la 1re fois)"
if [ "${SANS_BUILD:-0}" = "1" ]; then
  docker compose up -d --remove-orphans
else
  docker compose up -d --build --remove-orphans
fi
docker image prune -f >/dev/null 2>&1 || true

attendre() { # nom url
  for i in $(seq 1 90); do
    if curl -fsS -o /dev/null "$2"; then ok "$1 répond ($2)"; return 0; fi
    sleep 2
  done
  err "$1 ne répond pas ($2)"; return 1
}
ECHEC=0
attendre "Portail"          "http://127.0.0.1:$(envget PORT_PORTAIL)/health"            || ECHEC=1
attendre "Fiche Sanitaire"  "http://127.0.0.1:$(envget PORT_FICHESANITAIRE)/health"     || ECHEC=1
attendre "Fiche Infirmerie" "http://127.0.0.1:$(envget PORT_INFIRMERIE)/api/classes"    || ECHEC=1
attendre "Suivi Voyages"    "http://127.0.0.1:$(envget PORT_VOYAGES)/api/health"        || ECHEC=1
if [ "$ECHEC" = 1 ]; then
  warn "Au moins une application ne répond pas. Journaux : bash $BASE_DIR/scripts/ndm.sh logs <service>"
  docker compose ps
fi

# ------------------------------------------------------------------------------
etape "[7/9] Sauvegarde quotidienne automatique (cron 02:30)"
cat > /etc/cron.d/ndm-sante <<CRON
# NDM SANTÉ — sauvegarde quotidienne (bases PostgreSQL + fichiers) dans $BASE_DIR/sauvegardes
30 2 * * * root bash $BASE_DIR/scripts/ndm.sh sauvegarde >> /var/log/ndm-sante-sauvegarde.log 2>&1
CRON
chmod 644 /etc/cron.d/ndm-sante
systemctl enable --now cron >/dev/null 2>&1 || true
ok "/etc/cron.d/ndm-sante"

# ------------------------------------------------------------------------------
etape "[8/9] Fichier d'identifiants"
umask 077
cat > "$CRED_FILE" <<CRED
NDM SANTÉ — identifiants (mis à jour le $(date '+%d/%m/%Y %H:%M'))
Fichier : $CRED_FILE (lisible par root uniquement) — source : $ENV_FILE

PORTAIL (hub)            : $(envget URL_PORTAIL)
  Administration         : $(envget URL_PORTAIL)/admin
  GESTION CENTRALISÉE    : $(envget URL_PORTAIL)/admin/centrale   (tous les mots de passe + nom de l'établissement)
  Mot de passe admin     : $(envget PORTAIL_ADMIN_PASSWORD)   (valeur initiale ; modifiable dans /admin)
  Menu « Fiche d'inscription » (protégé) : $(envget PORTAIL_MENU_PASSWORD)

FICHE SANITAIRE          : $(envget URL_FICHESANITAIRE)
  Compte admin initial   : administrateur@portail.local / $(envget FICHESANITAIRE_ADMIN_PASSWORD)
                           (créé seulement si aucun administrateur n'existe)

FICHE INFIRMERIE         : $(envget URL_INFIRMERIE)
  Comptes personnel      : admin  et  infirmerie  /  $(envget INFIRMERIE_STAFF_PASSWORD)
                           (mot de passe INITIAL des comptes créés à la 1re installation ;
                            si les comptes existaient déjà, leur mot de passe actuel est conservé)
                           À changer dès la 1re connexion (bouton « Mot de passe »)

SUIVI DES VOYAGES        : $(envget URL_VOYAGES)
  Mot de passe admin     : $(envget VOYAGES_ADMIN_PASSWORD)
  Mot de passe consultation : $(envget VOYAGES_CONSULTATION_PASSWORD)

Base PostgreSQL          : utilisateur ndm / $(envget DB_PASSWORD)  (réseau Docker interne uniquement)
CRED
chmod 600 "$CRED_FILE"
umask 022
ok "$CRED_FILE"

# ------------------------------------------------------------------------------
etape "[9/9] README détaillé (${README_DIR}) + GitHub"
bash "$BASE_DIR/scripts/generer-readme.sh" || warn "Génération du README en échec (non bloquant)"
if [ "${GITHUB_PUSH:-1}" = "1" ] && { [ -n "${GITHUB_TOKEN:-}" ] || [ -s /root/.github-token ]; }; then
  bash "$BASE_DIR/scripts/push-github.sh" "Installation / mise à jour v${VERSION} — $(date '+%Y-%m-%d %H:%M')" \
    || warn "Push GitHub en échec (relancer : bash $BASE_DIR/scripts/push-github.sh)"
else
  warn "GitHub : aucun jeton enregistré. 1re configuration : bash $BASE_DIR/scripts/push-github.sh"
fi

echo
echo -e "${VERT}======================================================================${NC}"
echo -e "${VERT}  ✅ NDM SANTÉ v${VERSION} installé${NC}"
echo -e "  Portail (hub)     : $(envget URL_PORTAIL)       (admin : /admin)"
echo -e "  Fiche Sanitaire   : $(envget URL_FICHESANITAIRE)"
echo -e "  Fiche Infirmerie  : $(envget URL_INFIRMERIE)"
echo -e "  Suivi Voyages     : $(envget URL_VOYAGES)"
echo -e "  Identifiants      : cat $CRED_FILE"
echo -e "  README complet    : $README_DIR/README.md"
echo -e "  Outil d'exploitation : bash $BASE_DIR/scripts/ndm.sh aide"
echo -e "${VERT}======================================================================${NC}"
