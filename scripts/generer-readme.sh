#!/usr/bin/env bash
# ==============================================================================
#  NDM SANTÉ — génère la documentation complète
#    /opt/readme/README.md              état réel du serveur + documentation + TOUS les scripts
#    /opt/readme/README-CODE-COMPLET.md tout le code source + documentation des projets d'origine
#  Copies : /opt/ndm-sante/README.md et /opt/ndm-sante/docs/README-CODE-COMPLET.md (poussées sur GitHub)
#  Emplacement : /opt/ndm-sante/scripts/generer-readme.sh
#  Usage (root) : bash /opt/ndm-sante/scripts/generer-readme.sh
# ==============================================================================
set -uo pipefail
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${README_DIR:-/opt/readme}"
OUT="$OUT_DIR/README.md"
CODE="$OUT_DIR/README-CODE-COMPLET.md"
mkdir -p "$OUT_DIR" "$BASE_DIR/docs"
cd "$BASE_DIR"
VERSION="$(tr -d ' \r\n' < VERSION 2>/dev/null || echo '?')"
NOW="$(date '+%d/%m/%Y à %H:%M')"
envget() { grep -E "^$1=" "$BASE_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }

lang_of() {
  case "$1" in
    *.sh) echo bash ;; *.ts) echo typescript ;; *.tsx) echo tsx ;; *.js|*.cjs|*.mjs) echo javascript ;;
    *.json) echo json ;; *.yml|*.yaml) echo yaml ;; *.md) echo markdown ;; *.css) echo css ;;
    *.html|*.ejs) echo html ;; *.sql) echo sql ;; *.conf|*.template) echo nginx ;;
    *Dockerfile) echo dockerfile ;; .env*|*/.env*) echo ini ;; *) echo text ;;
  esac
}
# bloc de code avec marqueurs d'extraction ; clôture à 4 accents si le fichier contient déjà ```
bloc() { # fichier [nom_marqueur]
  local f="$1" name="${2:-}" fence='```'
  grep -q '```' "$f" && fence='````'
  [ -n "$name" ] && echo "<!-- SCRIPT-START:${name} -->"
  echo "${fence}$(lang_of "$f")"
  cat "$f"; [ -z "$(tail -c1 "$f")" ] || echo
  echo "${fence}"
  [ -n "$name" ] && echo "<!-- SCRIPT-END:${name} -->"
  echo
}

