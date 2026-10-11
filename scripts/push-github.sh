#!/usr/bin/env bash
# ==============================================================================
#  NDM SANTÉ — push du projet sur GitHub
#  Emplacement : /opt/ndm-sante/scripts/push-github.sh
#  Usage (root) : bash /opt/ndm-sante/scripts/push-github.sh ["message du commit"]
#
#  Compte GitHub : serviceinformatique-droid   Dépôt : ndm-sante (privé, créé automatiquement)
#  Jeton (Personal Access Token « classic », case « repo » cochée) :
#    GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic) > Generate new token
#  - 1re fois : le script demande le jeton (saisie masquée) et l'enregistre dans /root/.github-token (chmod 600)
#  - ou :       GITHUB_TOKEN=ghp_xxx bash /opt/ndm-sante/scripts/push-github.sh
#  Le jeton n'est JAMAIS écrit dans le dépôt, la configuration git, un README ni une URL enregistrée.
#  Jamais envoyés : .env, donnees/ (données de santé), sauvegardes/, node_modules/, dist/.
# ==============================================================================
set -euo pipefail
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BASE_DIR"
envget() { grep -E "^$1=" "$BASE_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }

GH_USER="$(envget GITHUB_USER)"; GH_USER="${GH_USER:-serviceinformatique-droid}"
REPO_NAME="${GITHUB_REPO:-$(envget GITHUB_REPO)}"; REPO_NAME="${REPO_NAME:-ndm-sante}"
REPO_URL="https://github.com/${GH_USER}/${REPO_NAME}.git"
MSG="${1:-Mise à jour NDM SANTÉ — $(date '+%Y-%m-%d %H:%M')}"
TOKEN_FILE="/root/.github-token"

command -v git >/dev/null || { apt-get update -y && apt-get install -y git; }

# --- Jeton : variable > fichier > saisie ---------------------------------------
TOKEN="${GITHUB_TOKEN:-}"
[ -z "$TOKEN" ] && [ -s "$TOKEN_FILE" ] && TOKEN="$(tr -d ' \r\n' < "$TOKEN_FILE")"
if [ -z "$TOKEN" ]; then
  if [ -t 0 ]; then
    read -r -s -p "Jeton GitHub (PAT) pour ${GH_USER} : " TOKEN; echo
  else
    echo "❌ Aucun jeton GitHub. Relancez : GITHUB_TOKEN=ghp_xxx bash $0"; exit 1
  fi
fi
[ -n "$TOKEN" ] || { echo "❌ Jeton vide."; exit 1; }
( umask 077; printf '%s\n' "$TOKEN" > "$TOKEN_FILE" ); chmod 600 "$TOKEN_FILE"

api() { curl -sS -H "Authorization: token ${TOKEN}" -H "Accept: application/vnd.github+json" "$@"; }

# --- Création du dépôt privé s'il n'existe pas ---------------------------------
HTTP="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: token ${TOKEN}" "https://api.github.com/repos/${GH_USER}/${REPO_NAME}")"
case "$HTTP" in
  200) ;;
  404) echo "==> Création du dépôt privé ${GH_USER}/${REPO_NAME}"
       api https://api.github.com/user/repos \
         -d "{\"name\":\"${REPO_NAME}\",\"private\":true,\"description\":\"NDM Santé : portail + fiche sanitaire + fiche infirmerie + suivi des voyages (Docker, LXC Debian 12)\"}" >/dev/null ;;
  401) echo "❌ Jeton refusé par GitHub (401). Supprimez $TOKEN_FILE et relancez."; exit 1 ;;
  *)   echo "⚠ Réponse GitHub inattendue ($HTTP) — on tente quand même le push." ;;
esac

# --- README à jour dans le dépôt -----------------------------------------------
bash "$BASE_DIR/scripts/generer-readme.sh" >/dev/null || echo "⚠ README non régénéré"
[ -f /opt/readme/README.md ] && cp /opt/readme/README.md "$BASE_DIR/README.md"
mkdir -p "$BASE_DIR/docs"
[ -f /opt/readme/README-CODE-COMPLET.md ] && cp /opt/readme/README-CODE-COMPLET.md "$BASE_DIR/docs/README-CODE-COMPLET.md"

# --- Dépôt git local ------------------------------------------------------------
git config --global --add safe.directory "$BASE_DIR" >/dev/null 2>&1 || true
[ -d .git ] || git init -q -b main
git config user.name  "$GH_USER"
git config user.email "${GH_USER}@users.noreply.github.com"
git remote get-url origin >/dev/null 2>&1 && git remote set-url origin "$REPO_URL" || git remote add origin "$REPO_URL"

# Garde-fou : aucun secret ni donnée de santé ne doit partir
for interdit in .env donnees sauvegardes; do
  if git ls-files --error-unmatch "$interdit" >/dev/null 2>&1; then git rm -r -q --cached "$interdit"; fi
done

git add -A
if git diff --cached --quiet; then echo "Rien de nouveau à valider."; else git commit -q -m "$MSG"; echo "✔ Commit : $MSG"; fi
git branch -M main

# Authentification par en-tête HTTP temporaire (le jeton n'est stocké nulle part dans git)
AUTH="$(printf '%s:%s' "$GH_USER" "$TOKEN" | base64 | tr -d '\n')"
GITAUTH=(-c "http.https://github.com/.extraheader=Authorization: Basic ${AUTH}")
if git "${GITAUTH[@]}" fetch -q origin main 2>/dev/null; then
  git merge -q --allow-unrelated-histories -X ours --no-edit origin/main 2>/dev/null || true
fi
git "${GITAUTH[@]}" push -u origin main
echo "✅ Poussé sur https://github.com/${GH_USER}/${REPO_NAME}"
