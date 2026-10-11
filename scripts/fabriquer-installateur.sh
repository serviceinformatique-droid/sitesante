#!/usr/bin/env bash
# ==============================================================================
#  NDM SANTÉ — fabrique l'installateur TOUT-EN-UN à partir du code installé
#  Emplacement : /opt/ndm-sante/scripts/fabriquer-installateur.sh
#  Usage (root) : bash /opt/ndm-sante/scripts/fabriquer-installateur.sh [fichier_de_sortie]
#     défaut : /opt/ndm-sante/installer-ndm-sante.sh
#  Le fichier produit contient TOUS les fichiers du projet (blocs « cat » heredoc, base64 pour
#  les binaires), encadrés par installer/header.sh et installer/footer.sh.
#  Pour réinstaller ailleurs : récupérer le fichier avec FileZilla, le déposer dans /root/
#  du nouveau LXC puis : bash /root/installer-ndm-sante.sh
# ==============================================================================
set -euo pipefail
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$BASE_DIR/installer-ndm-sante.sh}"
D="__NDM_FIN_DU_FICHIER__"
VERSION="$(tr -d ' \r\n' < "$BASE_DIR/VERSION")"
NOW="$(date '+%d/%m/%Y %H:%M')"

cd "$BASE_DIR"
mapfile -t FILES < <(find . \( -path ./.git -o -path ./donnees -o -path ./sauvegardes -o -path ./backups-installateur \
  -o -name node_modules -o -name dist \) -prune -o -type f \
  ! -name '.env' ! -name '*.log' ! -name 'installer-ndm-sante*.sh' ! -path './README.md' ! -path './docs/README-CODE-COMPLET.md' -print \
  | sed 's#^\./##' | LC_ALL=C sort)
COUNT="${#FILES[@]}"

TMP="$(mktemp)"
sed -e "s/__VERSION__/${VERSION}/g" -e "s#__DATE__#${NOW}#g" -e "s/__COUNT__/${COUNT}/g" installer/header.sh > "$TMP"
for f in "${FILES[@]}"; do
  if grep -qxF "$D" "$f"; then echo "❌ $f contient le délimiteur $D"; rm -f "$TMP"; exit 1; fi
  if grep -qI . "$f" || [ ! -s "$f" ]; then
    printf "w '%s' <<'%s'\n" "$f" "$D" >> "$TMP"
    cat "$f" >> "$TMP"
    [ -z "$(tail -c1 "$f")" ] || echo >> "$TMP"
  else
    printf "wb '%s' <<'%s'\n" "$f" "$D" >> "$TMP"
    base64 -w 76 "$f" >> "$TMP"
  fi
  printf '%s\n' "$D" >> "$TMP"
done
sed -e "s/__COUNT__/${COUNT}/g" installer/footer.sh >> "$TMP"
mv "$TMP" "$OUT"
chmod 700 "$OUT"
bash -n "$OUT" && echo "✅ Installateur créé : $OUT ($COUNT fichiers, $(du -h "$OUT" | cut -f1))"
echo "   FileZilla : le récupérer, le déposer dans /root/ du LXC cible, puis : bash /root/$(basename "$OUT")"