# ------------------------------------------------------------------------------
{
echo "# NDM SANTÉ — Portail santé + Fiche Sanitaire + Fiche Infirmerie + Suivi des Voyages"
echo
echo "**Ensemble Scolaire Notre-Dame des Missions** — plateforme fusionnée (4 projets) installée sur un **LXC Proxmox Debian 12** avec **Docker**, derrière **Nginx Proxy Manager**."
echo
echo "> Document **généré automatiquement** par \`scripts/generer-readme.sh\` le **${NOW}** — version **${VERSION}** — serveur \`$(hostname)\`."
echo "> Il est **auto-suffisant** : état réel de l'installation, documentation complète, toutes les commandes et **tous les scripts** (extraction ci-dessous)."
echo "> À fournir tel quel au début d'une **nouvelle conversation Claude** pour reprendre le projet. Code source complet : \`/opt/readme/README-CODE-COMPLET.md\` (et \`docs/README-CODE-COMPLET.md\` sur GitHub)."
echo
echo "## Sommaire"
echo
echo "0. Conventions · 1. Vue d'ensemble · 2. Arborescence · 3. Installation · 4. Mise à jour · 5. Réseau / NPM / iframe · 6. Zéro cache · 7. Responsive · 8. Comptes · 9. ndm.sh · 10. Sauvegardes · 11. Reprise des anciennes données · 12. Portail · 13. Applications · 14. .env · 15. GitHub · 16. Dépannage · 17. Vigilance · **A. État de l'installation** · **B. Scripts et fichiers d'infrastructure (complets)** · **C. Liste des fichiers**"
echo
echo "## Accès rapide"
echo
echo "| Application | URL publique | Port LXC | Conteneur |"
echo "|---|---|---|---|"
echo "| Portail (hub) — admin : \`/admin\` | $(envget URL_PORTAIL) | $(envget PORT_PORTAIL) | ndm_portail |"
echo "| Fiche Sanitaire | $(envget URL_FICHESANITAIRE) | $(envget PORT_FICHESANITAIRE) | ndm_fichesanitaire |"
echo "| Fiche Infirmerie | $(envget URL_INFIRMERIE) | $(envget PORT_INFIRMERIE) | ndm_infirmerie |"
echo "| Suivi des Voyages | $(envget URL_VOYAGES) | $(envget PORT_VOYAGES) | ndm_voyages |"
echo
echo "Installation / mise à jour : déposer \`installer-ndm-sante.sh\` dans **\`/root/\`** avec FileZilla puis \`bash /root/installer-ndm-sante.sh\`. Identifiants : \`cat /root/ndm-sante-identifiants.txt\`."
echo
cat docs/DOCUMENTATION.md
echo
echo "## A. État de l'installation (au ${NOW})"
echo
echo "### A.1 Système"
echo '```text'
echo "Hôte        : $(hostname)  —  IP : $(hostname -I 2>/dev/null | xargs)"
echo "OS          : $(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-?}")  —  noyau $(uname -r)"
echo "Virtualisation : $(systemd-detect-virt 2>/dev/null || echo ?)"
echo "Docker      : $(docker --version 2>/dev/null || echo absent)"
echo "Compose     : $(docker compose version 2>/dev/null | head -n1 || echo absent)"
echo "Disque      : $(df -h "$BASE_DIR" 2>/dev/null | tail -n1 | awk '{print $3" utilisés / "$2" ("$5")"}')"
echo "Mémoire     : $(free -h 2>/dev/null | awk '/^Mem/{print $3" / "$2}')"
echo '```'
echo
echo "### A.2 Conteneurs"
echo '```text'
docker compose ps 2>/dev/null || echo "docker compose indisponible"
echo '```'
echo
echo "### A.3 Tests de santé"
echo '```text'
t() { if curl -fsS -o /dev/null --max-time 5 "$2" 2>/dev/null; then echo "OK      $1  $2"; else echo "ÉCHEC   $1  $2"; fi; }
t "Portail         " "http://127.0.0.1:$(envget PORT_PORTAIL)/health"
t "Fiche Sanitaire " "http://127.0.0.1:$(envget PORT_FICHESANITAIRE)/health"
t "Fiche Infirmerie" "http://127.0.0.1:$(envget PORT_INFIRMERIE)/api/classes"
t "Suivi Voyages   " "http://127.0.0.1:$(envget PORT_VOYAGES)/api/health"
echo '```'
echo
echo "### A.4 Images Docker"
echo '```text'
docker images --format '{{.Repository}}:{{.Tag}}  {{.Size}}  {{.CreatedSince}}' 2>/dev/null | grep -E 'ndm-sante|postgres|nginx' || true
echo '```'
echo
echo "### A.5 Configuration \`.env\` (secrets masqués)"
echo '```ini'
if [ -f .env ]; then
  grep -E '^[A-Z_]+=' .env | sed -E 's/^([A-Z_]*(PASSWORD|SECRET|TOKEN)[A-Z_]*)=.+$/\1=******** (masqué)/'
else echo "# .env absent"; fi
echo '```'
echo
echo "### A.6 Volumes de données"
echo '```text'
du -sh donnees/* donnees/*/* 2>/dev/null || echo "donnees/ vide"
echo "Volume PostgreSQL : $(docker volume inspect ndm-sante_ndm_pgdata --format '{{.Mountpoint}}' 2>/dev/null || echo ?)"
echo '```'
echo
echo "### A.7 Dernières sauvegardes"
echo '```text'
ls -lh sauvegardes/ndm-*.tgz 2>/dev/null | tail -n 10 || true
[ -n "$(ls sauvegardes/ndm-*.tgz 2>/dev/null)" ] || echo "Aucune sauvegarde pour l'instant (cron 02:30 : /etc/cron.d/ndm-sante)"
echo '```'
echo
echo "### A.8 Git"
echo '```text'
if [ -d .git ]; then
  echo "Dépôt : $(git remote get-url origin 2>/dev/null || echo 'pas de remote')"
  git log --oneline -n 10 2>/dev/null || true
