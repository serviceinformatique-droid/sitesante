#!/bin/sh
# Exécuté UNE SEULE FOIS par PostgreSQL à la création du volume ndm_pgdata.
# La base "fichesanitaire" est créée par POSTGRES_DB ; on ajoute la base "portail".
# (L'installateur vérifie aussi son existence à chaque passage.)
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<'SQL'
SELECT 'CREATE DATABASE portail OWNER ndm'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'portail')\gexec
SQL
