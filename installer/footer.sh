echo "✓ __COUNT__ fichiers écrits dans $BASE_DIR"
SELF="$(readlink -f "$0" 2>/dev/null || echo "$0")"
if [ -f "$SELF" ] && [ "$SELF" != "$BASE_DIR/installer-ndm-sante.sh" ]; then
  cp -f "$SELF" "$BASE_DIR/installer-ndm-sante.sh"
  chmod 700 "$BASE_DIR/installer-ndm-sante.sh"
fi
chmod +x "$BASE_DIR"/scripts/*.sh "$BASE_DIR"/postgres-init/*.sh "$BASE_DIR"/apps/infirmerie/docker-entrypoint.sh
echo "==> Lancement de scripts/installer.sh"
exec bash "$BASE_DIR/scripts/installer.sh"