else echo "Pas encore de dépôt git (1er push : bash /opt/ndm-sante/scripts/push-github.sh)"; fi
echo '```'
echo
echo "## B. Scripts et fichiers d'infrastructure (contenu complet)"
echo
echo "**Extraire tous les scripts de ce document** (dans un dossier vide contenant \`README.md\`) :"
echo
echo '```bash'
echo 'for n in $(grep -o "^<!-- SCRIPT-START:[^ ]* -->" README.md | sed "s/.*START:\(.*\) -->/\1/"); do'
echo '  mkdir -p "$(dirname "$n")"'
echo '  sed -n "/^<!-- SCRIPT-START:${n//\//\\/} -->\$/,/^<!-- SCRIPT-END:${n//\//\\/} -->\$/p" README.md | sed "1,2d" | head -n -2 > "$n"'
echo 'done; find . -name "*.sh" -exec chmod +x {} \;'
echo '```'
echo
echo "Ces fichiers + le code des applications (\`README-CODE-COMPLET.md\`) permettent de reconstruire \`/opt/ndm-sante\` à l'identique ; le plus simple reste l'installateur tout-en-un (\`bash /opt/ndm-sante/scripts/ndm.sh installateur\` le refabrique)."
echo
for f in scripts/installer.sh scripts/ndm.sh scripts/push-github.sh scripts/generer-readme.sh scripts/fabriquer-installateur.sh \
         installer/header.sh installer/footer.sh docker-compose.yml .env.example .gitignore VERSION \
         passerelle/templates/default.conf.template passerelle/ndm-proxy.conf postgres-init/01-bases.sh \
         apps/portail/Dockerfile apps/fichesanitaire/Dockerfile apps/infirmerie/Dockerfile apps/infirmerie/docker-entrypoint.sh \
         apps/voyages/Dockerfile apps/portail/server.js apps/portail/centrale.js apps/portail/parents.js apps/portail/package.json \
         apps/portail/views/portail.ejs apps/portail/views/admin/index.ejs apps/portail/views/admin/centrale.ejs apps/portail/views/admin/login.ejs apps/portail/views/login.ejs; do
  [ -f "$f" ] || continue
  echo "### \`$f\`"
  echo
  bloc "$f" "$f"
done
echo "## C. Liste complète des fichiers du projet"
echo
echo '```text'
find . \( -path ./.git -o -path ./donnees -o -path ./sauvegardes -o -path ./backups-installateur -o -name node_modules -o -name dist \) -prune \
  -o -type f ! -name '.env' -printf '%8s  %p\n' 2>/dev/null | sed 's#  \./#  #' | LC_ALL=C sort -k2
echo '```'
echo
echo "---"
echo "*Fin du README — généré le ${NOW} par scripts/generer-readme.sh*"
} > "$OUT.tmp" && mv "$OUT.tmp" "$OUT"

# ------------------------------------------------------------------------------
{
echo "# NDM SANTÉ — code source complet (v${VERSION}, ${NOW})"
echo
echo "Tous les fichiers sources des 4 applications et de l'infrastructure, tels qu'installés dans \`/opt/ndm-sante\`."
echo "Les fichiers \`package-lock.json\` sont exclus (régénérés par npm). Documentation d'exploitation : \`README.md\`."
echo
echo "## Sommaire"
echo
find apps -type f | grep -vE '/(node_modules|dist)/|package-lock\.json$|\.(png|jpg|jpeg|ico|webp|gif)$' | LC_ALL=C sort | sed 's#^#- `#; s#$#`#'
echo
for f in $(find apps -type f | grep -vE '/(node_modules|dist)/|package-lock\.json$|\.(png|jpg|jpeg|ico|webp|gif)$' | LC_ALL=C sort); do
  echo "## \`$f\`"
  echo
  bloc "$f" "$f"
done
echo "# Annexes — documentation des projets d'origine"
echo
echo "> ⚠️ Ces documents décrivent les **anciennes installations séparées** (chemins \`/opt/fichesanitaire-voyages\`, \`/opt/infirmerie\`, \`/opt/portail-voyages\`, scripts \`maj-portail.sh\`…). Dans NDM SANTÉ, seuls le **fonctionnement des applications**, les **API** et les **règles métier** restent valables ; l'installation et l'exploitation sont décrites dans \`README.md\`."
echo
for f in docs/origine/*.md; do
  [ -f "$f" ] || continue
  echo "## Annexe : \`$f\`"
  echo
  sed 's/^#/##/' "$f"
  echo
done
} > "$CODE.tmp" && mv "$CODE.tmp" "$CODE"

cp -f "$OUT" "$BASE_DIR/README.md"
cp -f "$CODE" "$BASE_DIR/docs/README-CODE-COMPLET.md"
chmod 644 "$OUT" "$CODE"
echo "✔ README : $OUT ($(du -h "$OUT" | cut -f1)) — code complet : $CODE ($(du -h "$CODE" | cut -f1))"
