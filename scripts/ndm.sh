#!/usr/bin/env bash
# ==============================================================================
#  NDM SANTÉ — outil d'exploitation
#  Emplacement : /opt/ndm-sante/scripts/ndm.sh      Usage : bash /opt/ndm-sante/scripts/ndm.sh <commande>
# ==============================================================================
set -euo pipefail
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BASE_DIR"
ENV_FILE="$BASE_DIR/.env"
envget() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }

aide() {
  cat <<'AIDE'
NDM SANTÉ — commandes (en root) :  bash /opt/ndm-sante/scripts/ndm.sh <commande>

  etat                    état des conteneurs + test de chaque application
  urls                    adresses des applications
  identifiants            affiche /root/ndm-sante-identifiants.txt
  logs [service] [n]      journaux (service : portail|fichesanitaire|infirmerie|voyages|postgres|passerelle)
  suivre [service]        journaux en direct (Ctrl+C pour quitter)
  redemarrer [service]    redémarre (après modification de .env : recrée les conteneurs)
  arreter | demarrer      arrête / démarre toute la plateforme
  reconstruire [service]  reconstruit les images Docker puis redémarre
  sauvegarde              sauvegarde complète -> /opt/ndm-sante/sauvegardes/ndm-AAAAMMJJ-HHMM.tgz
  sauvegardes             liste des sauvegardes
  restaurer <fichier.tgz> restaure une sauvegarde (bases + fichiers) — DEMANDE CONFIRMATION
  psql [base]             console SQL (base : fichesanitaire | portail)
  readme                  régénère /opt/readme/README.md (+ README-CODE-COMPLET.md)
  push ["message"]        régénère le README puis pousse sur GitHub
  installateur            refabrique l'installateur tout-en-un /opt/ndm-sante/installer-ndm-sante.sh
  maj                     relance l'installation (idempotent : .env et données conservés)
AIDE
}

sauvegarde() {
  local ts out tmp ret
  ts="$(date +%Y%m%d-%H%M)"; out="$BASE_DIR/sauvegardes/ndm-${ts}.tgz"; tmp="$(mktemp -d)"
  mkdir -p "$BASE_DIR/sauvegardes"
  echo "==> Sauvegarde $out"
  if docker compose ps --status running postgres 2>/dev/null | grep -q ndm_postgres; then
    docker compose exec -T postgres pg_dump -U ndm -Fc fichesanitaire > "$tmp/fichesanitaire.dump"
    docker compose exec -T postgres pg_dump -U ndm -Fc portail        > "$tmp/portail.dump"
  else
    echo "⚠ PostgreSQL arrêté : bases non sauvegardées"
  fi
  cp "$ENV_FILE" "$tmp/env.sauvegarde" 2>/dev/null || true
  tar czf "$out" -C "$tmp" . -C "$BASE_DIR" donnees
  rm -rf "$tmp"; chmod 600 "$out"
  ret="$(envget SAUVEGARDE_RETENTION_JOURS)"; ret="${ret:-14}"
  find "$BASE_DIR/sauvegardes" -maxdepth 1 -name 'ndm-*.tgz' -mtime +"$ret" -delete
  echo "✔ $(du -h "$out" | cut -f1) — rétention ${ret} jours"
}

restaurer() {
  local f="${1:-}" tmp rep
  [ -f "$f" ] || { echo "Usage : ndm.sh restaurer /opt/ndm-sante/sauvegardes/ndm-AAAAMMJJ-HHMM.tgz"; exit 1; }
  echo "⚠ Les données ACTUELLES (bases + dossier donnees/) seront REMPLACÉES par : $f"
  read -r -p "Tapez OUI pour continuer : " rep; [ "$rep" = "OUI" ] || { echo "Annulé."; exit 1; }
  sauvegarde   # filet de sécurité
  tmp="$(mktemp -d)"; tar xzf "$f" -C "$tmp"
  docker compose stop portail fichesanitaire infirmerie voyages
  docker compose up -d postgres; sleep 5
  for b in fichesanitaire portail; do
    if [ -f "$tmp/$b.dump" ]; then
      docker compose exec -T postgres psql -U ndm -d postgres -c "DROP DATABASE IF EXISTS $b WITH (FORCE)"
      docker compose exec -T postgres psql -U ndm -d postgres -c "CREATE DATABASE $b OWNER ndm"
      docker compose exec -T postgres pg_restore -U ndm -d "$b" --no-owner < "$tmp/$b.dump"
      echo "✔ base $b restaurée"
    fi
  done
  if [ -d "$tmp/donnees" ]; then
    rsync -a --delete "$tmp/donnees/" "$BASE_DIR/donnees/"
    echo "✔ dossier donnees/ restauré"
  fi
  rm -rf "$tmp"
  docker compose up -d
  echo "✔ Restauration terminée (le .env n'a PAS été modifié ; copie dans l'archive : env.sauvegarde)"
}

etat() {
  docker compose ps
  echo
  t() { if curl -fsS -o /dev/null --max-time 5 "$2"; then echo "  ✔ $1  $2"; else echo "  ✘ $1  $2"; fi; }
  t "Portail         " "http://127.0.0.1:$(envget PORT_PORTAIL)/health"
  t "Fiche Sanitaire " "http://127.0.0.1:$(envget PORT_FICHESANITAIRE)/health"
  t "Fiche Infirmerie" "http://127.0.0.1:$(envget PORT_INFIRMERIE)/api/classes"
  t "Suivi Voyages   " "http://127.0.0.1:$(envget PORT_VOYAGES)/api/health"
  echo; df -h "$BASE_DIR" | tail -n1 | awk '{print "  Disque : "$3" utilisés / "$2" ("$5")"}'
}

urls() {
  echo "Portail          : $(envget URL_PORTAIL)   (admin : $(envget URL_PORTAIL)/admin)"
  echo "Fiche Sanitaire  : $(envget URL_FICHESANITAIRE)"
  echo "Fiche Infirmerie : $(envget URL_INFIRMERIE)"
  echo "Suivi Voyages    : $(envget URL_VOYAGES)"
}

cmd="${1:-aide}"; shift || true
case "$cmd" in
  etat|status)        etat ;;
  urls)               urls ;;
  identifiants)       cat /root/ndm-sante-identifiants.txt ;;
  logs)               docker compose logs --tail "${2:-150}" ${1:-} ;;
  suivre)             docker compose logs -f --tail 50 ${1:-} ;;
  redemarrer)         docker compose up -d --force-recreate ${1:-} ;;
  arreter)            docker compose stop ;;
  demarrer)           docker compose up -d ;;
  reconstruire)       docker compose build ${1:-} && docker compose up -d ${1:-} ;;
  sauvegarde)         sauvegarde ;;
  sauvegardes)        ls -lh "$BASE_DIR"/sauvegardes/ndm-*.tgz 2>/dev/null || echo "Aucune sauvegarde." ;;
  restaurer)          restaurer "${1:-}" ;;
  psql)               docker compose exec postgres psql -U ndm -d "${1:-fichesanitaire}" ;;
  readme)             bash "$BASE_DIR/scripts/generer-readme.sh" ;;
  push)               bash "$BASE_DIR/scripts/push-github.sh" "${1:-Mise à jour $(date '+%Y-%m-%d %H:%M')}" ;;
  installateur)       bash "$BASE_DIR/scripts/fabriquer-installateur.sh" ;;
  maj|installer)      bash "$BASE_DIR/scripts/installer.sh" ;;
  aide|help|-h|--help) aide ;;
  *) echo "Commande inconnue : $cmd"; aide; exit 1 ;;
esac
