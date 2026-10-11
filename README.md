# NDM SANTÉ — Portail santé + Fiche Sanitaire + Fiche Infirmerie + Suivi des Voyages

**Ensemble Scolaire Notre-Dame des Missions** — plateforme fusionnée (4 projets) installée sur un **LXC Proxmox Debian 12** avec **Docker**, derrière **Nginx Proxy Manager**.

> Document **généré automatiquement** par `scripts/generer-readme.sh` le **11/10/2026 à 18:32** — version **1.2.0** — serveur `portailsante`.
> Il est **auto-suffisant** : état réel de l'installation, documentation complète, toutes les commandes et **tous les scripts** (extraction ci-dessous).
> À fournir tel quel au début d'une **nouvelle conversation Claude** pour reprendre le projet. Code source complet : `/opt/readme/README-CODE-COMPLET.md` (et `docs/README-CODE-COMPLET.md` sur GitHub).

## Sommaire

0. Conventions · 1. Vue d'ensemble · 2. Arborescence · 3. Installation · 4. Mise à jour · 5. Réseau / NPM / iframe · 6. Zéro cache · 7. Responsive · 8. Comptes · 9. ndm.sh · 10. Sauvegardes · 11. Reprise des anciennes données · 12. Portail · 13. Applications · 14. .env · 15. GitHub · 16. Dépannage · 17. Vigilance · **A. État de l'installation** · **B. Scripts et fichiers d'infrastructure (complets)** · **C. Liste des fichiers**

## Accès rapide

| Application | URL publique | Port LXC | Conteneur |
|---|---|---|---|
| Portail (hub) — admin : `/admin` | http://172.17.0.1:8080 | 8080 | ndm_portail |
| Fiche Sanitaire | http://172.17.0.1:8099 | 8099 | ndm_fichesanitaire |
| Fiche Infirmerie | http://172.17.0.1:3001 | 3001 | ndm_infirmerie |
| Suivi des Voyages | http://172.17.0.1:3000 | 3000 | ndm_voyages |

Installation / mise à jour : déposer `installer-ndm-sante.sh` dans **`/root/`** avec FileZilla puis `bash /root/installer-ndm-sante.sh`. Identifiants : `cat /root/ndm-sante-identifiants.txt`.

## 0. Conventions de travail avec Claude (à respecter dans toute nouvelle conversation)

- Répondre en **français**.
- Livrer des **scripts complets** (`cat` / `sh`), jamais d'extraits ni de modifications manuelles à faire à la main.
- Indiquer **systématiquement** le répertoire où déposer chaque fichier avec **FileZilla** (SFTP, utilisateur `root`, transfert en mode **binaire**) et la commande exacte pour l'exécuter.
- Après **toute installation ou mise à jour** : régénérer ce README dans `/opt/readme/README.md` (extrêmement détaillé, auto-suffisant, contenant tous les scripts) **et pousser le projet sur GitHub** (`serviceinformatique-droid/ndm-sante`). C'est fait automatiquement par `scripts/installer.sh`.
- Toutes les applications doivent **fonctionner en iframe** (aucun `X-Frame-Options`, CSP `frame-ancestors` réglable par `FRAME_ANCESTORS`).
- **100 % serveur, rien en cache navigateur** : en-têtes `Cache-Control: no-store` imposés par la passerelle sur toutes les réponses, ETag / Last-Modified supprimés.
- **100 % responsive** (téléphone, tablette, ordinateur).
- Environnement cible : **LXC Proxmox Debian 12**, **Docker + Docker Compose**, reverse-proxy **Nginx Proxy Manager** (NPM).
- Ne jamais coller de jeton GitHub ni de mot de passe dans une conversation. Le jeton est dans `/root/.github-token` (chmod 600).
- Pour reprendre le projet dans une nouvelle conversation : fournir ce README (et si besoin `README-CODE-COMPLET.md`).

## 1. Vue d'ensemble

NDM SANTÉ est la **fusion de 4 projets** de l'Ensemble Scolaire Notre-Dame des Missions en **une seule plateforme Docker**, installée en une commande par un **installateur tout-en-un** :

| Application | Projet d'origine (GitHub) | Rôle | Stack | Stockage |
|---|---|---|---|---|
| **Portail santé** (hub) | `sante-scolaire-app` | Page d'accueil avec menu latéral ; ouvre chaque application dans une **iframe** ; menus/sous-menus protégeables par mot de passe ; administration des menus | Node 22 + Express + EJS | PostgreSQL, base `portail` |
| **Fiche Sanitaire de Liaison** | `fichesanitaireclaude` | Dématérialisation du CERFA n°10008*02 pour les voyages : comptes parents / organisateurs / accompagnateurs / administration, signature, PDF archivés, messagerie interne, popups, relances e-mail, corbeille, sauvegardes horaires, fin d'année, RGPD | React 19 + Vite 6 + Tailwind 4 ; Express (CommonJS) | PostgreSQL, base `fichesanitaire` (clé/valeur JSONB) + PDF sur disque |
| **Fiche Infirmerie Numérique** | `fiche-infirmerie` | Fiche infirmerie annuelle : espace parents (question secrète), signature électronique, carnet de vaccinations obligatoire, PDF A4 officiel, tableau de bord infirmerie/direction, classes, personnalisation de l'établissement, **cahier des charges RGPD** intégré et modifiable, export Nextcloud WebDAV | React 19 + Vite 8 + Tailwind 4 ; Express (TypeScript → esbuild) | Fichiers chiffrés **AES-256** dans `donnees/infirmerie/` |
| **Suivi des Voyages Scolaires** | `orgavoyageV2` | Tableau de bord des inscriptions DocuSeal (multi-instances), doubles signatures, relances groupées, exports Excel/PDF, pièces jointes configurables voyage par voyage (CNI, AST, CEAM, passeport…) classées par voyage/classe, accès consultation/comptabilité, mots de passe par voyage, webhook, synchronisation automatique | React 19 + Vite 6 + Tailwind 4 ; Express (TypeScript → esbuild) | JSON dans `donnees/voyages/data/` + pièces jointes sur disque |

### 1.1 Architecture

```
                     Internet / réseau de l'établissement
                                   │
                 Nginx Proxy Manager (HTTPS, certificats Let's Encrypt)
                                   │  (ports « Forward » ci-dessous)
 ┌──────────────────────── LXC Debian 12 (Docker) ─────────────────────────┐
 │  ndm_passerelle (nginx 1.27) : no-store, iframe OK, 1 port / appli      │
 │    :8080 ──► ndm_portail        (Express/EJS, 3020)  ──┐                 │
 │    :8099 ──► ndm_fichesanitaire (Express, 3000)      ──┼──► ndm_postgres  │
 │    :3001 ──► ndm_infirmerie     (Express, 3001)        │   (PG 16 :       │
 │    :3000 ──► ndm_voyages        (Express, 3000)        │  fichesanitaire, │
 │                                                        │  portail)        │
 │  Volumes : /opt/ndm-sante/donnees/…  +  volume Docker ndm_pgdata          │
 └──────────────────────────────────────────────────────────────────────────┘
```

Chaque application garde **son propre backend** et sa propre origine (port ou sous-domaine) : leurs frontends appellent `/api/...` en chemin absolu, c'est pourquoi elles sont publiées **sur des ports / sous-domaines distincts** et non sous des sous-chemins. Le portail les affiche en iframe.

Les **ports d'origine** de chaque projet sont conservés (8080, 8099, 3001, 3000) : les « Proxy Hosts » existants de Nginx Proxy Manager peuvent simplement être redirigés vers l'IP du nouveau LXC.

## 2. Arborescence sur le serveur

```
/opt/ndm-sante/
├── VERSION                      # version de la plateforme fusionnée
├── .env                         # configuration + secrets (chmod 600, JAMAIS sur GitHub)
├── .env.example                 # modèle documenté
├── docker-compose.yml           # 6 services : postgres, portail, fichesanitaire, infirmerie, voyages, passerelle
├── installer-ndm-sante.sh       # copie de l'installateur tout-en-un (refabriqué par ndm.sh installateur)
├── apps/
│   ├── portail/                 # hub iframe (server.js, views/*.ejs, Dockerfile)
│   ├── fichesanitaire/          # React + server/index.js, server/auth.js, server/changelog.*
│   ├── infirmerie/              # React + server.ts, CAHIER_DES_CHARGES_RGPD*.md, docker-entrypoint.sh
│   └── voyages/                 # React + server.ts, server/{db,auth,attachments}.ts
├── passerelle/
│   ├── templates/default.conf.template   # 4 « server » nginx (un par port)
│   └── ndm-proxy.conf                    # en-têtes communs : no-store, iframe, X-Forwarded-*
├── postgres-init/01-bases.sh    # crée la base « portail » à la 1re initialisation
├── scripts/
│   ├── installer.sh             # installation / mise à jour idempotente (appelé par l'installateur)
│   ├── ndm.sh                   # outil d'exploitation (etat, logs, sauvegarde, restaurer, push…)
│   ├── generer-readme.sh        # génère /opt/readme/README.md + README-CODE-COMPLET.md
│   ├── push-github.sh           # push vers github.com/serviceinformatique-droid/ndm-sante
│   └── fabriquer-installateur.sh# refabrique installer-ndm-sante.sh depuis le code installé
├── installer/{header,footer}.sh # en-tête / pied de l'installateur tout-en-un
├── docs/
│   ├── DOCUMENTATION.md         # ce document (intégré au README)
│   ├── README-CODE-COMPLET.md   # tout le code source (généré)
│   └── origine/README-*.md      # documentation fonctionnelle détaillée des 4 projets d'origine
├── donnees/                     # DONNÉES (jamais écrasées, jamais sur GitHub)
│   ├── fichesanitaire/fiches-pdf/   # PDF archivés <Classe>/<NOM_Prenom>.pdf
│   ├── fichesanitaire/backups/      # extractions horaires automatiques de la base
│   ├── infirmerie/                  # fiches.enc, accounts.enc, .master_encryption.key, archives/, CAHIER_DES_CHARGES_RGPD.md…
│   ├── voyages/data/                # database.json, .session-secret…
│   ├── voyages/backups/
│   └── voyages/pieces-jointes/      # <Voyage>/<Classe>/NOM_Prenom_Piece.ext
├── sauvegardes/                 # ndm-AAAAMMJJ-HHMM.tgz (bases + donnees/ + copie du .env)
└── backups-installateur/        # code_AAAAMMJJ_HHMMSS.tgz (ancien code avant chaque mise à jour)

/opt/readme/README.md                # CE document (régénéré à chaque installation / mise à jour)
/opt/readme/README-CODE-COMPLET.md   # code source complet
/root/ndm-sante-identifiants.txt     # identifiants initiaux (chmod 600)
/root/.github-token                  # jeton GitHub (chmod 600)
/etc/cron.d/ndm-sante                # sauvegarde quotidienne 02:30
```

> ⚠️ **`donnees/infirmerie/.master_encryption.key`** est la clé de chiffrement des fiches infirmerie. Sans elle, les fichiers `*.enc` sont **illisibles**. Elle est incluse dans chaque sauvegarde `ndm.sh sauvegarde` : conservez ces sauvegardes en lieu sûr.

## 3. Installation (LXC neuf)

### 3.1 Préparer le LXC dans Proxmox
- Modèle **Debian 12**, 2 vCPU, **4 Go de RAM** minimum (la compilation des 3 frontends React en a besoin), 20 Go de disque.
- **Options > Fonctionnalités** : cocher **Imbrication (nesting)** et **keyctl** (indispensable pour Docker dans un LXC non privilégié). Redémarrer le CT.

### 3.2 Lancer l'installateur
1. **FileZilla** (SFTP, port 22, utilisateur `root`) : déposer `installer-ndm-sante.sh` dans **`/root/`** (mode de transfert **binaire**).
2. Console du LXC (root) :
   ```bash
   bash /root/installer-ndm-sante.sh
   ```
3. Durée : 5 à 10 minutes la première fois (installation de Docker + compilation).
4. À la fin : `cat /root/ndm-sante-identifiants.txt` pour les mots de passe générés.

Options (variables placées devant la commande) :
- `IP_PUBLIQUE=192.168.1.50 bash /root/installer-ndm-sante.sh` : IP utilisée pour les URL par défaut.
- `GITHUB_TOKEN=ghp_xxx bash /root/installer-ndm-sante.sh` : enregistre le jeton et pousse sur GitHub dès l'installation.
- `GITHUB_PUSH=0` : ne pas pousser ; `SANS_BUILD=1` : ne pas reconstruire les images.

Ce que fait l'installateur, dans l'ordre :
1. sauvegarde des données et archive de l'ancien code si une installation existe ;
2. écriture de tous les fichiers dans `/opt/ndm-sante` ;
3. `scripts/installer.sh` : paquets Debian, **Docker officiel + plugin compose**, `.env` (secrets aléatoires, variables manquantes ajoutées), dossiers `donnees/`, PostgreSQL + base `portail`, `docker compose up -d --build`, tests de santé des 4 applications, cron de sauvegarde, fichier d'identifiants, **README** dans `/opt/readme/`, **push GitHub**.

## 4. Mise à jour

- **Méthode standard** : déposer le nouvel `installer-ndm-sante.sh` dans `/root/` (FileZilla, en écrasant l'ancien) puis :
  ```bash
  bash /root/installer-ndm-sante.sh
  ```
  `.env`, `donnees/`, les bases PostgreSQL, `sauvegardes/` et `.git` sont **conservés** ; une sauvegarde complète est faite avant ; l'ancien code est archivé dans `backups-installateur/`.
- **Relancer l'installation sans nouveau fichier** : `bash /opt/ndm-sante/scripts/ndm.sh maj`
- **Après modification de `.env`** : `bash /opt/ndm-sante/scripts/ndm.sh redemarrer`
- **Revenir à l'ancien code** : `tar xzf /opt/ndm-sante/backups-installateur/code_<date>.tgz -C /opt/ndm-sante && bash /opt/ndm-sante/scripts/installer.sh`

## 5. Configuration réseau (Nginx Proxy Manager) et iframe

Créer un **Proxy Host** par application (Scheme `http`, Forward Hostname/IP = IP du LXC, cocher *Websockets Support* et *Block Common Exploits*, onglet SSL : *Request a new certificate*, *Force SSL*, *HTTP/2*) :

| Sous-domaine (exemple) | Forward Port | Variable `.env` à mettre à jour |
|---|---|---|
| `portail.ndmissions.fr` | `8080` | `URL_PORTAIL=https://portail.ndmissions.fr` |
| `fichesanitaire.ndmissions.fr` | `8099` | `URL_FICHESANITAIRE=https://fichesanitaire.ndmissions.fr` |
| `infirmerie.ndmissions.fr` | `3001` | `URL_INFIRMERIE=https://infirmerie.ndmissions.fr` |
| `voyages.ndmissions.fr` | `3000` | `URL_VOYAGES=https://voyages.ndmissions.fr` |

Puis : `nano /opt/ndm-sante/.env` (modifier les 4 `URL_*`) et `bash /opt/ndm-sante/scripts/ndm.sh redemarrer`. Les menus du portail sont alors mis à jour automatiquement.

**Règles iframe** :
- La passerelle supprime `X-Frame-Options` et impose `Content-Security-Policy: frame-ancestors <FRAME_ANCESTORS>` (défaut `*`). Pour restreindre : `FRAME_ANCESTORS=https://portail.ndmissions.fr https://ent.ndmissions.fr`.
- **Dans NPM, ne rien ajouter** dans « Advanced » qui renverrait `X-Frame-Options`.
- Si le portail est en **HTTPS**, les applications doivent l'être aussi (sinon « contenu mixte » bloqué par le navigateur).
- Le portail affiche un bouton **↗ Nouvel onglet** pour ouvrir l'application courante en plein écran (pratique sur téléphone).
- Session du portail : cookie `SameSite=None; Secure` automatiquement en HTTPS (fonctionne même si le portail est lui-même intégré dans un autre site), `Lax` en HTTP.

## 6. Zéro cache navigateur — « 100 % serveur »

- La passerelle (`passerelle/ndm-proxy.conf`) retire `Cache-Control`, `Expires`, `Pragma`, `ETag`, `Last-Modified` renvoyés par les applications et impose sur **toutes** les réponses : `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`. `etag off` et `if_modified_since off` : aucune revalidation possible, tout est retéléchargé du serveur.
- `proxy_buffering off`, `proxy_cache off` : aucun cache intermédiaire.
- Les pages HTML contiennent aussi les balises `<meta http-equiv="Cache-Control" …>`.
- Toutes les données sont stockées **sur le serveur** (PostgreSQL ou fichiers dans `donnees/`).
- Remarque honnête : par conception d'origine, certaines applications gardent des éléments **de session** côté navigateur : la Fiche Sanitaire copie les données **du compte connecté** dans le stockage local pendant la session (effacé à la déconnexion) et le Suivi des Voyages garde son jeton de session dans `sessionStorage`. Aucune donnée n'y est la source de vérité : le serveur fait foi.

## 7. Responsive (téléphone)

- Portail : menu latéral escamotable (☰) sous 768 px, cibles tactiles agrandies, hauteur `100dvh` (barre d'adresse mobile), champs en 16 px (pas de zoom iOS), boutons réduits à leur icône, bouton « Nouvel onglet ».
- Administration du portail : grille sur une colonne, actions des menus repliées sous 700 px.
- Fiche Sanitaire, Infirmerie, Voyages : interfaces Tailwind CSS responsive d'origine (grilles `sm:/md:/lg:`), vérifiées à 375 px. Correctif de la fusion : en-tête du Suivi des Voyages compacté sur téléphone (`apps/voyages/src/components/Header.tsx` : logo réduit, bandeau établissement masqué, libellés courts « Accès / Admin / Compta »).

## 8. Comptes et mots de passe

Tous les mots de passe initiaux sont générés aléatoirement à la 1re installation et écrits dans `/root/ndm-sante-identifiants.txt` (chmod 600) et `/opt/ndm-sante/.env`.

| Application | Compte | Où le changer |
|---|---|---|
| Portail — administration (`/admin`) | mot de passe `PORTAIL_ADMIN_PASSWORD` (utilisé uniquement tant qu'aucun mot de passe n'est enregistré en base) | `/admin` > Configuration du portail |
| Portail — menu « Fiche d'inscription » | `PORTAIL_MENU_PASSWORD` | `/admin` > ✏️ sur le menu |
| Fiche Sanitaire | `administrateur@portail.local` / `FICHESANITAIRE_ADMIN_PASSWORD` (créé seulement si aucun administrateur n'existe) | Administration > Comptes & Rôles |
| Fiche Infirmerie | `admin` et `infirmerie` / `INFIRMERIE_STAFF_PASSWORD` (mot de passe **initial**, appliqué seulement à la création des comptes ; sur une installation reprise, les mots de passe existants sont conservés). Un avertissement s'affiche tant que le mot de passe initial n'a pas été changé | Tableau de bord > bouton « Mot de passe » |
| Suivi des voyages | administrateur : `VOYAGES_ADMIN_PASSWORD` (mot de passe **initial** depuis la v1.2.0 : il n'est plus accepté une fois un autre mot de passe enregistré) ; consultation : `VOYAGES_CONSULTATION_PASSWORD` | Administration de l'application |

**Toutes ces valeurs se changent aussi depuis un seul endroit : Portail > Admin > 🔐 Gestion centralisée** (section 8bis).

### 8bis. Gestion centralisée (v1.2.0) — `URL_PORTAIL/admin/centrale`

Accès : se connecter à `/admin` du portail, bouton **🔐 Gestion centralisée**.

**Nom de l'établissement** : la page affiche le nom actuellement utilisé par chaque application (pastille « à jour » / « différent » / « injoignable »). « Appliquer partout » enregistre le nom dans le portail (`portail_config.etablissement`) et le pousse à :
- Fiche Sanitaire : clé `cerfa_establishment_name_v1` (fiches, PDF, liste des inscrits, e-mails de relance `{etablissement}`) ;
- Fiche Infirmerie : `branding.schoolName` (en-tête, PDF A4 ; logo et sous-titre conservés) ;
- Suivi des Voyages : réglage `etablissementNom` (en-tête, pied de page, valeur par défaut des nouveaux voyages) et champ `etablissement` des voyages existants qui portaient l'ancien nom ou le nom par défaut ;
- Portail : titre « Portail de santé – nom » si la case est cochée.
Le nom initial vient de `ETABLISSEMENT_NOM` dans `.env`.

**Mots de passe** : un onglet par application, recherche instantanée, bouton « Changer le mot de passe » sur chaque compte, générateur de mot de passe robuste (14 caractères), indicateur de robustesse, copie. Minimum 8 caractères. Comptes gérés :

| Application | Comptes | Effet |
|---|---|---|
| Portail | administration `/admin` ; chaque menu protégé | empreinte bcrypt en base `portail` |
| Fiche Sanitaire | tous les comptes (administration, organisateurs, familles) ; mot de passe accompagnateurs de chaque voyage | empreinte scrypt via `POST /api/users/upsert` ; `chaperonePassword` du voyage |
| Fiche Infirmerie | personnel `admin` / `infirmerie` ; chaque parent | empreinte PBKDF2 ; **sessions ouvertes du compte fermées** ; réponse secrète des parents conservée |
| Suivi des Voyages | administrateur ; consultation / comptabilité ; mot de passe professeur de chaque voyage | empreinte scrypt (admin) |

**Journal d'audit** : chaque connexion à l'administration, chaque changement de nom ou de mot de passe (réussi ou non) est inscrit dans la table `portail_audit` (date, adresse IP, action — **jamais le mot de passe**), conservé 2 ans, 60 dernières lignes affichées.

**Fonctionnement technique** : le portail appelle les applications par le **réseau Docker interne** (`http://fichesanitaire:3000`, `http://infirmerie:3001`, `http://voyages:3000`) avec le secret partagé `NDM_INTERNAL_SECRET` (48 caractères, généré dans `.env`) :
- en-tête `X-Ndm-Internal` pour l'Infirmerie (routes `/api/internal/accounts`, `/api/internal/set-password`, `POST /api/branding`) et le Suivi des Voyages (routes `/api/internal/set-admin-password`, `/api/internal/etablissement`, routes d'administration existantes) ;
- en-tête `X-Local-Tool` (mécanisme « outil système » d'origine) pour la Fiche Sanitaire, dont `LOCAL_TOOL_SECRET` = `NDM_INTERNAL_SECRET`.
La **passerelle nginx supprime ces deux en-têtes** de toute requête venant de l'extérieur (`proxy_set_header X-Ndm-Internal ""`) : seul le portail, à l'intérieur du réseau Docker, peut les utiliser. Comparaison à temps constant, secret de 24 caractères minimum exigé.

**Sécurité de l'administration du portail** : 5 échecs de connexion par adresse IP ⇒ blocage 15 min ; session régénérée à la connexion (anti-fixation). La console centrale donne la main sur tous les comptes : choisir un mot de passe administrateur du portail long et unique.

Mot de passe administrateur du portail perdu :
```bash
docker exec -it ndm_postgres psql -U ndm -d portail -c "DELETE FROM portail_config WHERE cle='mdp_admin_hash'"
bash /opt/ndm-sante/scripts/ndm.sh redemarrer portail   # PORTAIL_ADMIN_PASSWORD du .env redevient valable
```

## 9. Exploitation : `ndm.sh`

```bash
bash /opt/ndm-sante/scripts/ndm.sh aide
bash /opt/ndm-sante/scripts/ndm.sh etat                 # conteneurs + test des 4 applications
bash /opt/ndm-sante/scripts/ndm.sh urls
bash /opt/ndm-sante/scripts/ndm.sh identifiants
bash /opt/ndm-sante/scripts/ndm.sh logs fichesanitaire 200
bash /opt/ndm-sante/scripts/ndm.sh suivre voyages
bash /opt/ndm-sante/scripts/ndm.sh redemarrer [service]
bash /opt/ndm-sante/scripts/ndm.sh reconstruire [service]
bash /opt/ndm-sante/scripts/ndm.sh sauvegarde
bash /opt/ndm-sante/scripts/ndm.sh sauvegardes
bash /opt/ndm-sante/scripts/ndm.sh restaurer /opt/ndm-sante/sauvegardes/ndm-AAAAMMJJ-HHMM.tgz
bash /opt/ndm-sante/scripts/ndm.sh psql portail
bash /opt/ndm-sante/scripts/ndm.sh readme
bash /opt/ndm-sante/scripts/ndm.sh push "message"
bash /opt/ndm-sante/scripts/ndm.sh installateur
bash /opt/ndm-sante/scripts/ndm.sh maj
```

Noms des conteneurs : `ndm_postgres`, `ndm_portail`, `ndm_fichesanitaire`, `ndm_infirmerie`, `ndm_voyages`, `ndm_passerelle`.

## 10. Sauvegardes et restauration

- **Automatique** : chaque nuit à 02:30 (`/etc/cron.d/ndm-sante`), journal `/var/log/ndm-sante-sauvegarde.log`, rétention `SAUVEGARDE_RETENTION_JOURS` (14 j).
- Contenu d'une archive `sauvegardes/ndm-AAAAMMJJ-HHMM.tgz` : `fichesanitaire.dump` et `portail.dump` (pg_dump format custom), tout le dossier `donnees/` (PDF, fichiers infirmerie chiffrés + **clé**, données voyages, pièces jointes), `env.sauvegarde` (copie du `.env`).
- En plus : la Fiche Sanitaire fait sa propre extraction **horaire** (`donnees/fichesanitaire/backups/`, 14 jours) et Proxmox peut sauvegarder le CT entier.
- **Restaurer** : `bash /opt/ndm-sante/scripts/ndm.sh restaurer <archive>` (confirmation `OUI`, sauvegarde de sécurité préalable automatique).
- **Copier une sauvegarde hors du serveur** : FileZilla, dossier `/opt/ndm-sante/sauvegardes/`.

## 11. Reprise des données des anciennes installations séparées

À faire une seule fois, après l'installation de NDM SANTÉ (adapter les chemins si besoin). Copier les fichiers d'un LXC à l'autre avec FileZilla ou `scp`.

**Fiche Sanitaire** (ancien LXC, dossier `/opt/fichesanitaire-voyages`) :
```bash
# Ancien LXC
docker exec fichesanitaire_db pg_dump -U fichesanitaire -Fc fichesanitaire > /root/fichesanitaire.dump
tar czf /root/fiches-pdf.tgz -C /opt/fichesanitaire-voyages fiches-pdf
# Nouveau LXC (fichiers déposés dans /root/)
cd /opt/ndm-sante && docker compose stop fichesanitaire
docker compose exec -T postgres pg_restore -U ndm -d fichesanitaire --clean --if-exists --no-owner < /root/fichesanitaire.dump
tar xzf /root/fiches-pdf.tgz -C /opt/ndm-sante/donnees/fichesanitaire/
docker compose up -d fichesanitaire
```

**Fiche Infirmerie** (ancien dossier `/opt/infirmerie/data`) — la clé `.master_encryption.key` est indispensable :
```bash
# Ancien LXC
tar czf /root/infirmerie-data.tgz -C /opt/infirmerie data
# Nouveau LXC
cd /opt/ndm-sante && docker compose stop infirmerie
tar xzf /root/infirmerie-data.tgz -C /tmp && rsync -a /tmp/data/ /opt/ndm-sante/donnees/infirmerie/
docker compose up -d infirmerie
```

**Suivi des Voyages** (ancien dossier `/opt/portail-voyages`) :
```bash
# Ancien LXC
tar czf /root/voyages.tgz -C /opt/portail-voyages app/data pieces-jointes
# Nouveau LXC
cd /opt/ndm-sante && docker compose stop voyages
tar xzf /root/voyages.tgz -C /tmp
rsync -a /tmp/app/data/ /opt/ndm-sante/donnees/voyages/data/
rsync -a /tmp/pieces-jointes/ /opt/ndm-sante/donnees/voyages/pieces-jointes/
docker compose up -d voyages
```

**Portail** (ancienne base `portail_ndm`) :
```bash
# Ancien LXC
docker exec portail_postgres pg_dump -U portail_user -Fc portail_ndm > /root/portail.dump
# Nouveau LXC
cd /opt/ndm-sante && docker compose stop portail
docker compose exec -T postgres pg_restore -U ndm -d portail --clean --if-exists --no-owner < /root/portail.dump
docker compose up -d portail   # la colonne « code » est ajoutée automatiquement
```

## 12. Le portail (hub) en détail

- Tables PostgreSQL (base `portail`, créées automatiquement au démarrage) :
  - `portail_menus(id uuid, parent_id, titre, icone, url, ordre, protege, mot_de_passe_hash, actif, created_at, code)` — 3 niveaux (menu > sous-menu > groupe d'éléments). `code` ∈ {`fichesanitaire`, `infirmerie`, `voyages`} pour les menus « système » dont l'URL est réappliquée depuis `.env` à chaque démarrage.
  - `portail_config(cle, valeur)` : `titre`, `logo_url`, `mdp_admin_hash`.
  - `portail_session` : sessions (connect-pg-simple), 8 h.
- Menus créés sur une base vide : 🗺️ Séjour scolaire > ✍️ Fiche d'inscription 🔒 (Voyage en Auvergne / Espagne / Angleterre → DocuSeal), 📝 Fiche Sanitaire, 🧳 Suivi des voyages ; 🏥 Fiche Infirmerie.
- Un groupe protégé protège aussi ses éléments (correctif de la fusion). La protection par mot de passe est une protection **d'accès au menu** (les applications ont chacune leur propre authentification).
- Routes : `GET /` (portail), `GET /health`, `POST /menu/auth`, `GET /login|/logout` (re-verrouille les menus), `GET|POST /admin/login`, `GET /admin/logout`, `GET /admin`, `POST /admin/menus`, `POST /admin/menus/:id/modifier`, `POST /admin/menus/:id/supprimer` (désactivation récursive), `POST /admin/menus/deplacer` (↑/↓), `POST /admin/config`.

## 13. Les trois applications (résumé — détails complets dans `docs/origine/`)

### 13.1 Fiche Sanitaire de Liaison (`apps/fichesanitaire`)
- Rôles : administration, organisateur (professeur, plusieurs voyages possibles), accompagnateur (mot de passe de voyage), famille (parent). Authentification serveur (`server/auth.js`) : sessions, verrouillage après échecs, liens directs `?ficheToken=` (30 jours).
- CERFA 10008*02 en 5 rubriques, signature, pièces jointes compressées, validation de complétude, filigrane BROUILLON, PDF vectoriel (jsPDF) **archivé sur le serveur** dans `donnees/fichesanitaire/fiches-pdf/<Classe>/<NOM_Prenom>.pdf`.
- Anti-écrasement (versions + verrous), anti-doublons, rattachement parent obligatoire, corbeille (30 j), messagerie interne + popups + message d'accueil, relances e-mail (SMTP) hebdomadaires et manuelles, journal des mises à jour, procédure de fin d'année, panneau RGPD, sauvegarde horaire.
- API principale : `/api/data`, `/api/students/*`, `/api/users/*`, `/api/magic-link/*`, `/api/reminders/*`, `/api/backups`, `/api/messages/*`, `/api/popups/*`, `/api/changelog`, `/health`.
- Lire impérativement la section 8 de `docs/origine/README-fichesanitaire.md` (incidents et protections anti-perte de données) avant toute modification.

### 13.2 Fiche Infirmerie Numérique (`apps/infirmerie`)
- Espace parents (inscription, question secrète, mot de passe oublié), formulaire élève + santé + autorisations, signature, dépôt obligatoire du carnet de vaccinations, aperçu et PDF A4 officiel, confirmation.
- Tableau de bord (comptes `admin` / `infirmerie`) : fiches, classes, changement de classe, personnalisation (logo, nom), Nextcloud WebDAV, **conformité RGPD** avec **cahier des charges RGPD** éditable (`CAHIER_DES_CHARGES_RGPD.md`, modèle `…_DEFAULT.md`) et export PDF. La version modifiée est conservée dans `donnees/infirmerie/` (lien créé par `docker-entrypoint.sh`).
- Données chiffrées AES-256 (`fiches.enc`, `accounts.enc`, `drafts/<compte>.enc`) avec la clé `donnees/infirmerie/.master_encryption.key`.

### 13.3 Suivi des Voyages Scolaires (`apps/voyages`)
- Connexion à une ou plusieurs instances **DocuSeal** (clé API par instance), import des soumissions, doubles signatures (2 responsables légaux), relances groupées, détails élève, exports Excel (xlsx) et PDF (jspdf-autotable), journal de synchronisation.
- Pièces jointes configurables voyage par voyage, récupérées depuis DocuSeal et rangées dans `donnees/voyages/pieces-jointes/<Voyage>/<Classe>/NOM_Prenom_Piece.ext`, ZIP par classe.
- Accès : administrateur (`ADMIN_PASSWORD`), consultation/comptabilité, mot de passe par voyage pour les professeurs ; jetons signés (`SESSION_SECRET`), durée `SESSION_TTL_HOURS`.
- Webhook DocuSeal : `POST <URL_VOYAGES>/api/webhooks/docuseal/<voyageId>` avec `WEBHOOK_SECRET` (en-tête `X-Webhook-Secret` ou `?secret=`). Synchronisation automatique toutes les `AUTO_SYNC_MINUTES`.

## 14. Variables `.env`

Voir `.env.example` (reproduit dans la section Scripts) : chaque variable y est commentée. Les variables manquantes sont ajoutées automatiquement à chaque passage de l'installateur, sans toucher aux valeurs existantes.

## 15. GitHub

- Dépôt : `https://github.com/serviceinformatique-droid/ndm-sante` (privé, créé automatiquement au 1er push).
- 1re configuration : `bash /opt/ndm-sante/scripts/push-github.sh` (demande le jeton PAT classic, case `repo`), ou `GITHUB_TOKEN=ghp_xxx bash /opt/ndm-sante/scripts/push-github.sh`. Le jeton est enregistré dans `/root/.github-token`.
- Ensuite, **chaque installation / mise à jour pousse automatiquement** le code + `README.md` + `docs/README-CODE-COMPLET.md`.
- Jamais envoyés : `.env`, `donnees/`, `sauvegardes/`, `backups-installateur/`, `node_modules/`, `dist/`, l'installateur.
- **Réinstaller depuis GitHub** sur un LXC neuf (Docker déjà installé ou non) :
  ```bash
  apt-get update && apt-get install -y git
  git clone https://github.com/serviceinformatique-droid/ndm-sante.git /opt/ndm-sante   # demande le jeton (dépôt privé)
  bash /opt/ndm-sante/scripts/installer.sh
  ```

## 16. Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| `Docker ne démarre pas` dans un LXC | Activer *nesting* + *keyctl* dans Proxmox, redémarrer le CT |
| Une application ne répond pas après installation | `bash /opt/ndm-sante/scripts/ndm.sh logs <service> 200` ; `ndm.sh reconstruire <service>` |
| Iframe vide « refused to connect » | Un en-tête `X-Frame-Options` est ajouté par NPM (onglet Advanced) ou `FRAME_ANCESTORS` trop restrictif |
| Iframe vide sans erreur, portail en HTTPS | URL de l'application en HTTP → « contenu mixte » : passer les `URL_*` en HTTPS |
| Gestion centralisée : une application « injoignable » | `bash /opt/ndm-sante/scripts/ndm.sh etat` ; vérifier que `NDM_INTERNAL_SECRET` existe dans `.env` (sinon relancer l'installateur) puis `ndm.sh redemarrer` |
| Menu du portail pointe vers une ancienne adresse | Modifier `URL_*` dans `.env` puis `ndm.sh redemarrer` |
| `bad interpreter` / `$'\r'` | Fichier transféré en mode texte depuis Windows : l'installateur se corrige seul ; pour les autres : `sed -i 's/\r$//' fichier.sh` |
| Compilation tuée (`Killed`) | RAM insuffisante : passer le CT à 4 Go |
| Port déjà utilisé | Changer `PORT_*` dans `.env` puis `ndm.sh redemarrer` |
| Erreur `relation … does not exist` (portail) | `ndm.sh redemarrer portail` (la migration s'exécute au démarrage) |

## 17. Points de vigilance (sécurité / RGPD)

- **Fiche Infirmerie — sécurisée (v1.1.0, build `securite-20261011`)** :
  - **Authentification serveur obligatoire** : la connexion (parent ou personnel) délivre un jeton de session aléatoire (256 bits, mémoire serveur, 8 h glissantes, `SESSION_TTL_HOURS`), envoyé par l'application dans les en-têtes `X-Staff-Token` / `X-Parent-Token` et gardé **en mémoire du navigateur uniquement** (rien dans localStorage/cookies : recharger la page = se reconnecter). Un redémarrage du conteneur ferme toutes les sessions.
  - **Refus par défaut** : toute route `/api` est réservée au personnel, sauf la liste blanche publique (`GET /api/branding`, `GET /api/classes`, `GET /api/auth/status`, `GET /api/rgpd/cahier-des-charges`, routes de connexion / inscription / mot de passe oublié / déconnexion) et les routes parent (`POST /api/fiches`, `GET|POST|DELETE /api/draft`). Sans jeton valide : `401 {"code":"auth-required"}`.
  - **Mot de passe codé en dur supprimé** : `infirmerie2026!` n'est plus accepté en dehors de l'empreinte enregistrée. Le mot de passe initial des comptes vient de `INFIRMERIE_STAFF_PASSWORD`. Un compte ne peut changer que son propre mot de passe (la direction `admin` peut changer les deux).
  - **Anti force brute** : 5 échecs (connexion personnel, connexion parent, réponse secrète) par adresse IP ⇒ blocage 15 min (`429`).
  - **Brouillons par compte** : chaque parent a son propre brouillon chiffré (`donnees/infirmerie/drafts/<empreinte>.enc`) chargé seulement après sa connexion ; l'ancien brouillon unique, visible par tout visiteur, est supprimé au démarrage. À la déconnexion, le formulaire est vidé.
  - **Fiches rattachées au parent** (`parentId`, `parentEmail`) : un parent ne peut pas écraser la fiche d'un autre (`403`).
  - **Téléchargements** : chemin vérifié par résolution absolue (anti `../`), lien de téléchargement portant le jeton du personnel (`?token=`, accepté uniquement sur `/api/download-file`).
  - Correctif annexe : la route RGPD en double qui renvoyait un fichier au lieu du JSON attendu par l'écran « Conformité RGPD » a été retirée.
  - Test rapide après installation : `curl -s http://127.0.0.1:3001/api/fiches` doit répondre `401`.
- **Gestion centralisée (v1.2.0)** : le secret `NDM_INTERNAL_SECRET` donne les droits d'administration sur les 4 applications : il ne doit jamais sortir du serveur (il est dans `.env`, chmod 600, exclu de GitHub). En cas de doute : remplacer sa valeur dans `.env` puis `bash /opt/ndm-sante/scripts/ndm.sh redemarrer`.
- Suivi des Voyages : `ADMIN_PASSWORD` du `.env` n'est plus un mot de passe « toujours valable » ; il initialise seulement le compte.
- La protection des menus du portail n'est qu'un verrou d'affichage : les URL restent accessibles directement. Chaque application assure sa propre authentification.
- Les données de santé ne quittent jamais le serveur (exclues de git, sauvegardes en chmod 600).

## A. État de l'installation (au 11/10/2026 à 18:32)

### A.1 Système
```text
Hôte        : portailsante  —  IP : 172.17.0.1 172.18.0.1 192.168.1.105 2a01:e0a:de3:8e40:1266:6aff:fe34:5ae6
OS          : Debian GNU/Linux 12 (bookworm)  —  noyau 7.0.2-6-pve
Virtualisation : lxc
Docker      : Docker version 29.9.0, build f415da8
Compose     : Docker Compose version v5.6.0
Disque      : 11G utilisés / 98G (12%)
Mémoire     : 9.4Gi / 15Gi
```

### A.2 Conteneurs
```text
NAME                 IMAGE                             COMMAND                  SERVICE          CREATED             STATUS                       PORTS
ndm_fichesanitaire   ndm-sante/fichesanitaire:latest   "docker-entrypoint.s…"   fichesanitaire   33 minutes ago      Up 33 minutes (healthy)      3000/tcp
ndm_infirmerie       ndm-sante/infirmerie:latest       "/usr/local/bin/dock…"   infirmerie       33 minutes ago      Up 33 minutes (healthy)      3001/tcp
ndm_passerelle       nginx:1.27-alpine                 "/docker-entrypoint.…"   passerelle       About an hour ago   Up About an hour             0.0.0.0:3000-3001->3000-3001/tcp, [::]:3000-3001->3000-3001/tcp, 0.0.0.0:8080->8080/tcp, [::]:8080->8080/tcp, 80/tcp, 0.0.0.0:8099->8099/tcp, [::]:8099->8099/tcp
ndm_portail          ndm-sante/portail:latest          "docker-entrypoint.s…"   portail          33 minutes ago      Up 33 minutes (healthy)      3020/tcp
ndm_postgres         postgres:16-alpine                "docker-entrypoint.s…"   postgres         About an hour ago   Up About an hour (healthy)   5432/tcp
ndm_voyages          ndm-sante/voyages:latest          "docker-entrypoint.s…"   voyages          33 minutes ago      Up 33 minutes (healthy)      3000/tcp
```

### A.3 Tests de santé
```text
OK      Portail           http://127.0.0.1:8080/health
OK      Fiche Sanitaire   http://127.0.0.1:8099/health
OK      Fiche Infirmerie  http://127.0.0.1:3001/api/classes
OK      Suivi Voyages     http://127.0.0.1:3000/api/health
```

### A.4 Images Docker
```text
ndm-sante/voyages:latest  743MB  33 minutes ago
ndm-sante/infirmerie:latest  1GB  33 minutes ago
ndm-sante/portail:latest  344MB  34 minutes ago
ndm-sante/fichesanitaire:latest  217MB  About an hour ago
postgres:16-alpine  420MB  3 weeks ago
nginx:1.27-alpine  74.5MB  18 months ago
```

### A.5 Configuration `.env` (secrets masqués)
```ini
TZ=Europe/Paris
FRAME_ANCESTORS=*
PORT_PORTAIL=8080
PORT_FICHESANITAIRE=8099
PORT_INFIRMERIE=3001
PORT_VOYAGES=3000
URL_PORTAIL=http://172.17.0.1:8080
URL_FICHESANITAIRE=http://172.17.0.1:8099
URL_INFIRMERIE=http://172.17.0.1:3001
URL_VOYAGES=http://172.17.0.1:3000
DB_PASSWORD=******** (masqué)
SESSION_SECRET=******** (masqué)
PORTAIL_ADMIN_PASSWORD=******** (masqué)
PORTAIL_MENU_PASSWORD=******** (masqué)
FICHESANITAIRE_ADMIN_PASSWORD=******** (masqué)
VOYAGES_ADMIN_PASSWORD=******** (masqué)
INFIRMERIE_STAFF_PASSWORD=******** (masqué)
VOYAGES_CONSULTATION_PASSWORD=******** (masqué)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=fichesanitaire@ndmissions.fr
CRON_SCHEDULE=0 8 * * 1
TRASH_RETENTION_DAYS=30
BACKUP_RETENTION_HOURS=336
NEXTCLOUD_URL=
NEXTCLOUD_USERNAME=
NEXTCLOUD_PASSWORD=
NEXTCLOUD_ROOT_FOLDER=FICHES INFIRMERIE
SESSION_TTL_HOURS=12
WEBHOOK_SECRET=
ALLOW_INSECURE_TLS=false
PIECES_PAR_VOYAGE=true
PIECES_TAILLE_MAX_MO=30
AUTO_SYNC_MINUTES=15
SAUVEGARDE_RETENTION_JOURS=14
GITHUB_USER=serviceinformatique-droid
GITHUB_REPO=ndm-sante
NDM_INTERNAL_SECRET=******** (masqué)
ETABLISSEMENT_NOM=Ensemble Scolaire Notre-Dame des Missions
```

### A.6 Volumes de données
```text
20K	donnees/fichesanitaire
100K	donnees/infirmerie
20K	donnees/voyages
Volume PostgreSQL : /var/lib/docker/volumes/ndm-sante_ndm_pgdata/_data
```

### A.7 Dernières sauvegardes
```text
-rw------- 1 root root 14K Oct 11 17:57 sauvegardes/ndm-20261011-1757.tgz
```

### A.8 Git
```text
Pas encore de dépôt git (1er push : bash /opt/ndm-sante/scripts/push-github.sh)
```

## B. Scripts et fichiers d'infrastructure (contenu complet)

**Extraire tous les scripts de ce document** (dans un dossier vide contenant `README.md`) :

```bash
for n in $(grep -o "^<!-- SCRIPT-START:[^ ]* -->" README.md | sed "s/.*START:\(.*\) -->/\1/"); do
  mkdir -p "$(dirname "$n")"
  sed -n "/^<!-- SCRIPT-START:${n//\//\\/} -->\$/,/^<!-- SCRIPT-END:${n//\//\\/} -->\$/p" README.md | sed "1,2d" | head -n -2 > "$n"
done; find . -name "*.sh" -exec chmod +x {} \;
```

Ces fichiers + le code des applications (`README-CODE-COMPLET.md`) permettent de reconstruire `/opt/ndm-sante` à l'identique ; le plus simple reste l'installateur tout-en-un (`bash /opt/ndm-sante/scripts/ndm.sh installateur` le refabrique).

### `scripts/installer.sh`

<!-- SCRIPT-START:scripts/installer.sh -->
```bash
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
```
<!-- SCRIPT-END:scripts/installer.sh -->

### `scripts/ndm.sh`

<!-- SCRIPT-START:scripts/ndm.sh -->
```bash
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
```
<!-- SCRIPT-END:scripts/ndm.sh -->

### `scripts/push-github.sh`

<!-- SCRIPT-START:scripts/push-github.sh -->
```bash
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
```
<!-- SCRIPT-END:scripts/push-github.sh -->

### `scripts/generer-readme.sh`

<!-- SCRIPT-START:scripts/generer-readme.sh -->
````bash
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
         apps/voyages/Dockerfile apps/portail/server.js apps/portail/centrale.js apps/portail/package.json \
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
````
<!-- SCRIPT-END:scripts/generer-readme.sh -->

### `scripts/fabriquer-installateur.sh`

<!-- SCRIPT-START:scripts/fabriquer-installateur.sh -->
```bash
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
```
<!-- SCRIPT-END:scripts/fabriquer-installateur.sh -->

### `installer/header.sh`

<!-- SCRIPT-START:installer/header.sh -->
```bash
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
```
<!-- SCRIPT-END:installer/header.sh -->

### `installer/footer.sh`

<!-- SCRIPT-START:installer/footer.sh -->
```bash
echo "✓ __COUNT__ fichiers écrits dans $BASE_DIR"
SELF="$(readlink -f "$0" 2>/dev/null || echo "$0")"
if [ -f "$SELF" ] && [ "$SELF" != "$BASE_DIR/installer-ndm-sante.sh" ]; then
  cp -f "$SELF" "$BASE_DIR/installer-ndm-sante.sh"
  chmod 700 "$BASE_DIR/installer-ndm-sante.sh"
fi
chmod +x "$BASE_DIR"/scripts/*.sh "$BASE_DIR"/postgres-init/*.sh "$BASE_DIR"/apps/infirmerie/docker-entrypoint.sh
echo "==> Lancement de scripts/installer.sh"
exec bash "$BASE_DIR/scripts/installer.sh"
```
<!-- SCRIPT-END:installer/footer.sh -->

### `docker-compose.yml`

<!-- SCRIPT-START:docker-compose.yml -->
```yaml
# ============================================================================
#  NDM SANTÉ — plateforme fusionnée (4 projets) — /opt/ndm-sante/docker-compose.yml
#  Portail (hub iframe) + Fiche Sanitaire + Fiche Infirmerie + Suivi des Voyages
#  Toutes les valeurs viennent de /opt/ndm-sante/.env (créé par l'installateur)
#  Commandes : bash /opt/ndm-sante/scripts/ndm.sh etat|logs|redemarrer|maj|...
# ============================================================================
name: ndm-sante

services:
  # --- Base PostgreSQL commune (bases : fichesanitaire + portail) -------------
  postgres:
    image: postgres:16-alpine
    container_name: ndm_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ndm
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: fichesanitaire
      TZ: ${TZ:-Europe/Paris}
    volumes:
      - ndm_pgdata:/var/lib/postgresql/data
      - ./postgres-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ndm -d fichesanitaire && psql -U ndm -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='portail'\" | grep -q 1"]
      interval: 5s
      timeout: 5s
      retries: 30
    networks: [ndm_net]

  # --- Portail (hub : menus + iframe) ----------------------------------------
  portail:
    build: ./apps/portail
    image: ndm-sante/portail:latest
    container_name: ndm_portail
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      PORT: 3020
      TZ: ${TZ:-Europe/Paris}
      DATABASE_URL: postgresql://ndm:${DB_PASSWORD}@postgres:5432/portail
      SESSION_SECRET: ${SESSION_SECRET}
      PORTAIL_ADMIN_PASSWORD: ${PORTAIL_ADMIN_PASSWORD}
      PORTAIL_MENU_PASSWORD: ${PORTAIL_MENU_PASSWORD}
      URL_FICHESANITAIRE: ${URL_FICHESANITAIRE}
      URL_INFIRMERIE: ${URL_INFIRMERIE}
      URL_VOYAGES: ${URL_VOYAGES}
      FRAME_ANCESTORS: ${FRAME_ANCESTORS:-*}
      NDM_INTERNAL_SECRET: ${NDM_INTERNAL_SECRET}
      ETABLISSEMENT_NOM: ${ETABLISSEMENT_NOM:-Ensemble Scolaire Notre-Dame des Missions}
    networks: [ndm_net]

  # --- Fiche Sanitaire de Liaison (CERFA 10008*02) ---------------------------
  fichesanitaire:
    build: ./apps/fichesanitaire
    image: ndm-sante/fichesanitaire:latest
    container_name: ndm_fichesanitaire
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      PORT: 3000
      TZ: ${TZ:-Europe/Paris}
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: ndm
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: fichesanitaire
      INITIAL_ADMIN_PASSWORD: ${FICHESANITAIRE_ADMIN_PASSWORD}
      LOCAL_TOOL_SECRET: ${NDM_INTERNAL_SECRET}
      SMTP_HOST: ${SMTP_HOST:-}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_SECURE: ${SMTP_SECURE:-false}
      SMTP_USER: ${SMTP_USER:-}
      SMTP_PASSWORD: ${SMTP_PASSWORD:-}
      SMTP_FROM: ${SMTP_FROM:-}
      PORTAL_URL: ${URL_FICHESANITAIRE}
      CRON_SCHEDULE: ${CRON_SCHEDULE:-0 8 * * 1}
      CRON_TIMEZONE: ${TZ:-Europe/Paris}
      TRASH_RETENTION_DAYS: ${TRASH_RETENTION_DAYS:-30}
      BACKUP_RETENTION_HOURS: ${BACKUP_RETENTION_HOURS:-336}
      PDF_ARCHIVE_DIR: /app/fiches-pdf
      BACKUP_DIR: /app/backups
    volumes:
      - ./donnees/fichesanitaire/fiches-pdf:/app/fiches-pdf
      - ./donnees/fichesanitaire/backups:/app/backups
    networks: [ndm_net]

  # --- Fiche Infirmerie Numérique (données chiffrées AES-256 sur disque) ------
  infirmerie:
    build: ./apps/infirmerie
    image: ndm-sante/infirmerie:latest
    container_name: ndm_infirmerie
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3001
      TZ: ${TZ:-Europe/Paris}
      INFIRMERIE_STAFF_PASSWORD: ${INFIRMERIE_STAFF_PASSWORD}
      NDM_INTERNAL_SECRET: ${NDM_INTERNAL_SECRET}
      SESSION_TTL_HOURS: 8
      NEXTCLOUD_URL: ${NEXTCLOUD_URL:-}
      NEXTCLOUD_USERNAME: ${NEXTCLOUD_USERNAME:-}
      NEXTCLOUD_PASSWORD: ${NEXTCLOUD_PASSWORD:-}
      NEXTCLOUD_ROOT_FOLDER: ${NEXTCLOUD_ROOT_FOLDER:-FICHES INFIRMERIE}
    volumes:
      - ./donnees/infirmerie:/app/data
    networks: [ndm_net]

  # --- Suivi des Voyages Scolaires (DocuSeal, pièces jointes) ---------------
  voyages:
    build: ./apps/voyages
    image: ndm-sante/voyages:latest
    container_name: ndm_voyages
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      TZ: ${TZ:-Europe/Paris}
      ADMIN_PASSWORD: ${VOYAGES_ADMIN_PASSWORD}
      NDM_INTERNAL_SECRET: ${NDM_INTERNAL_SECRET}
      CONSULTATION_PASSWORD: ${VOYAGES_CONSULTATION_PASSWORD:-}
      SESSION_SECRET: ${SESSION_SECRET}
      SESSION_TTL_HOURS: ${SESSION_TTL_HOURS:-12}
      WEBHOOK_SECRET: ${WEBHOOK_SECRET:-}
      FRAME_ANCESTORS: ${FRAME_ANCESTORS:-*}
      ALLOW_INSECURE_TLS: ${ALLOW_INSECURE_TLS:-false}
      APP_URL: ${URL_VOYAGES}
      PIECES_DIR: /app/pieces-jointes
      PIECES_PAR_VOYAGE: ${PIECES_PAR_VOYAGE:-true}
      PIECES_TAILLE_MAX_MO: ${PIECES_TAILLE_MAX_MO:-30}
      AUTO_SYNC_MINUTES: ${AUTO_SYNC_MINUTES:-15}
    volumes:
      - ./donnees/voyages/data:/app/data
      - ./donnees/voyages/backups:/app/backups
      - ./donnees/voyages/pieces-jointes:/app/pieces-jointes
    networks: [ndm_net]

  # --- Passerelle Nginx : 1 port par application, iframe OK, zéro cache -------
  passerelle:
    image: nginx:1.27-alpine
    container_name: ndm_passerelle
    restart: unless-stopped
    depends_on: [portail, fichesanitaire, infirmerie, voyages]
    environment:
      FRAME_ANCESTORS: ${FRAME_ANCESTORS:-*}
      NGINX_ENVSUBST_OUTPUT_DIR: /etc/nginx/conf.d
    volumes:
      - ./passerelle/templates:/etc/nginx/templates:ro
      - ./passerelle/ndm-proxy.conf:/etc/nginx/ndm-proxy.conf:ro
    ports:
      - "${PORT_PORTAIL:-8080}:8080"
      - "${PORT_FICHESANITAIRE:-8099}:8099"
      - "${PORT_INFIRMERIE:-3001}:3001"
      - "${PORT_VOYAGES:-3000}:3000"
    networks: [ndm_net]

volumes:
  ndm_pgdata:

networks:
  ndm_net:
    driver: bridge
```
<!-- SCRIPT-END:docker-compose.yml -->

### `.env.example`

<!-- SCRIPT-START:.env.example -->
```ini
# ============================================================================
#  NDM SANTÉ — configuration (/opt/ndm-sante/.env)
#  Le fichier réel est CRÉÉ AUTOMATIQUEMENT par l'installateur (mots de passe
#  aléatoires) et n'est JAMAIS écrasé ; les variables manquantes sont ajoutées.
#  Après modification :  bash /opt/ndm-sante/scripts/ndm.sh redemarrer
# ============================================================================

# --- Général -----------------------------------------------------------------
TZ=Europe/Paris
# Sites autorisés à afficher les applications en iframe ("*" = tous)
# Exemple : FRAME_ANCESTORS=https://portail.ndmissions.fr https://ent.ndmissions.fr
FRAME_ANCESTORS=*

# --- Ports exposés sur le LXC (ports « Forward » de Nginx Proxy Manager) --------
PORT_PORTAIL=8080
PORT_FICHESANITAIRE=8099
PORT_INFIRMERIE=3001
PORT_VOYAGES=3000

# --- Adresses PUBLIQUES des applications (utilisées par les menus du portail,
#     les liens des e-mails de relance, DocuSeal…). Par défaut : http://IP:port.
#     Si le portail est servi en HTTPS, ces URL DOIVENT être en HTTPS aussi
#     (sinon le navigateur bloque l'iframe : « contenu mixte »).
URL_PORTAIL=http://192.168.1.10:8080
URL_FICHESANITAIRE=http://192.168.1.10:8099
URL_INFIRMERIE=http://192.168.1.10:3001
URL_VOYAGES=http://192.168.1.10:3000

# Nom de l'établissement INITIAL (ensuite : Portail > Admin > Gestion centralisée)
ETABLISSEMENT_NOM=Ensemble Scolaire Notre-Dame des Missions

# --- Secrets (générés automatiquement) ----------------------------------------
# Secret partagé portail -> applications (gestion centralisée des mots de passe et du nom)
NDM_INTERNAL_SECRET=ChangezMoi_au_moins_32_caracteres
DB_PASSWORD=ChangezMoi
SESSION_SECRET=ChangezMoi_au_moins_32_caracteres
# Administration du portail (/admin) — utilisé UNIQUEMENT à la 1re mise en service,
# ensuite le mot de passe se change dans Admin > Configuration du portail
PORTAIL_ADMIN_PASSWORD=ChangezMoi
# Mot de passe du menu protégé « Fiche d'inscription » (1re mise en service)
PORTAIL_MENU_PASSWORD=ChangezMoi
# Compte « Administrateur » (administrateur@portail.local) de la Fiche Sanitaire,
# créé uniquement s'il n'existe aucun administrateur
FICHESANITAIRE_ADMIN_PASSWORD=ChangezMoi
# Mot de passe INITIAL des comptes « admin » et « infirmerie » de la Fiche Infirmerie
# (utilisé uniquement à la création des comptes ; ensuite : bouton « Mot de passe » de l'application)
INFIRMERIE_STAFF_PASSWORD=ChangezMoi
# Mot de passe administrateur du Suivi des voyages
VOYAGES_ADMIN_PASSWORD=ChangezMoi
# Mot de passe « consultation / comptabilité » du Suivi des voyages (optionnel)
VOYAGES_CONSULTATION_PASSWORD=

# --- Fiche Sanitaire : e-mails de relance (vide = désactivé) -------------------
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=fichesanitaire@ndmissions.fr
CRON_SCHEDULE=0 8 * * 1
TRASH_RETENTION_DAYS=30
BACKUP_RETENTION_HOURS=336

# --- Fiche Infirmerie : Nextcloud WebDAV (optionnel, aussi réglable dans l'admin)
NEXTCLOUD_URL=
NEXTCLOUD_USERNAME=
NEXTCLOUD_PASSWORD=
NEXTCLOUD_ROOT_FOLDER=FICHES INFIRMERIE

# --- Suivi des voyages : DocuSeal + pièces jointes ------------------------------
SESSION_TTL_HOURS=12
WEBHOOK_SECRET=
ALLOW_INSECURE_TLS=false
PIECES_PAR_VOYAGE=true
PIECES_TAILLE_MAX_MO=30
AUTO_SYNC_MINUTES=15

# --- Sauvegardes (ndm.sh sauvegarde + tâche cron quotidienne 02:30) ------------
SAUVEGARDE_RETENTION_JOURS=14

# --- GitHub (le jeton n'est JAMAIS ici : il est dans /root/.github-token) ------
GITHUB_USER=serviceinformatique-droid
GITHUB_REPO=ndm-sante
```
<!-- SCRIPT-END:.env.example -->

### `.gitignore`

<!-- SCRIPT-START:.gitignore -->
```text
# NDM SANTÉ — jamais envoyé sur GitHub : secrets, données de santé, sauvegardes, builds
.env
.env.*
!.env.example
donnees/
sauvegardes/
backups-installateur/
installer-ndm-sante.sh
node_modules/
dist/
*.log
.DS_Store
```
<!-- SCRIPT-END:.gitignore -->

### `VERSION`

<!-- SCRIPT-START:VERSION -->
```text
1.2.0
```
<!-- SCRIPT-END:VERSION -->

### `passerelle/templates/default.conf.template`

<!-- SCRIPT-START:passerelle/templates/default.conf.template -->
```nginx
# ============================================================================
#  Passerelle NDM Santé — généré au démarrage par l'image nginx (envsubst)
#  ${FRAME_ANCESTORS} vient de /opt/ndm-sante/.env ("*" = tous les sites)
# ============================================================================
map $http_upgrade $ndm_connection { default upgrade; '' close; }
map $http_x_forwarded_proto $ndm_proto { default $http_x_forwarded_proto; '' $scheme; }

# DNS interne Docker : un conteneur redémarré (nouvelle IP) est retrouvé automatiquement
resolver 127.0.0.11 valid=10s ipv6=off;

client_max_body_size 60M;
server_tokens off;
etag off;
if_modified_since off;
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml text/plain text/markdown;

# Portail (hub iframe)
server {
    listen 8080;
    server_name _;
    location / {
        set $ndm_up http://portail:3020;
        proxy_pass $ndm_up;
        include /etc/nginx/ndm-proxy.conf;
        add_header Content-Security-Policy "frame-ancestors ${FRAME_ANCESTORS}" always;
    }
}

# Fiche Sanitaire de Liaison
server {
    listen 8099;
    server_name _;
    location / {
        set $ndm_up http://fichesanitaire:3000;
        proxy_pass $ndm_up;
        include /etc/nginx/ndm-proxy.conf;
        add_header Content-Security-Policy "frame-ancestors ${FRAME_ANCESTORS}" always;
    }
}

# Fiche Infirmerie
server {
    listen 3001;
    server_name _;
    location / {
        set $ndm_up http://infirmerie:3001;
        proxy_pass $ndm_up;
        include /etc/nginx/ndm-proxy.conf;
        add_header Content-Security-Policy "frame-ancestors ${FRAME_ANCESTORS}" always;
    }
}

# Suivi des Voyages
server {
    listen 3000;
    server_name _;
    location / {
        set $ndm_up http://voyages:3000;
        proxy_pass $ndm_up;
        include /etc/nginx/ndm-proxy.conf;
        add_header Content-Security-Policy "frame-ancestors ${FRAME_ANCESTORS}" always;
    }
}
```
<!-- SCRIPT-END:passerelle/templates/default.conf.template -->

### `passerelle/ndm-proxy.conf`

<!-- SCRIPT-START:passerelle/ndm-proxy.conf -->
```nginx
# ============================================================================
#  Réglages communs à toutes les applications (inclus dans chaque location /)
#  - compatible iframe : X-Frame-Options supprimé, CSP frame-ancestors imposé
#  - 100 % serveur : aucune mise en cache navigateur ni proxy
# ============================================================================
proxy_http_version 1.1;
proxy_set_header Host               $host;
proxy_set_header X-Real-IP          $remote_addr;
proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto  $ndm_proto;
proxy_set_header X-Forwarded-Host   $host;
proxy_set_header Upgrade            $http_upgrade;
proxy_set_header Connection         $ndm_connection;
# En-têtes réservés aux appels internes portail -> applications (réseau Docker) :
# une valeur vide les SUPPRIME de toute requête venant de l'extérieur
proxy_set_header X-Ndm-Internal     "";
proxy_set_header X-Local-Tool       "";
proxy_read_timeout    300s;
proxy_send_timeout    300s;
proxy_buffering       off;
proxy_request_buffering off;
proxy_cache           off;

# Le navigateur ne garde rien : on retire les en-têtes de cache/validation des applications…
proxy_hide_header Cache-Control;
proxy_hide_header Expires;
proxy_hide_header Pragma;
proxy_hide_header ETag;
proxy_hide_header Last-Modified;
proxy_hide_header X-Frame-Options;
proxy_hide_header Content-Security-Policy;
# …et on impose les nôtres sur TOUTES les réponses (y compris erreurs)
add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
add_header Pragma "no-cache" always;
add_header Expires "0" always;
add_header Surrogate-Control "no-store" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```
<!-- SCRIPT-END:passerelle/ndm-proxy.conf -->

### `postgres-init/01-bases.sh`

<!-- SCRIPT-START:postgres-init/01-bases.sh -->
```bash
#!/bin/sh
# Exécuté UNE SEULE FOIS par PostgreSQL à la création du volume ndm_pgdata.
# La base "fichesanitaire" est créée par POSTGRES_DB ; on ajoute la base "portail".
# (L'installateur vérifie aussi son existence à chaque passage.)
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<'SQL'
SELECT 'CREATE DATABASE portail OWNER ndm'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'portail')\gexec
SQL
```
<!-- SCRIPT-END:postgres-init/01-bases.sh -->

### `apps/portail/Dockerfile`

<!-- SCRIPT-START:apps/portail/Dockerfile -->
```dockerfile
# Portail Santé NDM (hub iframe) — image Docker (fusion ndm-sante)
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY . .
EXPOSE 3020
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3020/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
```
<!-- SCRIPT-END:apps/portail/Dockerfile -->

### `apps/fichesanitaire/Dockerfile`

<!-- SCRIPT-START:apps/fichesanitaire/Dockerfile -->
```dockerfile
# Portail Fiche Sanitaire de Liaison — image Docker (fusion ndm-sante)
# Build : Vite 6 (frontend React) ; backend server/index.js (CommonJS, Express + PostgreSQL)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm init -y >/dev/null && npm install --no-audit --no-fund express@^4.21.2 pg@^8.13.0 nodemailer@^6.9.15 node-cron@^3.0.3
COPY --from=build /app/dist ./dist
COPY server ./server
RUN mkdir -p /app/fiches-pdf /app/backups
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=30s \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
CMD ["node", "server/index.js"]
```
<!-- SCRIPT-END:apps/fichesanitaire/Dockerfile -->

### `apps/infirmerie/Dockerfile`

<!-- SCRIPT-START:apps/infirmerie/Dockerfile -->
```dockerfile
# Fiche Infirmerie Numérique — image Docker (fusion ndm-sante)
# Build : Vite 8 (frontend React) + esbuild (backend Express -> dist/server.cjs)
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
# Cahier des charges RGPD (modèle officiel + version modifiable)
COPY CAHIER_DES_CHARGES_RGPD.md CAHIER_DES_CHARGES_RGPD_DEFAULT.md ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint-ndm.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-ndm.sh && mkdir -p /app/data/archives
EXPOSE 3001
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:3001/api/classes').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/docker-entrypoint-ndm.sh"]
CMD ["node", "dist/server.cjs"]
```
<!-- SCRIPT-END:apps/infirmerie/Dockerfile -->

### `apps/infirmerie/docker-entrypoint.sh`

<!-- SCRIPT-START:apps/infirmerie/docker-entrypoint.sh -->
```bash
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
```
<!-- SCRIPT-END:apps/infirmerie/docker-entrypoint.sh -->

### `apps/voyages/Dockerfile`

<!-- SCRIPT-START:apps/voyages/Dockerfile -->
```dockerfile
# Portail Voyages Scolaires (orgavoyageV2) — image Docker (fusion ndm-sante)
# Build : Vite 6 (frontend React) + esbuild (backend Express -> dist/server.cjs)
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV PIECES_DIR=/app/pieces-jointes
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data /app/backups /app/pieces-jointes
EXPOSE 3000
VOLUME ["/app/data", "/app/backups", "/app/pieces-jointes"]
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.cjs"]
```
<!-- SCRIPT-END:apps/voyages/Dockerfile -->

### `apps/portail/server.js`

<!-- SCRIPT-START:apps/portail/server.js -->
```javascript
// ============================================================================
//  Portail Santé NDM — hub qui affiche les applications en iframe
//  Build : ndm-sante-portail (fusion des 4 projets)
//  - Base PostgreSQL "portail" (tables portail_menus / portail_config / session)
//  - Migration + menus par défaut créés automatiquement au démarrage
//  - Les menus « système » (colonne code) prennent leur URL dans .env :
//      URL_FICHESANITAIRE / URL_INFIRMERIE / URL_VOYAGES
// ============================================================================
const express = require('express');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const bcrypt  = require('bcryptjs');
const path    = require('path');
const { Pool } = require('pg');
const centrale = require('./centrale');

console.log('[portail] build ndm-sante-portail + centrale-20261011');

const app = express();
const db  = new Pool({ connectionString: process.env.DATABASE_URL });

app.set('trust proxy', true);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 100 % serveur : aucune mise en cache navigateur, et intégrable en iframe partout
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', `frame-ancestors ${process.env.FRAME_ANCESTORS || '*'}`);
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false, maxAge: 0 }));

app.use(session({
  store: new PgStore({ pool: db, tableName: 'portail_session', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'portail-ndm-secret-a-changer',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: { maxAge: 8 * 60 * 60 * 1000, httpOnly: true, secure: 'auto', sameSite: 'lax' }
}));
// En HTTPS, le cookie est aussi envoyé quand le portail est lui-même dans une iframe d'un autre site
app.use((req, res, next) => {
  if (req.session && req.secure) req.session.cookie.sameSite = 'none';
  next();
});

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ════════════════════════════════════════════════════════════════════════════
//  MIGRATION AUTOMATIQUE
// ════════════════════════════════════════════════════════════════════════════
const SYSTEM_URLS = {
  fichesanitaire: process.env.URL_FICHESANITAIRE || '',
  infirmerie:     process.env.URL_INFIRMERIE || '',
  voyages:        process.env.URL_VOYAGES || ''
};

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS portail_menus (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_id   UUID REFERENCES portail_menus(id) ON DELETE CASCADE,
      titre       VARCHAR(100) NOT NULL,
      icone       VARCHAR(20) DEFAULT '',
      url         VARCHAR(500) DEFAULT '',
      ordre       INTEGER NOT NULL DEFAULT 0,
      protege     BOOLEAN NOT NULL DEFAULT FALSE,
      mot_de_passe_hash VARCHAR(100),
      actif       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE portail_menus ADD COLUMN IF NOT EXISTS code VARCHAR(40);
    CREATE INDEX IF NOT EXISTS idx_portail_menus_parent ON portail_menus(parent_id);
    CREATE INDEX IF NOT EXISTS idx_portail_menus_ordre  ON portail_menus(ordre);
    CREATE TABLE IF NOT EXISTS portail_config (
      cle     VARCHAR(50) PRIMARY KEY,
      valeur  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS portail_audit (
      id      SERIAL PRIMARY KEY,
      date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip      VARCHAR(64),
      action  TEXT NOT NULL
    );
  `);
  if (process.env.ETABLISSEMENT_NOM) {
    await db.query("INSERT INTO portail_config (cle, valeur) VALUES ('etablissement', $1) ON CONFLICT (cle) DO NOTHING", [process.env.ETABLISSEMENT_NOM]);
  }

  await db.query(`INSERT INTO portail_config (cle, valeur) VALUES
      ('titre', 'Portail de santé de Notre Dame des Missions'),
      ('logo_url', 'https://notredamedesmissions.com/fichiers/logogd.jpg')
    ON CONFLICT (cle) DO NOTHING`);

  // Mot de passe administrateur : fixé par .env (PORTAIL_ADMIN_PASSWORD) s'il n'a jamais été défini
  const adm = await db.query("SELECT 1 FROM portail_config WHERE cle='mdp_admin_hash'");
  if (!adm.rows.length && process.env.PORTAIL_ADMIN_PASSWORD) {
    const h = await bcrypt.hash(process.env.PORTAIL_ADMIN_PASSWORD, 12);
    await db.query("INSERT INTO portail_config (cle, valeur) VALUES ('mdp_admin_hash', $1)", [h]);
    console.log('[portail] Mot de passe administrateur initialisé depuis PORTAIL_ADMIN_PASSWORD');
  }

  // Menus par défaut (uniquement sur une base vide : jamais de doublons)
  const count = await db.query('SELECT COUNT(*)::int AS n FROM portail_menus');
  if (count.rows[0].n === 0) {
    const ins = async (parent, titre, icone, url, ordre, protege, code, mdp) => {
      const hash = mdp ? await bcrypt.hash(mdp, 12) : null;
      const r = await db.query(
        'INSERT INTO portail_menus (parent_id,titre,icone,url,ordre,protege,mot_de_passe_hash,code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        [parent, titre, icone, url, ordre, protege, hash, code]
      );
      return r.rows[0].id;
    };
    const sejour = await ins(null, 'Séjour scolaire', '🗺️', '', 1, false, null);
    const inscr  = await ins(sejour, "Fiche d'inscription", '✍️', '', 1, true, null, process.env.PORTAIL_MENU_PASSWORD || null);
    await ins(inscr, 'Voyage en Auvergne', '', 'https://docuseal.ndmissions.fr/d/gsx5T3CYjgCkpx', 1, false, null);
    await ins(inscr, 'Voyage Espagne', '', 'https://docuseal.ndmissions.fr/d/voyage-espagne', 2, false, null);
    await ins(inscr, 'Voyage Angleterre', '', 'https://docuseal.ndmissions.fr/d/voyage-angleterre', 3, false, null);
    await ins(sejour, 'Fiche Sanitaire', '📝', SYSTEM_URLS.fichesanitaire, 2, false, 'fichesanitaire');
    await ins(sejour, 'Suivi des voyages', '🧳', SYSTEM_URLS.voyages, 3, false, 'voyages');
    await ins(null, 'Fiche Infirmerie', '🏥', SYSTEM_URLS.infirmerie, 2, false, 'infirmerie');
    console.log('[portail] Menus par défaut créés');
  }

  // Les menus système suivent toujours les URL du fichier .env
  for (const [code, url] of Object.entries(SYSTEM_URLS)) {
    if (url) await db.query('UPDATE portail_menus SET url=$1 WHERE code=$2', [url, code]);
  }
}

async function getConfig() {
  const r = await db.query('SELECT cle, valeur FROM portail_config');
  return Object.fromEntries(r.rows.map(row => [row.cle, row.valeur]));
}

async function getMenuTree() {
  const r = await db.query('SELECT * FROM portail_menus WHERE actif=TRUE ORDER BY ordre, titre');
  const all = r.rows;
  function buildChildren(parentId) {
    return all
      .filter(m => (m.parent_id || null) === (parentId || null))
      .map(m => ({ ...m, children: buildChildren(m.id) }));
  }
  return buildChildren(null);
}

async function getAllMenusFlat() {
  const r = await db.query('SELECT * FROM portail_menus WHERE actif=TRUE ORDER BY ordre, titre');
  return r.rows;
}

function requireAdmin(req, res, next) {
  if (req.session.admin_auth) return next();
  if (req.path.startsWith('/admin/centrale/') && req.method === 'POST' && req.is('application/json')) {
    return res.status(401).json({ ok: false, error: 'Session expirée : reconnectez-vous à l\'administration.' });
  }
  res.redirect('/admin/login');
}

// Journal d'audit (jamais de mot de passe dedans)
async function audit(req, action) {
  try {
    await db.query('INSERT INTO portail_audit (ip, action) VALUES ($1, $2)', [String(req.ip || '?').slice(0, 64), action]);
    await db.query("DELETE FROM portail_audit WHERE date < NOW() - INTERVAL '2 years'");
  } catch (e) {
    console.error('[audit]', e.message);
  }
}

// Anti force brute sur la connexion administrateur : 5 échecs par adresse => 15 min de blocage
const echecsAdmin = new Map();
function adminBloque(req) {
  const e = echecsAdmin.get(req.ip);
  return e && e.jusqua > Date.now() ? Math.ceil((e.jusqua - Date.now()) / 60000) : 0;
}
function adminEchec(req) {
  const e = echecsAdmin.get(req.ip) || { n: 0, jusqua: 0 };
  if (e.jusqua && e.jusqua < Date.now()) { e.n = 0; e.jusqua = 0; }
  e.n += 1;
  if (e.n >= 5) e.jusqua = Date.now() + 15 * 60000;
  echecsAdmin.set(req.ip, e);
}

// ════════════════════════════════════════════════════════════════════════════
//  PORTAIL – Accès libre
// ════════════════════════════════════════════════════════════════════════════
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/', wrap(async (req, res) => {
  const [config, menus] = await Promise.all([getConfig(), getMenuTree()]);
  res.render('portail', { config, menus, menuPasswords: req.session.menu_passwords || {} });
}));

app.get(['/login', '/logout'], (req, res) => {
  if (req.session) req.session.menu_passwords = {};
  res.redirect('/');
});

app.post('/menu/auth', async (req, res) => {
  try {
    const menu_id = req.body?.menu_id;
    const password = req.body?.password || '';
    if (!menu_id) return res.json({ success: false, error: 'menu_id manquant' });
    const r = await db.query('SELECT * FROM portail_menus WHERE id=$1', [menu_id]);
    const menu = r.rows[0];
    if (!menu || !menu.protege) return res.json({ success: true });
    const hash = menu.mot_de_passe_hash || '$2a$12$invalidhashxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    const ok = await bcrypt.compare(password, hash);
    if (ok) {
      if (!req.session.menu_passwords) req.session.menu_passwords = {};
      req.session.menu_passwords[menu_id] = true;
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Mot de passe incorrect' });
    }
  } catch (err) {
    console.error('menu/auth error:', err.message);
    res.json({ success: false, error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN LOGIN
// ════════════════════════════════════════════════════════════════════════════
app.get('/admin/login', (req, res) => {
  if (req.session.admin_auth) return res.redirect('/admin');
  res.render('admin/login', { error: req.query.error, bloque: adminBloque(req) });
});

app.post('/admin/login', wrap(async (req, res) => {
  if (adminBloque(req)) return res.redirect('/admin/login?error=2');
  const config = await getConfig();
  const adminHash = config.mdp_admin_hash || '$2a$12$invalid';
  const ok = await bcrypt.compare(req.body.password || '', adminHash);
  if (ok) {
    echecsAdmin.delete(req.ip);
    req.session.regenerate((err) => {
      if (err) return res.redirect('/admin/login?error=1');
      req.session.admin_auth = true;
      audit(req, 'Connexion à l\'administration du portail');
      res.redirect('/admin');
    });
  } else {
    adminEchec(req);
    audit(req, 'Échec de connexion à l\'administration du portail');
    res.redirect('/admin/login?error=1');
  }
}));

app.get('/admin/logout', (req, res) => { req.session.admin_auth = false; res.redirect('/admin/login'); });

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN – MENUS
// ════════════════════════════════════════════════════════════════════════════
app.get('/admin', requireAdmin, wrap(async (req, res) => {
  const [config, menus, allMenus] = await Promise.all([getConfig(), getMenuTree(), getAllMenusFlat()]);
  res.render('admin/index', { config, menus, allMenus, msg: req.query.msg });
}));

app.post('/admin/menus', requireAdmin, wrap(async (req, res) => {
  const { titre, icone, url, parent_id, protege, mot_de_passe, ordre } = req.body;
  let hash = null;
  if (protege === '1' && mot_de_passe) hash = await bcrypt.hash(mot_de_passe, 12);
  await db.query(
    'INSERT INTO portail_menus (titre,icone,url,parent_id,ordre,protege,mot_de_passe_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [titre, icone||'', url||'', parent_id||null, parseInt(ordre)||0, protege==='1', hash]
  );
  res.redirect('/admin?msg=Menu ajouté');
}));

app.post('/admin/menus/:id/modifier', requireAdmin, wrap(async (req, res) => {
  const { titre, icone, url, parent_id, protege, mot_de_passe, ordre } = req.body;
  const existing = await db.query('SELECT * FROM portail_menus WHERE id=$1', [req.params.id]);
  let hash = existing.rows[0]?.mot_de_passe_hash || null;
  if (mot_de_passe) hash = await bcrypt.hash(mot_de_passe, 12);
  await db.query(
    'UPDATE portail_menus SET titre=$1,icone=$2,url=$3,parent_id=$4,ordre=$5,protege=$6,mot_de_passe_hash=$7 WHERE id=$8',
    [titre, icone||'', url||'', parent_id||null, parseInt(ordre)||0, protege==='1', hash, req.params.id]
  );
  res.redirect('/admin?msg=Menu modifié');
}));

app.post('/admin/menus/:id/supprimer', requireAdmin, wrap(async (req, res) => {
  await db.query('UPDATE portail_menus SET actif=FALSE WHERE id=$1', [req.params.id]);
  const desactiver = async (pid) => {
    const children = await db.query('SELECT id FROM portail_menus WHERE parent_id=$1', [pid]);
    for (const c of children.rows) {
      await db.query('UPDATE portail_menus SET actif=FALSE WHERE id=$1', [c.id]);
      await desactiver(c.id);
    }
  };
  await desactiver(req.params.id);
  res.redirect('/admin?msg=Menu supprimé');
}));

app.post('/admin/menus/deplacer', requireAdmin, async (req, res) => {
  try {
    const { id, direction } = req.body;
    const cur = await db.query('SELECT * FROM portail_menus WHERE id=$1', [id]);
    if (!cur.rows[0]) return res.json({ success: false, error: 'Non trouvé' });
    const menu = cur.rows[0];
    let voisinQ;
    if (direction === 'up') {
      voisinQ = await db.query(
        'SELECT * FROM portail_menus WHERE parent_id IS NOT DISTINCT FROM $1 AND ordre < $2 AND actif=TRUE ORDER BY ordre DESC LIMIT 1',
        [menu.parent_id, menu.ordre]
      );
    } else {
      voisinQ = await db.query(
        'SELECT * FROM portail_menus WHERE parent_id IS NOT DISTINCT FROM $1 AND ordre > $2 AND actif=TRUE ORDER BY ordre ASC LIMIT 1',
        [menu.parent_id, menu.ordre]
      );
    }
    if (!voisinQ.rows[0]) return res.json({ success: true });
    const voisin = voisinQ.rows[0];
    await db.query('UPDATE portail_menus SET ordre=$1 WHERE id=$2', [voisin.ordre, menu.id]);
    await db.query('UPDATE portail_menus SET ordre=$1 WHERE id=$2', [menu.ordre, voisin.id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/admin/config', requireAdmin, wrap(async (req, res) => {
  const { titre, logo_url, nouveau_mdp_admin } = req.body;
  if (titre) await db.query("INSERT INTO portail_config(cle,valeur) VALUES('titre',$1) ON CONFLICT(cle) DO UPDATE SET valeur=$1", [titre]);
  if (logo_url) await db.query("INSERT INTO portail_config(cle,valeur) VALUES('logo_url',$1) ON CONFLICT(cle) DO UPDATE SET valeur=$1", [logo_url]);
  if (nouveau_mdp_admin) {
    const h = await bcrypt.hash(nouveau_mdp_admin, 12);
    await db.query("INSERT INTO portail_config(cle,valeur) VALUES('mdp_admin_hash',$1) ON CONFLICT(cle) DO UPDATE SET valeur=$1", [h]);
  }
  res.redirect('/admin?msg=Configuration sauvegardée');
}));

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN – GESTION CENTRALISÉE (mots de passe des 4 applications + nom de l'établissement)
// ════════════════════════════════════════════════════════════════════════════
app.get('/admin/centrale', requireAdmin, wrap(async (req, res) => {
  const etat = await centrale.etatComplet(db);
  const journal = await db.query('SELECT date, ip, action FROM portail_audit ORDER BY date DESC LIMIT 60');
  res.render('admin/centrale', { ...etat, journal: journal.rows, apps: centrale.APPS, minLen: centrale.MIN_LEN, msg: req.query.msg, err: req.query.err });
}));

app.post('/admin/centrale/etablissement', requireAdmin, wrap(async (req, res) => {
  try {
    const nom = String(req.body.nom || '').trim();
    const r = await centrale.changerEtablissement(db, nom, req.body.maj_titre === '1');
    const echecs = Object.entries(r).filter(([, v]) => !v.ok).map(([k, v]) => `${k} : ${v.error}`);
    await audit(req, `Nom de l'établissement changé en « ${nom} »${echecs.length ? ` (échecs : ${echecs.join(' ; ')})` : ''}`);
    if (echecs.length) return res.redirect('/admin/centrale?err=' + encodeURIComponent('Nom enregistré, mais non appliqué à : ' + echecs.join(' ; ')));
    res.redirect('/admin/centrale?msg=' + encodeURIComponent(`Nom « ${nom} » appliqué aux 4 applications.`));
  } catch (e) {
    res.redirect('/admin/centrale?err=' + encodeURIComponent(e.message));
  }
}));

app.post('/admin/centrale/mot-de-passe', requireAdmin, async (req, res) => {
  const { app: appKey, type, id, libelle } = req.body || {};
  try {
    const message = await centrale.changerMotDePasse(db, req.body || {});
    await audit(req, `Mot de passe redéfini — ${appKey} / ${type} : ${String(libelle || id || '').slice(0, 200)}`);
    res.json({ ok: true, message });
  } catch (e) {
    await audit(req, `ÉCHEC changement de mot de passe — ${appKey} / ${type} : ${String(libelle || id || '').slice(0, 200)} (${e.message})`);
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.use((err, req, res, next) => {
  console.error('[portail] Erreur :', err);
  res.status(500).send('Erreur serveur — voir : docker logs ndm_portail');
});

// Démarrage : on attend PostgreSQL puis on migre
(async function start() {
  for (let i = 1; ; i++) {
    try { await migrate(); break; }
    catch (e) {
      if (i >= 30) { console.error('[portail] Migration impossible :', e); process.exit(1); }
      console.log(`[portail] Base indisponible (${e.message}), nouvel essai ${i}/30…`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  const port = process.env.PORT || 3020;
  app.listen(port, '0.0.0.0', () => console.log(`✅ Portail NDM démarré sur le port ${port}`));
})();
```
<!-- SCRIPT-END:apps/portail/server.js -->

### `apps/portail/centrale.js`

<!-- SCRIPT-START:apps/portail/centrale.js -->
```javascript
// ============================================================================
//  Portail NDM — GESTION CENTRALISÉE (build centrale-20261011)
//  Mots de passe des 4 applications + nom de l'établissement, depuis /admin/centrale
//  Le portail appelle chaque application par le réseau Docker INTERNE avec le secret
//  partagé NDM_INTERNAL_SECRET (en-tête X-Ndm-Internal, ou X-Local-Tool pour la Fiche
//  Sanitaire). La passerelle nginx supprime ces en-têtes de toute requête extérieure.
// ============================================================================
const bcrypt = require('bcryptjs');

const SECRET = process.env.NDM_INTERNAL_SECRET || '';
const MIN_LEN = 8;

const APPS = {
  fichesanitaire: { nom: 'Fiche Sanitaire', base: process.env.INTERNAL_URL_FICHESANITAIRE || 'http://fichesanitaire:3000', header: 'X-Local-Tool' },
  infirmerie:     { nom: 'Fiche Infirmerie', base: process.env.INTERNAL_URL_INFIRMERIE || 'http://infirmerie:3001', header: 'X-Ndm-Internal' },
  voyages:        { nom: 'Suivi des Voyages', base: process.env.INTERNAL_URL_VOYAGES || 'http://voyages:3000', header: 'X-Ndm-Internal' },
};

const K_USERS = 'cerfa_users_v1';
const K_TRIPS = 'cerfa_trips_v2';
const K_NAME = 'cerfa_establishment_name_v1';

const ROLE_FS = { admin: 'Administration', organizer: 'Organisateur / professeur', parent: 'Famille (parent)' };

async function call(appKey, method, path, body) {
  const app = APPS[appKey];
  if (!SECRET || SECRET.length < 24) throw new Error('NDM_INTERNAL_SECRET absent du .env (relancer l\'installateur)');
  const res = await fetch(app.base + path, {
    method,
    headers: { 'Content-Type': 'application/json', [app.header]: SECRET },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let data = null;
  try { data = await res.json(); } catch { /* réponse non JSON */ }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(`${app.nom} : ${msg}`);
  }
  return data;
}

// Exécute sans jamais faire échouer toute la page si une application est arrêtée
async function safe(fn) {
  try { return { ok: true, data: await fn() }; } catch (e) { return { ok: false, error: e.message || String(e) }; }
}

// ---------------------------------------------------------------- lecture
async function etatComplet(db) {
  const [fs, inf, infBrand, voy, voyName, menus, cfg] = await Promise.all([
    safe(() => call('fichesanitaire', 'GET', '/api/data')),
    safe(() => call('infirmerie', 'GET', '/api/internal/accounts')),
    safe(() => call('infirmerie', 'GET', '/api/branding')),
    safe(() => call('voyages', 'GET', '/api/voyages')),
    safe(() => call('voyages', 'GET', '/api/settings/public')),
    db.query("SELECT id, titre, icone FROM portail_menus WHERE actif=TRUE AND protege=TRUE ORDER BY ordre, titre"),
    db.query('SELECT cle, valeur FROM portail_config'),
  ]);
  const config = Object.fromEntries(cfg.rows.map((r) => [r.cle, r.valeur]));

  const comptes = {
    portail: {
      ok: true,
      lignes: [
        { type: 'admin', id: 'admin', titre: 'Administration du portail', detail: '/admin', badge: config.mdp_admin_hash ? '' : 'non défini' },
        ...menus.rows.map((m) => ({ type: 'menu', id: m.id, titre: `Menu protégé : ${m.icone || ''} ${m.titre}`.replace(/\s+/g, ' '), detail: 'Mot de passe d\'accès au menu' })),
      ],
    },
    fichesanitaire: fs.ok
      ? {
          ok: true,
          lignes: [
            ...((fs.data && fs.data[K_USERS]) || [])
              .filter((u) => u && u.id)
              .sort((a, b) => (a.role || '').localeCompare(b.role || '') || String(a.name || '').localeCompare(String(b.name || ''), 'fr'))
              .map((u) => ({ type: 'user', id: u.id, titre: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email, detail: `${u.email || ''} — ${ROLE_FS[u.role] || u.role}`, groupe: ROLE_FS[u.role] || u.role })),
            ...((fs.data && fs.data[K_TRIPS]) || [])
              .filter((t) => t && t.id)
              .map((t) => ({ type: 'trip', id: t.id, titre: `Voyage : ${t.name || t.destination || t.id}`, detail: 'Mot de passe des accompagnateurs', badge: t.chaperonePassword ? '' : 'aucun', groupe: 'Voyages (accompagnateurs)' })),
          ],
        }
      : { ok: false, error: fs.error, lignes: [] },
    infirmerie: inf.ok
      ? {
          ok: true,
          lignes: [
            ...inf.data.staff.map((s) => ({ type: 'staff', id: s.username, titre: s.label, detail: `identifiant : ${s.username}`, badge: s.motDePasseInitial ? 'mot de passe initial' : '', groupe: 'Personnel' })),
            ...inf.data.parents.map((p) => ({ type: 'parent', id: p.id, titre: `${p.prenom || ''} ${p.nom || ''}`.trim(), detail: p.email, groupe: 'Parents' })),
          ],
        }
      : { ok: false, error: inf.error, lignes: [] },
    voyages: voy.ok
      ? {
          ok: true,
          lignes: [
            { type: 'admin', id: 'admin', titre: 'Administrateur', detail: 'Accès « Admin DocuSeal »' },
            { type: 'consultation', id: 'consultation', titre: 'Consultation / comptabilité', detail: 'Lecture seule, tous les voyages' },
            ...(Array.isArray(voy.data) ? voy.data : []).map((v) => ({ type: 'voyage', id: v.id, titre: `Voyage : ${v.nom || v.destination || v.id}`, detail: 'Mot de passe professeur du voyage', badge: v.mot_de_passe ? '' : 'non protégé', groupe: 'Voyages' })),
          ],
        }
      : { ok: false, error: voy.error, lignes: [] },
  };

  const central = config.etablissement || process.env.ETABLISSEMENT_NOM || '';
  const noms = {
    portail: { ok: true, valeur: config.titre || '' , libelle: 'Titre du portail' },
    fichesanitaire: fs.ok ? { ok: true, valeur: (fs.data && fs.data[K_NAME]) || '' } : { ok: false, error: fs.error },
    infirmerie: infBrand.ok ? { ok: true, valeur: (infBrand.data && infBrand.data.branding && infBrand.data.branding.schoolName) || '' } : { ok: false, error: infBrand.error },
    voyages: voyName.ok ? { ok: true, valeur: (voyName.data && voyName.data.etablissement) || '' } : { ok: false, error: voyName.error },
  };
  return { comptes, noms, central, config };
}

// ---------------------------------------------------------------- écriture : nom
async function changerEtablissement(db, nom, majTitre) {
  const n = String(nom || '').trim();
  if (n.length < 3 || n.length > 150) throw new Error('Le nom doit comporter entre 3 et 150 caractères.');
  const setCfg = (cle, valeur) =>
    db.query('INSERT INTO portail_config(cle,valeur) VALUES($1,$2) ON CONFLICT(cle) DO UPDATE SET valeur=$2', [cle, valeur]);
  await setCfg('etablissement', n);
  if (majTitre) await setCfg('titre', `Portail de santé – ${n}`);
  const res = {
    portail: { ok: true, message: majTitre ? 'Titre du portail mis à jour' : 'Nom enregistré' },
    fichesanitaire: await safe(() => call('fichesanitaire', 'PUT', `/api/data/${K_NAME}`, { value: n })),
    infirmerie: await safe(() => call('infirmerie', 'POST', '/api/branding', { schoolName: n })),
    voyages: await safe(() => call('voyages', 'POST', '/api/internal/etablissement', { nom: n })),
  };
  return res;
}

// ---------------------------------------------------------------- écriture : mot de passe
async function changerMotDePasse(db, { app, type, id, password }) {
  const pwd = String(password || '');
  if (pwd.length < MIN_LEN) throw new Error(`Le mot de passe doit comporter au moins ${MIN_LEN} caractères.`);
  if (pwd.length > 128) throw new Error('Mot de passe trop long (128 caractères maximum).');

  if (app === 'portail') {
    const h = await bcrypt.hash(pwd, 12);
    if (type === 'admin') {
      await db.query("INSERT INTO portail_config(cle,valeur) VALUES('mdp_admin_hash',$1) ON CONFLICT(cle) DO UPDATE SET valeur=$1", [h]);
      return 'Mot de passe de l\'administration du portail modifié.';
    }
    if (type === 'menu') {
      const r = await db.query('UPDATE portail_menus SET mot_de_passe_hash=$1, protege=TRUE WHERE id=$2 RETURNING titre', [h, id]);
      if (!r.rows.length) throw new Error('Menu introuvable.');
      return `Mot de passe du menu « ${r.rows[0].titre} » modifié.`;
    }
  }

  if (app === 'fichesanitaire') {
    const data = await call('fichesanitaire', 'GET', '/api/data');
    if (type === 'user') {
      const u = ((data && data[K_USERS]) || []).find((x) => x && x.id === id);
      if (!u) throw new Error('Compte introuvable dans la Fiche Sanitaire.');
      await call('fichesanitaire', 'POST', '/api/users/upsert', { user: { ...u, password: pwd } });
      return `Mot de passe de ${u.name || u.email} (${u.email}) modifié dans la Fiche Sanitaire.`;
    }
    if (type === 'trip') {
      const trips = (data && data[K_TRIPS]) || [];
      const t = trips.find((x) => x && x.id === id);
      if (!t) throw new Error('Voyage introuvable dans la Fiche Sanitaire.');
      t.chaperonePassword = pwd;
      await call('fichesanitaire', 'PUT', `/api/data/${K_TRIPS}`, { value: trips });
      return `Mot de passe accompagnateurs du voyage « ${t.name || t.destination} » modifié.`;
    }
  }

  if (app === 'infirmerie' && (type === 'staff' || type === 'parent')) {
    const r = await call('infirmerie', 'POST', '/api/internal/set-password', { kind: type, id, password: pwd });
    return r.message || 'Mot de passe modifié dans la Fiche Infirmerie.';
  }

  if (app === 'voyages') {
    if (type === 'admin') {
      await call('voyages', 'POST', '/api/internal/set-admin-password', { password: pwd });
      return 'Mot de passe administrateur du Suivi des Voyages modifié.';
    }
    if (type === 'consultation') {
      await call('voyages', 'POST', '/api/admin/change-consultation-password', { newPassword: pwd });
      return 'Mot de passe consultation / comptabilité modifié.';
    }
    if (type === 'voyage') {
      const v = await call('voyages', 'PUT', `/api/voyages/${encodeURIComponent(id)}`, { mot_de_passe: pwd });
      return `Mot de passe professeur du voyage « ${(v && v.nom) || id} » modifié.`;
    }
  }
  throw new Error('Type de compte inconnu.');
}

module.exports = { APPS, MIN_LEN, etatComplet, changerEtablissement, changerMotDePasse };
```
<!-- SCRIPT-END:apps/portail/centrale.js -->

### `apps/portail/package.json`

<!-- SCRIPT-START:apps/portail/package.json -->
```json
{
  "name": "portail-ndm",
  "version": "1.0.0",
  "description": "Portail de santé Notre Dame des Missions",
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "connect-pg-simple": "^9.0.1",
    "ejs": "^3.1.9",
    "pg": "^8.11.3"
  }
}
```
<!-- SCRIPT-END:apps/portail/package.json -->

### `apps/portail/views/portail.ejs`

<!-- SCRIPT-START:apps/portail/views/portail.ejs -->
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title><%= config.titre %></title>
  <style>
    * { box-sizing:border-box; }
    body,html { margin:0; padding:0; width:100%; height:100%; height:100dvh;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
      overflow:hidden; background:#f5f6fa; }
    .navbar { height:50px; background:#1e3c72; color:white; display:flex; align-items:center;
      padding:0 20px; box-shadow:0 2px 5px rgba(0,0,0,.1); position:relative; z-index:15; }
    .navbar h1 { margin:0; font-size:1.1rem; font-weight:500; flex-grow:1;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .navbar-right { display:flex; gap:.75rem; align-items:center; }
    .btn-nav { background:rgba(255,255,255,.15); border:none; color:white; padding:.35rem .8rem;
      border-radius:6px; cursor:pointer; font-size:.8rem; text-decoration:none; }
    .btn-nav:hover { background:rgba(255,255,255,.25); }
    .menu-toggle { display:none; background:none; border:none; color:white;
      font-size:1.5rem; cursor:pointer; padding:5px 10px; margin-right:10px; }
    .main-wrapper { display:flex; width:100%; height:calc(100% - 50px); position:relative; }
    .sidebar { width:280px; background:#2f3542; color:white; display:flex; flex-direction:column;
      padding-top:15px; box-shadow:2px 0 5px rgba(0,0,0,.05); z-index:10;
      flex-shrink:0; transition:transform .3s ease; overflow-y:auto; }
    .sidebar-title { font-size:.85rem; text-transform:uppercase; letter-spacing:1px;
      color:#a4b0be; padding:10px 20px; margin:0; }
    .sidebar-menu { list-style:none; padding:0; margin:0; }
    .sidebar-item { padding:14px 20px; cursor:pointer; display:flex; align-items:center;
      justify-content:space-between; transition:background .2s; font-size:.95rem;
      border-left:4px solid transparent; user-select:none; }
    .sidebar-item:hover { background:#343a40; }
    .sidebar-item.active { background:#1e3c72; border-left:4px solid #70a1ff; font-weight:bold; }
    .sidebar-item .lock { font-size:.75rem; margin-left:.4rem; opacity:.7; }
    .arrow { font-size:.8rem; transition:transform .2s; margin-left:8px; }
    .dropdown.open .arrow { transform:rotate(90deg); }
    .submenu { list-style:none; padding:0; margin:0; background:#212529;
      max-height:0; overflow:hidden; transition:max-height .3s ease-out; }
    .dropdown.open .submenu { max-height:500px; }
    .submenu-item { padding:11px 20px 11px 40px; cursor:pointer; font-size:.9rem;
      color:#ccc; transition:all .2s; border-left:4px solid transparent; display:flex;
      align-items:center; justify-content:space-between; }
    .submenu-item:hover { background:#3a4047; color:white; }
    .submenu-item.active { background:#1e3c72; color:white; border-left:4px solid #70a1ff; font-weight:bold; }
    .submenu-group { padding:8px 20px 4px 24px; font-size:.78rem; color:#70a1ff;
      text-transform:uppercase; letter-spacing:.5px; cursor:default; }
    .submenu-separator { border-top:1px solid #3a4047; margin:6px 0; }
    .content-pane { flex:1; height:100%; position:relative; background:white; }
    iframe { width:100%; height:100%; border:none; display:block; }
    .welcome-screen { position:absolute; top:0; left:0; width:100%; height:100%;
      background:white; display:flex; justify-content:center; align-items:center; z-index:2; padding:20px; }
    .welcome-screen img { max-width:100%; max-height:70%; object-fit:contain; }
    .sidebar-overlay { display:none; position:absolute; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,.4); z-index:9; }

    /* Modal mot de passe menu */
    .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.55);
      display:none; align-items:center; justify-content:center; z-index:999; }
    .modal-bg.open { display:flex; }
    .modal-box { background:white; border-radius:14px; padding:2rem; width:380px;
      max-width:95vw; box-shadow:0 20px 60px rgba(0,0,0,.35); text-align:center; }
    .modal-box h3 { color:#1e3c72; margin-bottom:.5rem; font-size:1.1rem; }
    .modal-box p { color:#888; font-size:.85rem; margin-bottom:1.25rem; }
    .modal-box input { width:100%; padding:.75rem 1rem; border:2px solid #e0e0e0;
      border-radius:8px; font-size:1rem; margin-bottom:1rem; outline:none; }
    .modal-box input:focus { border-color:#1e3c72; }
    .modal-actions { display:flex; gap:.75rem; justify-content:center; }
    .btn-modal { padding:.65rem 1.5rem; border-radius:8px; border:none; cursor:pointer;
      font-size:.9rem; font-weight:600; }
    .btn-confirm { background:#1e3c72; color:white; }
    .btn-cancel { background:#f0f0f0; color:#333; }
    .modal-error { color:#c0392b; font-size:.85rem; margin-bottom:.75rem; display:none; }

    .content-pane { -webkit-overflow-scrolling:touch; overflow:auto; }
    .welcome-screen .welcome-hint { display:none; }

    @media (max-width:768px) {
      .menu-toggle { display:block; margin-right:4px; padding:5px 8px; }
      .navbar { padding:0 10px; padding-left:max(10px, env(safe-area-inset-left)); }
      .navbar h1 { font-size:.95rem; }
      .navbar-right { gap:.4rem; }
      .btn-nav { padding:.35rem .55rem; font-size:.75rem; }
      .btn-nav .txt { display:none; }
      .sidebar { width:82vw; max-width:300px; }
      .sidebar-item, .submenu-item { padding-top:16px; padding-bottom:16px; }
      .welcome-screen { flex-direction:column; gap:1.25rem; }
      .welcome-screen .welcome-hint { display:block; color:#1e3c72; font-weight:600; text-align:center; }
      .modal-box { padding:1.5rem 1.1rem; }
      .modal-box input { font-size:16px; }
      .sidebar { position:absolute; left:0; top:0; height:100%; transform:translateX(-100%); }
      .sidebar.mobile-open { transform:translateX(0); }
      .sidebar-overlay.mobile-open { display:block; }
    }
  </style>
</head>
<body>
  <div class="navbar">
    <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
    <h1><%= config.titre %></h1>
    <div class="navbar-right">
      <a id="btn-open" href="#" class="btn-nav" target="_blank" rel="noopener" style="display:none" title="Ouvrir l'application dans un nouvel onglet">↗<span class="txt"> Nouvel onglet</span></a>
      <a href="/admin" class="btn-nav" target="_top">⚙️<span class="txt"> Admin</span></a>
      <a href="/logout" class="btn-nav" title="Verrouiller les menus protégés">🔒<span class="txt"> Verrouiller</span></a>
    </div>
  </div>

  <div class="main-wrapper">
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>

    <div class="sidebar" id="sidebarMenu">
      <p class="sidebar-title">Applications</p>
      <ul class="sidebar-menu" id="menu-root">
        <% menus.forEach((menu, idx) => { %>
          <% if (menu.children && menu.children.length > 0) { %>
            <li class="dropdown" id="drop-<%= menu.id %>">
              <div class="sidebar-item" onclick="toggleDropdown('drop-<%= menu.id %>','<%= menu.id %>','<%= menu.protege ? 1 : 0 %>')">
                <span><%= menu.icone %> <%= menu.titre %><% if(menu.protege){ %><span class="lock">🔒</span><% } %></span>
                <span class="arrow">▶</span>
              </div>
              <ul class="submenu">
                <% menu.children.forEach(child => { %>
                  <% if (child.children && child.children.length > 0) { %>
                    <li class="submenu-group"><%= child.icone %> <%= child.titre %><% if(child.protege){ %> 🔒<% } %></li>
                    <% child.children.forEach(sub => {
                         /* un groupe protégé protège aussi ses sous-menus */
                         const lockId = sub.protege ? sub.id : (child.protege ? child.id : sub.id);
                         const locked = (sub.protege || child.protege) ? '1' : '0'; %>
                      <li class="submenu-item" onclick="handleClick('<%= lockId %>', '<%= sub.url %>', '<%= locked %>', this)">
                        <span><%= sub.titre %></span>
                      </li>
                    <% }) %>
                    <li class="submenu-separator"></li>
                  <% } else { %>
                    <li class="submenu-item" onclick="handleClick('<%= child.id %>', '<%= child.url %>', '<%= child.protege ? '1' : '0' %>', this)">
                      <span><%= child.icone %> <%= child.titre %></span>
                      <% if(child.protege){ %><span>🔒</span><% } %>
                    </li>
                  <% } %>
                <% }) %>
              </ul>
            </li>
          <% } else { %>
            <li class="sidebar-item" onclick="handleClick('<%= menu.id %>', '<%= menu.url %>', '<%= menu.protege ? '1' : '0' %>', this)">
              <span><%= menu.icone %> <%= menu.titre %><% if(menu.protege){ %><span class="lock">🔒</span><% } %></span>
            </li>
          <% } %>
        <% }) %>
      </ul>
    </div>

    <div class="content-pane">
      <div id="welcome-logo" class="welcome-screen">
        <img src="<%= config.logo_url %>" alt="Logo Notre Dame des Missions">
        <div class="welcome-hint">☰ Ouvrez le menu pour choisir une application</div>
      </div>
      <iframe id="main-iframe" src="about:blank" title="Espace de travail"
        allow="geolocation; microphone; camera; clipboard-write; clipboard-read; fullscreen">
      </iframe>
    </div>
  </div>

  <!-- Modal mot de passe menu -->
  <div class="modal-bg" id="modal-pwd">
    <div class="modal-box">
      <h3>🔒 Accès protégé</h3>
      <p id="modal-desc">Ce contenu est protégé par un mot de passe.</p>
      <div class="modal-error" id="modal-error">❌ Mot de passe incorrect</div>
      <input type="password" id="modal-input" placeholder="Mot de passe" onkeydown="if(event.key==='Enter')confirmPwd()">
      <div class="modal-actions">
        <button class="btn-modal btn-cancel" onclick="closeModal()">Annuler</button>
        <button class="btn-modal btn-confirm" onclick="confirmPwd()">Accéder</button>
      </div>
    </div>
  </div>

  <script>
    // État des menus déverrouillés (session)
    const unlocked = <%- JSON.stringify(menuPasswords) %>;
    let pendingMenuId = null, pendingUrl = null, pendingEl = null, pendingDropId = null;

    function toggleSidebar() {
      document.getElementById('sidebarMenu').classList.toggle('mobile-open');
      document.getElementById('sidebarOverlay').classList.toggle('mobile-open');
    }

    function toggleDropdown(dropId, menuId, protege) {
      if (protege === '1' && !unlocked[menuId]) {
        pendingMenuId = menuId;
        pendingUrl    = null;
        pendingEl     = null;
        pendingDropId = dropId;
        document.getElementById('modal-error').style.display = 'none';
        document.getElementById('modal-input').value = '';
        document.getElementById('modal-pwd').classList.add('open');
        setTimeout(() => document.getElementById('modal-input').focus(), 100);
        return;
      }
      document.querySelectorAll('.dropdown').forEach(d => { if(d.id!==dropId) d.classList.remove('open'); });
      document.getElementById(dropId).classList.toggle('open');
    }

    function handleClick(menuId, url, protege, el) {
      if (protege === '1' && !unlocked[menuId]) {
        pendingMenuId = menuId;
        pendingUrl    = url;
        pendingEl     = el;
        document.getElementById('modal-error').style.display = 'none';
        document.getElementById('modal-input').value = '';
        document.getElementById('modal-bg') || document.getElementById('modal-pwd').classList.add('open');
        document.getElementById('modal-pwd').classList.add('open');
        setTimeout(() => document.getElementById('modal-input').focus(), 100);
      } else {
        navigate(url, el);
      }
    }

    function closeModal() {
      document.getElementById('modal-pwd').classList.remove('open');
      pendingMenuId = null; pendingUrl = null; pendingEl = null; pendingDropId = null;
    }

    async function confirmPwd() {
      const pwd = document.getElementById('modal-input').value;
      const resp = await fetch('/menu/auth', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ menu_id: pendingMenuId, password: pwd })
      });
      const json = await resp.json();
      if (json.success) {
        unlocked[pendingMenuId] = true;
        // Sauvegarder avant closeModal qui remet à null
        const dropId = pendingDropId;
        const url    = pendingUrl;
        const el     = pendingEl;
        closeModal();
        if (dropId) {
          document.querySelectorAll('.dropdown').forEach(d => { if(d.id!==dropId) d.classList.remove('open'); });
          document.getElementById(dropId).classList.add('open');
        } else {
          navigate(url, el);
        }
      } else {
        document.getElementById('modal-error').style.display = 'block';
        document.getElementById('modal-input').value = '';
        document.getElementById('modal-input').focus();
      }
    }

    function navigate(url, el) {
      if (!url) return;
      document.getElementById('welcome-logo').style.display = 'none';
      document.getElementById('main-iframe').src = url;
      const open = document.getElementById('btn-open');
      open.href = url; open.style.display = 'inline-block';
      document.querySelectorAll('.sidebar-item,.submenu-item').forEach(i => i.classList.remove('active'));
      if (el) el.classList.add('active');
      if (window.innerWidth <= 768) toggleSidebar();
    }

    document.getElementById('modal-pwd').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-pwd')) closeModal();
    });
  </script>
</body>
</html>
```
<!-- SCRIPT-END:apps/portail/views/portail.ejs -->

### `apps/portail/views/admin/index.ejs`

<!-- SCRIPT-START:apps/portail/views/admin/index.ejs -->
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Administration – Portail NDM</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:#f0f2f5; color:#1a1a2e; min-height:100vh; }
    .topbar { background:#1e3c72; color:white; padding:.75rem 1.5rem; display:flex; align-items:center; justify-content:space-between; }
    .topbar h1 { font-size:1.05rem; font-weight:600; }
    .topbar-right { display:flex; gap:.5rem; flex-wrap:wrap; }
    .btn-nav { background:rgba(255,255,255,.15); border:none; color:white; padding:.35rem .8rem; border-radius:6px; cursor:pointer; font-size:.8rem; text-decoration:none; }
    .btn-nav:hover { background:rgba(255,255,255,.25); }
    .container { max-width:1000px; margin:0 auto; padding:2rem 1.5rem; }
    h2 { font-size:1.1rem; color:#1e3c72; margin-bottom:1rem; font-weight:700; }
    .card { background:white; border-radius:12px; padding:1.5rem; box-shadow:0 2px 10px rgba(0,0,0,.07); margin-bottom:1.5rem; }
    .alert { padding:.75rem 1rem; border-radius:8px; margin-bottom:1rem; font-size:.9rem; }
    .alert-success { background:#d4edda; color:#155724; }
    .form-row { display:flex; gap:.75rem; margin-bottom:.75rem; flex-wrap:wrap; }
    .form-group { display:flex; flex-direction:column; gap:.3rem; flex:1; min-width:150px; }
    .form-group label { font-size:.78rem; font-weight:600; color:#555; text-transform:uppercase; letter-spacing:.3px; }
    .form-group input, .form-group select { padding:.6rem .85rem; border:1.5px solid #ddd; border-radius:8px; font-size:.875rem; outline:none; transition:border .2s; }
    .form-group input:focus, .form-group select:focus { border-color:#1e3c72; }
    .checkbox-row { display:flex; align-items:center; gap:.5rem; margin-bottom:.75rem; }
    .checkbox-row input[type=checkbox] { width:18px; height:18px; cursor:pointer; }
    .btn { padding:.6rem 1.25rem; border-radius:8px; border:none; cursor:pointer; font-size:.875rem; font-weight:600; transition:all .2s; }
    .btn-primary { background:#1e3c72; color:white; }
    .btn-primary:hover { background:#2a52a0; }
    .btn-danger { background:#e74c3c; color:white; }
    .btn-danger:hover { background:#c0392b; }
    .btn-sm { padding:.4rem .8rem; font-size:.78rem; }
    .btn-ghost { background:#f0f0f0; color:#333; }
    .btn-ghost:hover { background:#e0e0e0; }
    .btn-order { background:#e8f0fe; color:#1e3c72; border:none; border-radius:6px; padding:.3rem .6rem; font-size:.9rem; cursor:pointer; font-weight:700; }
    .btn-order:hover { background:#c5d8f8; }
    .menu-item { background:white; border:1.5px solid #e8ecf0; border-radius:10px; margin-bottom:.6rem; overflow:hidden; }
    .menu-item-header { display:flex; align-items:center; padding:.75rem 1rem; gap:.5rem; }
    .menu-label { flex:1; font-weight:600; font-size:.9rem; display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
    .badge-protected { background:#fff3cd; color:#856404; font-size:.7rem; padding:.15rem .5rem; border-radius:20px; font-weight:600; }
    .badge-url { background:#e8f0fe; color:#1e3c72; font-size:.7rem; padding:.15rem .5rem; border-radius:20px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .menu-actions { display:flex; gap:.3rem; align-items:center; }
    .submenu-list { list-style:none; border-top:1px solid #f0f0f0; }
    .submenu-item-row { display:flex; align-items:center; padding:.6rem 1rem .6rem 2rem; gap:.5rem; border-bottom:1px solid #f7f7f7; }
    .sub-sublabel { padding:.5rem 1rem .5rem 3.5rem; font-size:.8rem; border-bottom:1px solid #f7f7f7; display:flex; align-items:center; gap:.5rem; }
    .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.5); display:none; align-items:center; justify-content:center; z-index:999; }
    .modal-bg.open { display:flex; }
    .modal-box { background:white; border-radius:14px; padding:2rem; width:500px; max-width:95vw; box-shadow:0 20px 60px rgba(0,0,0,.3); max-height:90vh; overflow-y:auto; }
    .modal-box h3 { color:#1e3c72; margin-bottom:1.25rem; font-size:1.05rem; }
    .modal-actions { display:flex; gap:.75rem; justify-content:flex-end; margin-top:1.25rem; }
    .config-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    .hint { font-size:.8rem; color:#666; margin:-.5rem 0 1rem; }
    @media (max-width:700px) {
      .topbar { flex-direction:column; align-items:flex-start; gap:.5rem; padding:.75rem 1rem; }
      .container { padding:1rem .75rem; }
      .card { padding:1rem; }
      .config-grid { grid-template-columns:1fr; }
      .menu-item-header, .submenu-item-row { flex-wrap:wrap; }
      .submenu-item-row { padding-left:1rem; }
      .sub-sublabel { padding-left:1.75rem; flex-wrap:wrap; }
      .menu-actions { width:100%; justify-content:flex-end; }
      .badge-url { max-width:100%; }
      .form-group input, .form-group select { font-size:16px; }
    }
  </style>
</head>
<body>
<div class="topbar">
  <h1>⚙️ Administration – Portail NDM</h1>
  <div class="topbar-right">
    <a href="/admin/centrale" class="btn-nav">🔐 Gestion centralisée</a>
    <a href="/" class="btn-nav">👁️ Voir le portail</a>
    <a href="/admin/logout" class="btn-nav">Déconnexion</a>
  </div>
</div>
<div class="container">
  <% if (msg) { %><div class="alert alert-success">✅ <%= msg %></div><% } %>

  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
      <h2>🗂️ Gestion des menus</h2>
      <button class="btn btn-primary btn-sm" onclick="openModal('modal-add')">+ Nouveau menu</button>
    </div>
    <p class="hint">ℹ️ L'adresse des menus « Fiche Sanitaire », « Suivi des voyages » et « Fiche Infirmerie » est définie dans <code>/opt/ndm-sante/.env</code> (URL_FICHESANITAIRE, URL_VOYAGES, URL_INFIRMERIE) et réappliquée à chaque redémarrage.</p>
    <ul style="list-style:none;padding:0;margin:0" id="menu-tree">
      <% menus.forEach(menu => { %>
      <li class="menu-item" data-id="<%= menu.id %>">
        <div class="menu-item-header">
          <span class="menu-label">
            <%= menu.icone %> <%= menu.titre %>
            <% if (menu.protege) { %><span class="badge-protected">🔒 Protégé</span><% } %>
            <% if (menu.url) { %><span class="badge-url"><%= menu.url %></span><% } %>
          </span>
          <div class="menu-actions">
            <button class="btn-order" onclick="deplacer('<%= menu.id %>','up')" title="Monter">↑</button>
            <button class="btn-order" onclick="deplacer('<%= menu.id %>','down')" title="Descendre">↓</button>
            <button class="btn btn-ghost btn-sm" onclick="openEdit('<%= menu.id %>','<%= menu.titre.replace(/'/g,`\\'`) %>','<%= menu.icone %>','<%= (menu.url||'').replace(/'/g,`\\'`) %>','','<%= menu.ordre %>','<%= menu.protege ? 1 : 0 %>')">✏️</button>
            <form method="POST" action="/admin/menus/<%= menu.id %>/supprimer" style="display:inline" onsubmit="return confirm('Supprimer ce menu ?')">
              <button type="submit" class="btn btn-danger btn-sm">🗑️</button>
            </form>
          </div>
        </div>
        <% if (menu.children && menu.children.length > 0) { %>
        <ul class="submenu-list">
          <% menu.children.forEach(child => { %>
          <li>
            <div class="submenu-item-row">
              <span class="menu-label" style="font-size:.875rem">
                <%= child.icone %> <%= child.titre %>
                <% if (child.protege) { %><span class="badge-protected">🔒 Protégé</span><% } %>
                <% if (child.url) { %><span class="badge-url"><%= child.url %></span><% } %>
              </span>
              <div class="menu-actions">
                <button class="btn-order" onclick="deplacer('<%= child.id %>','up')">↑</button>
                <button class="btn-order" onclick="deplacer('<%= child.id %>','down')">↓</button>
                <button class="btn btn-ghost btn-sm" onclick="openEdit('<%= child.id %>','<%= child.titre.replace(/'/g,`\\'`) %>','<%= child.icone %>','<%= (child.url||'').replace(/'/g,`\\'`) %>','<%= child.parent_id %>','<%= child.ordre %>','<%= child.protege ? 1 : 0 %>')">✏️</button>
                <form method="POST" action="/admin/menus/<%= child.id %>/supprimer" style="display:inline" onsubmit="return confirm('Supprimer ?')">
                  <button type="submit" class="btn btn-danger btn-sm">🗑️</button>
                </form>
              </div>
            </div>
            <% if (child.children && child.children.length > 0) { %>
            <% child.children.forEach(sub => { %>
            <div class="sub-sublabel">
              <span style="flex:1"><%= sub.icone %> <%= sub.titre %> <% if(sub.url){%><span class="badge-url"><%= sub.url %></span><%}%></span>
              <button class="btn-order" onclick="deplacer('<%= sub.id %>','up')">↑</button>
              <button class="btn-order" onclick="deplacer('<%= sub.id %>','down')">↓</button>
              <button class="btn btn-ghost btn-sm" onclick="openEdit('<%= sub.id %>','<%= sub.titre.replace(/'/g,`\\'`) %>','<%= sub.icone %>','<%= (sub.url||'').replace(/'/g,`\\'`) %>','<%= sub.parent_id %>','<%= sub.ordre %>','<%= sub.protege ? 1 : 0 %>')">✏️</button>
              <form method="POST" action="/admin/menus/<%= sub.id %>/supprimer" style="display:inline" onsubmit="return confirm('Supprimer ?')">
                <button type="submit" class="btn btn-danger btn-sm">🗑️</button>
              </form>
            </div>
            <% }) %>
            <% } %>
          </li>
          <% }) %>
        </ul>
        <% } %>
      </li>
      <% }) %>
    </ul>
  </div>

  <div class="card">
    <h2>⚙️ Configuration du portail</h2>
    <form method="POST" action="/admin/config">
      <div class="config-grid">
        <div class="form-group"><label>Titre du portail</label><input type="text" name="titre" value="<%= config.titre %>"></div>
        <div class="form-group"><label>URL du logo</label><input type="url" name="logo_url" value="<%= config.logo_url %>"></div>
        <div class="form-group"><label>Nouveau mot de passe admin</label><input type="password" name="nouveau_mdp_admin" placeholder="Laisser vide pour ne pas changer"></div>
      </div>
      <div style="margin-top:1rem"><button type="submit" class="btn btn-primary">💾 Sauvegarder</button></div>
    </form>
  </div>
</div>

<!-- Modal Ajouter -->
<div class="modal-bg" id="modal-add">
  <div class="modal-box">
    <h3>➕ Nouveau menu</h3>
    <form method="POST" action="/admin/menus">
      <div class="form-row">
        <div class="form-group" style="flex:2"><label>Titre *</label><input type="text" name="titre" required placeholder="Ex: Séjour scolaire"></div>
        <div class="form-group" style="flex:0.5"><label>Icône</label><input type="text" name="icone" placeholder="🗺️"></div>
        <div class="form-group" style="flex:0.5"><label>Ordre</label><input type="number" name="ordre" value="0" min="0"></div>
      </div>
      <div class="form-group" style="margin-bottom:.75rem"><label>URL (vide si menu parent)</label><input type="text" name="url" placeholder="https://..."></div>
      <div class="form-group" style="margin-bottom:.75rem">
        <label>Menu parent</label>
        <select name="parent_id">
          <option value="">-- Aucun (menu principal) --</option>
          <% allMenus.forEach(m => { %><option value="<%= m.id %>"><%= m.icone %> <%= m.titre %></option><% }) %>
        </select>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" name="protege" id="add-protege" value="1" onchange="document.getElementById('add-pwd-group').style.display=this.checked?'flex':'none'">
        <label for="add-protege">🔒 Protéger par un mot de passe</label>
      </div>
      <div class="form-group" id="add-pwd-group" style="display:none;margin-bottom:.75rem">
        <label>Mot de passe du menu</label>
        <input type="password" name="mot_de_passe" placeholder="Mot de passe">
      </div>
      <div class="modal-actions">
        <button type="button" onclick="closeModal('modal-add')" class="btn btn-ghost">Annuler</button>
        <button type="submit" class="btn btn-primary">Créer</button>
      </div>
    </form>
  </div>
</div>

<!-- Modal Modifier -->
<div class="modal-bg" id="modal-edit">
  <div class="modal-box">
    <h3>✏️ Modifier le menu</h3>
    <form method="POST" id="edit-form" action="">
      <div class="form-row">
        <div class="form-group" style="flex:2"><label>Titre *</label><input type="text" name="titre" id="edit-titre" required></div>
        <div class="form-group" style="flex:0.5"><label>Icône</label><input type="text" name="icone" id="edit-icone"></div>
        <div class="form-group" style="flex:0.5"><label>Ordre</label><input type="number" name="ordre" id="edit-ordre" min="0"></div>
      </div>
      <div class="form-group" style="margin-bottom:.75rem"><label>URL</label><input type="text" name="url" id="edit-url" placeholder="https://..."></div>
      <div class="form-group" style="margin-bottom:.75rem">
        <label>Menu parent</label>
        <select name="parent_id" id="edit-parent">
          <option value="">-- Aucun (menu principal) --</option>
          <% allMenus.forEach(m => { %><option value="<%= m.id %>"><%= m.icone %> <%= m.titre %></option><% }) %>
        </select>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" name="protege" id="edit-protege" value="1" onchange="document.getElementById('edit-pwd-group').style.display=this.checked?'flex':'none'">
        <label for="edit-protege">🔒 Protéger par un mot de passe</label>
      </div>
      <div class="form-group" id="edit-pwd-group" style="display:none;margin-bottom:.75rem">
        <label>Nouveau mot de passe (vide = conserver)</label>
        <input type="password" name="mot_de_passe" placeholder="Nouveau mot de passe">
      </div>
      <div class="modal-actions">
        <button type="button" onclick="closeModal('modal-edit')" class="btn btn-ghost">Annuler</button>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </div>
    </form>
  </div>
</div>

<script>
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-bg').forEach(m => {
  m.addEventListener('click', e => { if(e.target===m) m.classList.remove('open'); });
});
document.addEventListener('keydown', e => {
  if(e.key==='Escape') document.querySelectorAll('.modal-bg.open').forEach(m=>m.classList.remove('open'));
});

function openEdit(id, titre, icone, url, parentId, ordre, protege) {
  document.getElementById('edit-form').action = '/admin/menus/' + id + '/modifier';
  document.getElementById('edit-titre').value = titre;
  document.getElementById('edit-icone').value = icone;
  document.getElementById('edit-url').value   = url;
  document.getElementById('edit-ordre').value = ordre;
  document.getElementById('edit-parent').value = parentId || '';
  const cb = document.getElementById('edit-protege');
  cb.checked = protege === '1';
  document.getElementById('edit-pwd-group').style.display = cb.checked ? 'flex' : 'none';
  openModal('modal-edit');
}

async function deplacer(id, direction) {
  const resp = await fetch('/admin/menus/deplacer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, direction })
  });
  const json = await resp.json();
  if (json.success) location.reload();
  else alert('Erreur : ' + (json.error || 'inconnue'));
}
</script>
</body>
</html>
```
<!-- SCRIPT-END:apps/portail/views/admin/index.ejs -->

### `apps/portail/views/admin/centrale.ejs`

<!-- SCRIPT-START:apps/portail/views/admin/centrale.ejs -->
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">
  <title>Gestion centralisée – Portail NDM</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:#f0f2f5; color:#1a1a2e; min-height:100vh; }
    .topbar { background:#1e3c72; color:white; padding:.75rem 1.5rem; display:flex; align-items:center; justify-content:space-between; gap:.75rem; flex-wrap:wrap; }
    .topbar h1 { font-size:1.05rem; font-weight:600; }
    .topbar-right { display:flex; gap:.5rem; flex-wrap:wrap; }
    .btn-nav { background:rgba(255,255,255,.15); color:white; padding:.4rem .8rem; border-radius:6px; font-size:.8rem; text-decoration:none; }
    .btn-nav:hover { background:rgba(255,255,255,.25); }
    .container { max-width:1100px; margin:0 auto; padding:1.5rem; }
    .card { background:white; border-radius:12px; padding:1.25rem 1.5rem; box-shadow:0 2px 10px rgba(0,0,0,.07); margin-bottom:1.25rem; }
    h2 { font-size:1.08rem; color:#1e3c72; margin-bottom:.6rem; }
    p.aide { font-size:.83rem; color:#555; margin-bottom:1rem; line-height:1.45; }
    .alert { padding:.75rem 1rem; border-radius:8px; margin-bottom:1rem; font-size:.9rem; line-height:1.4; }
    .ok { background:#d4edda; color:#155724; } .ko { background:#fdecea; color:#8a1c12; }
    .btn { padding:.55rem 1.1rem; border-radius:8px; border:none; cursor:pointer; font-size:.86rem; font-weight:600; }
    .btn-primary { background:#1e3c72; color:white; } .btn-primary:hover { background:#2a52a0; }
    .btn-ghost { background:#eef1f6; color:#1e3c72; } .btn-ghost:hover { background:#dfe5ef; }
    .btn-sm { padding:.38rem .75rem; font-size:.78rem; }
    input[type=text], input[type=search], input[type=password] { width:100%; padding:.62rem .85rem; border:1.5px solid #d7dbe2; border-radius:8px; font-size:16px; outline:none; }
    input:focus { border-color:#1e3c72; }
    .noms { display:grid; grid-template-columns:repeat(4,1fr); gap:.6rem; margin:.25rem 0 1rem; }
    .nom { border:1px solid #e6e9ef; border-radius:10px; padding:.6rem .75rem; font-size:.8rem; }
    .nom b { display:block; color:#1e3c72; margin-bottom:.2rem; }
    .nom .v { color:#333; word-break:break-word; }
    .pill { display:inline-block; font-size:.68rem; padding:.1rem .5rem; border-radius:20px; font-weight:700; margin-top:.35rem; }
    .p-ok { background:#e3f6e8; color:#1d6b33; } .p-diff { background:#fff4d6; color:#7a5800; } .p-ko { background:#fdecea; color:#8a1c12; }
    .row-form { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; }
    .row-form input[type=text] { flex:1; min-width:220px; }
    .check { display:flex; align-items:center; gap:.4rem; font-size:.83rem; margin-top:.6rem; }
    .tabs { display:flex; gap:.4rem; flex-wrap:wrap; margin-bottom:.9rem; }
    .tab { border:1.5px solid #d7dbe2; background:white; padding:.45rem .85rem; border-radius:20px; font-size:.82rem; cursor:pointer; font-weight:600; color:#444; }
    .tab.active { background:#1e3c72; color:white; border-color:#1e3c72; }
    .tab .n { font-weight:400; opacity:.8; }
    .panel { display:none; } .panel.active { display:block; }
    .groupe { font-size:.72rem; text-transform:uppercase; letter-spacing:.5px; color:#70809a; margin:1rem 0 .35rem; font-weight:700; }
    .compte { display:flex; align-items:center; gap:.75rem; padding:.6rem .2rem; border-bottom:1px solid #f0f2f5; }
    .compte .t { flex:1; min-width:0; }
    .compte .t b { font-size:.88rem; display:block; overflow-wrap:anywhere; }
    .compte .t span { font-size:.76rem; color:#666; overflow-wrap:anywhere; }
    .badge { font-size:.68rem; background:#fff4d6; color:#7a5800; padding:.1rem .45rem; border-radius:20px; font-weight:700; margin-left:.3rem; white-space:nowrap; }
    .vide { font-size:.85rem; color:#777; padding:.5rem 0; }
    table { width:100%; border-collapse:collapse; font-size:.8rem; }
    td { padding:.45rem .3rem; border-bottom:1px solid #f0f2f5; vertical-align:top; }
    td.d { white-space:nowrap; color:#666; width:1%; }
    .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.5); display:none; align-items:center; justify-content:center; z-index:50; padding:1rem; }
    .modal-bg.open { display:flex; }
    .modal { background:white; border-radius:14px; padding:1.5rem; width:460px; max-width:100%; box-shadow:0 20px 60px rgba(0,0,0,.3); }
    .modal h3 { color:#1e3c72; font-size:1rem; margin-bottom:.3rem; }
    .modal .sous { font-size:.8rem; color:#666; margin-bottom:1rem; overflow-wrap:anywhere; }
    .pwd-row { display:flex; gap:.4rem; }
    .pwd-row input { flex:1; font-family:ui-monospace,Consolas,monospace; }
    .modal .actions { display:flex; gap:.6rem; justify-content:flex-end; margin-top:1.1rem; flex-wrap:wrap; }
    .resultat { margin-top:.9rem; font-size:.84rem; display:none; }
    .force { font-size:.75rem; margin-top:.4rem; color:#666; }
    @media (max-width:800px) { .noms { grid-template-columns:1fr 1fr; } }
    @media (max-width:560px) {
      .container { padding:1rem .7rem; } .card { padding:1rem; }
      .noms { grid-template-columns:1fr; }
      .compte { flex-wrap:wrap; } .compte .btn { width:100%; }
      .row-form .btn { width:100%; }
      td.d { white-space:normal; }
    }
  </style>
</head>
<body>
<div class="topbar">
  <h1>🔐 Gestion centralisée – Portail NDM</h1>
  <div class="topbar-right">
    <a href="/admin" class="btn-nav">← Menus du portail</a>
    <a href="/" class="btn-nav">👁️ Voir le portail</a>
    <a href="/admin/logout" class="btn-nav">Déconnexion</a>
  </div>
</div>

<div class="container">
  <% if (msg) { %><div class="alert ok">✅ <%= msg %></div><% } %>
  <% if (err) { %><div class="alert ko">⚠️ <%= err %></div><% } %>

  <!-- ============================ ÉTABLISSEMENT ============================ -->
  <div class="card">
    <h2>🏫 Nom de l'établissement</h2>
    <p class="aide">Modifié ici, le nom est appliqué en une fois à la <b>Fiche Sanitaire</b> (fiches, PDF, relances), à la <b>Fiche Infirmerie</b> (en-tête, PDF), au <b>Suivi des Voyages</b> (en-tête, pied de page, voyages existants qui portaient l'ancien nom) et, si vous cochez la case, au titre du <b>portail</b>.</p>
    <div class="noms">
      <% const lib = { portail:'Portail (titre)', fichesanitaire:'Fiche Sanitaire', infirmerie:'Fiche Infirmerie', voyages:'Suivi des Voyages' };
         Object.keys(lib).forEach(k => { const n = noms[k]; %>
        <div class="nom">
          <b><%= lib[k] %></b>
          <% if (!n.ok) { %><span class="pill p-ko">injoignable</span><div class="v" style="font-size:.72rem;color:#8a1c12;margin-top:.3rem"><%= n.error %></div>
          <% } else { %><div class="v"><%= n.valeur || '—' %></div>
            <% if (k !== 'portail') { %><span class="pill <%= (central && n.valeur === central) ? 'p-ok' : 'p-diff' %>"><%= (central && n.valeur === central) ? 'à jour' : 'différent' %></span><% } %>
          <% } %>
        </div>
      <% }) %>
    </div>
    <form method="POST" action="/admin/centrale/etablissement" onsubmit="return confirm('Appliquer ce nom aux 4 applications ?')">
      <div class="row-form">
        <input type="text" name="nom" value="<%= central %>" minlength="3" maxlength="150" required placeholder="Ex : Ensemble Scolaire Notre-Dame des Missions">
        <button class="btn btn-primary" type="submit">Appliquer partout</button>
      </div>
      <label class="check"><input type="checkbox" name="maj_titre" value="1"> Mettre aussi à jour le titre du portail (« Portail de santé – nom »)</label>
    </form>
  </div>

  <!-- ============================ MOTS DE PASSE ============================ -->
  <div class="card">
    <h2>🔑 Mots de passe de toutes les applications</h2>
    <p class="aide">Définissez un nouveau mot de passe pour n'importe quel compte (au moins <%= minLen %> caractères). Le bouton <b>Générer</b> propose un mot de passe robuste : <b>notez-le avant de fermer</b>, il n'est affiché qu'une fois et n'est jamais enregistré en clair dans le portail. Les sessions ouvertes du compte concerné sont fermées (Fiche Infirmerie). Chaque changement est inscrit au journal ci-dessous.</p>
    <% const ordre = [['portail','Portail'],['fichesanitaire','Fiche Sanitaire'],['infirmerie','Fiche Infirmerie'],['voyages','Suivi des Voyages']]; %>
    <div class="tabs">
      <% ordre.forEach(([k, l], i) => { %>
        <button type="button" class="tab <%= i === 0 ? 'active' : '' %>" data-tab="<%= k %>"><%= l %> <span class="n">(<%= comptes[k].lignes.length %>)</span></button>
      <% }) %>
    </div>
    <input type="search" id="filtre" placeholder="🔎 Rechercher un compte (nom, e-mail…)" style="margin-bottom:.4rem">
    <% ordre.forEach(([k, l], i) => { const c = comptes[k]; let g = null; %>
      <div class="panel <%= i === 0 ? 'active' : '' %>" id="panel-<%= k %>">
        <% if (!c.ok) { %><div class="alert ko">Application injoignable : <%= c.error %></div><% } %>
        <% if (c.ok && !c.lignes.length) { %><div class="vide">Aucun compte.</div><% } %>
        <% c.lignes.forEach(x => { if (x.groupe && x.groupe !== g) { g = x.groupe; %><div class="groupe"><%= g %></div><% } %>
          <div class="compte" data-texte="<%= (x.titre + ' ' + (x.detail || '')).toLowerCase() %>">
            <div class="t"><b><%= x.titre %><% if (x.badge) { %><span class="badge"><%= x.badge %></span><% } %></b><span><%= x.detail %></span></div>
            <button type="button" class="btn btn-ghost btn-sm js-mdp" data-app="<%= k %>" data-type="<%= x.type %>" data-id="<%= x.id %>" data-libelle="<%= l %> › <%= x.titre %>" data-detail="<%= x.detail %>">Changer le mot de passe</button>
          </div>
        <% }) %>
      </div>
    <% }) %>
  </div>

  <!-- ============================ JOURNAL ============================ -->
  <div class="card">
    <h2>📜 Journal des actions (60 dernières)</h2>
    <% if (!journal.length) { %><div class="vide">Aucune action enregistrée.</div><% } else { %>
    <table>
      <% journal.forEach(j => { %>
        <tr><td class="d"><%= new Date(j.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) %></td><td><%= j.action %> <span style="color:#999">— <%= j.ip %></span></td></tr>
      <% }) %>
    </table>
    <% } %>
  </div>
</div>

<!-- Fenêtre de changement de mot de passe -->
<div class="modal-bg" id="modal">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-titre">
    <h3 id="m-titre">Nouveau mot de passe</h3>
    <div class="sous" id="m-sous"></div>
    <div class="pwd-row">
      <input type="password" id="m-pwd" autocomplete="new-password" minlength="<%= minLen %>" maxlength="128" placeholder="Nouveau mot de passe">
      <button type="button" class="btn btn-ghost btn-sm" id="m-voir" title="Afficher / masquer">👁️</button>
    </div>
    <div class="force" id="m-force"></div>
    <div class="actions">
      <button type="button" class="btn btn-ghost" id="m-gen">🎲 Générer</button>
      <button type="button" class="btn btn-ghost" id="m-copier">📋 Copier</button>
      <button type="button" class="btn btn-ghost" id="m-annuler">Fermer</button>
      <button type="button" class="btn btn-primary" id="m-ok">Enregistrer</button>
    </div>
    <div class="resultat alert" id="m-res"></div>
  </div>
</div>

<script>
(function () {
  var MIN = <%= minLen %>;
  var cible = null;
  var $ = function (id) { return document.getElementById(id); };

  // Onglets
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('active', x === b); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'panel-' + b.dataset.tab); });
    });
  });
  // Recherche
  $('filtre').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    document.querySelectorAll('.compte').forEach(function (c) { c.style.display = !q || c.dataset.texte.indexOf(q) !== -1 ? '' : 'none'; });
  });

  function generer() {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', s = '-_!*';
    var r = new Uint32Array(16); crypto.getRandomValues(r);
    var out = '';
    for (var i = 0; i < 14; i++) out += a[r[i] % a.length];
    return out.slice(0, 7) + s[r[14] % s.length] + out.slice(7) ;
  }
  function force() {
    var v = $('m-pwd').value, n = 0;
    if (v.length >= MIN) n++; if (v.length >= 12) n++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) n++; if (/\d/.test(v)) n++; if (/[^A-Za-z0-9]/.test(v)) n++;
    $('m-force').textContent = v ? (v.length < MIN ? '⚠️ Trop court (' + MIN + ' caractères minimum)' : 'Robustesse : ' + ['faible', 'faible', 'moyenne', 'bonne', 'très bonne', 'excellente'][n]) : '';
  }
  function ouvrir(btn) {
    cible = btn.dataset;
    $('m-sous').textContent = cible.libelle + (cible.detail ? ' — ' + cible.detail : '');
    $('m-pwd').value = ''; $('m-pwd').type = 'password';
    $('m-res').style.display = 'none'; $('m-ok').disabled = false; force();
    $('modal').classList.add('open');
    setTimeout(function () { $('m-pwd').focus(); }, 50);
  }
  function fermer() { $('modal').classList.remove('open'); $('m-pwd').value = ''; cible = null; }

  document.querySelectorAll('.js-mdp').forEach(function (b) { b.addEventListener('click', function () { ouvrir(b); }); });
  $('m-annuler').addEventListener('click', fermer);
  $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) fermer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
  $('m-voir').addEventListener('click', function () { $('m-pwd').type = $('m-pwd').type === 'password' ? 'text' : 'password'; });
  $('m-gen').addEventListener('click', function () { $('m-pwd').value = generer(); $('m-pwd').type = 'text'; force(); });
  $('m-copier').addEventListener('click', function () {
    var v = $('m-pwd').value; if (!v) return;
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { $('m-force').textContent = '📋 Copié dans le presse-papiers'; }).catch(function () { $('m-pwd').type = 'text'; $('m-pwd').select(); });
  });
  $('m-pwd').addEventListener('input', force);
  $('m-pwd').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('m-ok').click(); });

  $('m-ok').addEventListener('click', function () {
    var v = $('m-pwd').value;
    if (!cible) return;
    if (v.length < MIN) { force(); return; }
    $('m-ok').disabled = true;
    fetch('/admin/centrale/mot-de-passe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store',
      body: JSON.stringify({ app: cible.app, type: cible.type, id: cible.id, libelle: cible.libelle, password: v })
    }).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Réponse invalide (HTTP ' + r.status + ')' }; }); })
      .then(function (j) {
        var el = $('m-res'); el.style.display = 'block';
        el.className = 'resultat alert ' + (j.ok ? 'ok' : 'ko');
        el.textContent = j.ok ? '✅ ' + j.message + ' Communiquez le nouveau mot de passe à la personne concernée.' : '⚠️ ' + j.error;
        if (!j.ok) $('m-ok').disabled = false;
      })
      .catch(function (e) { var el = $('m-res'); el.style.display = 'block'; el.className = 'resultat alert ko'; el.textContent = '⚠️ ' + e.message; $('m-ok').disabled = false; });
  });
})();
</script>
</body>
</html>
```
<!-- SCRIPT-END:apps/portail/views/admin/centrale.ejs -->

### `apps/portail/views/admin/login.ejs`

<!-- SCRIPT-START:apps/portail/views/admin/login.ejs -->
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Administration – Portail NDM</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
           background:#1e3c72; min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .card { background:white; border-radius:18px; padding:2.5rem 2rem; width:380px; max-width:92vw;
            box-shadow:0 25px 70px rgba(0,0,0,.35); text-align:center; }
    h1 { font-size:1.2rem; color:#1e3c72; font-weight:700; margin-bottom:.25rem; }
    .subtitle { font-size:.85rem; color:#888; margin-bottom:1.75rem; }
    input { width:100%; padding:.8rem 1rem; border:2px solid #e0e0e0; border-radius:10px;
            font-size:1rem; margin-bottom:1rem; outline:none; transition:border .2s; }
    input:focus { border-color:#1e3c72; }
    button { width:100%; padding:.8rem; background:#1e3c72; color:white; border:none;
             border-radius:10px; font-size:1rem; font-weight:600; cursor:pointer; }
    button:hover { background:#2a52a0; }
    .error { color:#c0392b; font-size:.85rem; margin-top:.75rem;
             background:#fdf0f0; padding:.6rem .9rem; border-radius:8px; }
    .back { display:block; margin-top:1rem; font-size:.8rem; color:#888; text-decoration:none; }
    .back:hover { color:#1e3c72; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:2.5rem;margin-bottom:1rem">⚙️</div>
    <h1>Administration</h1>
    <p class="subtitle">Portail Notre Dame des Missions</p>
    <form method="POST" action="/admin/login">
      <input type="password" name="password" placeholder="Mot de passe administrateur" autofocus required>
      <button type="submit">Se connecter</button>
      <% if (typeof bloque !== 'undefined' && bloque) { %><div class="error">⛔ Trop d'essais infructueux : réessayez dans <%= bloque %> min.</div>
      <% } else if (error) { %><div class="error">❌ Mot de passe incorrect</div><% } %>
    </form>
    <a href="/" class="back">← Retour au portail</a>
  </div>
</body>
</html>
```
<!-- SCRIPT-END:apps/portail/views/admin/login.ejs -->

### `apps/portail/views/login.ejs`

<!-- SCRIPT-START:apps/portail/views/login.ejs -->
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <title>Connexion – <%= config.titre %></title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
           background:#1e3c72; min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .card { background:white; border-radius:18px; padding:2.5rem 2rem; width:380px; max-width:92vw;
            box-shadow:0 25px 70px rgba(0,0,0,.35); text-align:center; }
    .logo { width:90px; height:90px; object-fit:contain; margin-bottom:1rem; border-radius:50%; }
    h1 { font-size:1.1rem; color:#1e3c72; font-weight:700; margin-bottom:.25rem; }
    .subtitle { font-size:.85rem; color:#888; margin-bottom:1.75rem; }
    input { width:100%; padding:.8rem 1rem; border:2px solid #e0e0e0; border-radius:10px;
            font-size:1rem; margin-bottom:1rem; outline:none; transition:border .2s; }
    input:focus { border-color:#1e3c72; }
    button { width:100%; padding:.8rem; background:#1e3c72; color:white; border:none;
             border-radius:10px; font-size:1rem; font-weight:600; cursor:pointer; transition:background .2s; }
    button:hover { background:#2a52a0; }
    .error { color:#c0392b; font-size:.85rem; margin-top:.75rem;
             background:#fdf0f0; padding:.6rem .9rem; border-radius:8px; }
    .footer { font-size:.75rem; color:#bbb; margin-top:1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <img class="logo" src="<%= config.logo_url %>" alt="Logo NDM">
    <h1><%= config.titre %></h1>
    <p class="subtitle">Accès réservé au personnel autorisé</p>
    <form method="POST" action="/login">
      <input type="password" name="password" placeholder="Mot de passe" autofocus required>
      <button type="submit">Accéder au portail</button>
      <% if (error) { %><div class="error">❌ Mot de passe incorrect</div><% } %>
    </form>
    <p class="footer">Notre Dame des Missions – 2026-2027</p>
  </div>
</body>
</html>
```
<!-- SCRIPT-END:apps/portail/views/login.ejs -->

## C. Liste complète des fichiers du projet

```text
    3650  .env.example
     223  .gitignore
  189713  README.md
       6  VERSION
      89  apps/fichesanitaire/.dockerignore
    1315  apps/fichesanitaire/.env.example
      59  apps/fichesanitaire/.gitignore
     736  apps/fichesanitaire/Dockerfile
    1016  apps/fichesanitaire/index.html
     998  apps/fichesanitaire/package.json
   40281  apps/fichesanitaire/server/auth.js
    3521  apps/fichesanitaire/server/changelog.js
    9310  apps/fichesanitaire/server/changelog.json
   79035  apps/fichesanitaire/server/index.js
   41042  apps/fichesanitaire/src/App.tsx
  187041  apps/fichesanitaire/src/components/AdminSpace.tsx
    1648  apps/fichesanitaire/src/components/AnonymousPopups.tsx
  100303  apps/fichesanitaire/src/components/CerfaEditor.tsx
   49170  apps/fichesanitaire/src/components/CerfaOfficialView.tsx
    6510  apps/fichesanitaire/src/components/ChangelogPanel.tsx
   39318  apps/fichesanitaire/src/components/CommunicationCenter.tsx
   18114  apps/fichesanitaire/src/components/Header.tsx
   12148  apps/fichesanitaire/src/components/LoginModal.tsx
    8151  apps/fichesanitaire/src/components/MagicLinkAccess.tsx
   64223  apps/fichesanitaire/src/components/OrganizerSpace.tsx
    6776  apps/fichesanitaire/src/components/ParentPasswordModal.tsx
   39275  apps/fichesanitaire/src/components/ParentSpace.tsx
    6166  apps/fichesanitaire/src/components/PdfRegenerator.tsx
    2910  apps/fichesanitaire/src/components/PopupModal.tsx
   18574  apps/fichesanitaire/src/components/RgpdPanel.tsx
    3467  apps/fichesanitaire/src/components/ScrollButtons.tsx
    5134  apps/fichesanitaire/src/components/SignaturePad.tsx
   48328  apps/fichesanitaire/src/components/StartupAuthGate.tsx
   29179  apps/fichesanitaire/src/components/TripHealthListModal.tsx
    4827  apps/fichesanitaire/src/components/WelcomeSettings.tsx
    9912  apps/fichesanitaire/src/components/YearEndPanel.tsx
    4517  apps/fichesanitaire/src/index.css
    1174  apps/fichesanitaire/src/main.tsx
   11968  apps/fichesanitaire/src/mockData.ts
    6037  apps/fichesanitaire/src/types.ts
    4637  apps/fichesanitaire/src/utils/attachments.ts
   13436  apps/fichesanitaire/src/utils/auth.ts
    6805  apps/fichesanitaire/src/utils/cerfaValidation.ts
    3417  apps/fichesanitaire/src/utils/documentViewer.ts
    5382  apps/fichesanitaire/src/utils/messaging.ts
   30993  apps/fichesanitaire/src/utils/organizerPdf.ts
   49921  apps/fichesanitaire/src/utils/pdfGenerator.ts
    1726  apps/fichesanitaire/src/utils/pdfSafe.ts
    4258  apps/fichesanitaire/src/utils/signatureImage.ts
     800  apps/fichesanitaire/src/utils/sortUsers.ts
   26475  apps/fichesanitaire/src/utils/storage.ts
     508  apps/fichesanitaire/tsconfig.json
     708  apps/fichesanitaire/vite.config.ts
      89  apps/infirmerie/.dockerignore
     633  apps/infirmerie/.env.example
      80  apps/infirmerie/.gitignore
   14215  apps/infirmerie/CAHIER_DES_CHARGES_RGPD.md
   14219  apps/infirmerie/CAHIER_DES_CHARGES_RGPD_DEFAULT.md
    1182  apps/infirmerie/Dockerfile
     618  apps/infirmerie/docker-entrypoint.sh
    1765  apps/infirmerie/index.html
     417  apps/infirmerie/metadata.json
    1243  apps/infirmerie/package.json
   14219  apps/infirmerie/public/CAHIER_DES_CHARGES_RGPD.md
       2  apps/infirmerie/public/assets/aistudio/.gitignore
    3861  apps/infirmerie/public/logo.svg
   69141  apps/infirmerie/server.ts
   26905  apps/infirmerie/src/App.tsx
   71058  apps/infirmerie/src/components/AdminDashboard.tsx
    8017  apps/infirmerie/src/components/AdminLoginCard.tsx
   13449  apps/infirmerie/src/components/AuthorizationSection.tsx
    9333  apps/infirmerie/src/components/ChangeStaffPasswordModal.tsx
   11117  apps/infirmerie/src/components/ClassManagementModal.tsx
    7501  apps/infirmerie/src/components/ConfirmationSuccess.tsx
    4327  apps/infirmerie/src/components/EditStudentClassModal.tsx
   29435  apps/infirmerie/src/components/FicheDocumentPreview.tsx
    7552  apps/infirmerie/src/components/Header.tsx
   14601  apps/infirmerie/src/components/HealthFormSection.tsx
   27470  apps/infirmerie/src/components/ParentAuthCard.tsx
   14663  apps/infirmerie/src/components/ReviewModalOrStep.tsx
   70124  apps/infirmerie/src/components/RgpdComplianceView.tsx
   10220  apps/infirmerie/src/components/SchoolBrandingModal.tsx
    8398  apps/infirmerie/src/components/SignaturePad.tsx
   22287  apps/infirmerie/src/components/StudentFormSection.tsx
   12510  apps/infirmerie/src/components/VaccinationUpload.tsx
      23  apps/infirmerie/src/index.css
     384  apps/infirmerie/src/main.tsx
    6340  apps/infirmerie/src/types.ts
    3358  apps/infirmerie/src/utils/apiAuth.ts
    4160  apps/infirmerie/src/utils/logoHelper.ts
   29063  apps/infirmerie/src/utils/pdfGenerator.ts
   11762  apps/infirmerie/src/utils/rgpdPdfGenerator.ts
     538  apps/infirmerie/tsconfig.json
     744  apps/infirmerie/vite.config.ts
      89  apps/portail/.dockerignore
      25  apps/portail/.gitignore
     480  apps/portail/Dockerfile
   10278  apps/portail/centrale.js
   40396  apps/portail/package-lock.json
     366  apps/portail/package.json
   19750  apps/portail/server.js
   15879  apps/portail/views/admin/centrale.ejs
   15918  apps/portail/views/admin/index.ejs
    2211  apps/portail/views/admin/login.ejs
    2197  apps/portail/views/login.ejs
   14145  apps/portail/views/portail.ejs
      89  apps/voyages/.dockerignore
    1890  apps/voyages/.env.example
      94  apps/voyages/.gitignore
     942  apps/voyages/Dockerfile
    1319  apps/voyages/index.html
  182645  apps/voyages/package-lock.json
    1078  apps/voyages/package.json
   42991  apps/voyages/server.ts
   25101  apps/voyages/server/attachments.ts
    4248  apps/voyages/server/auth.ts
  138411  apps/voyages/server/db.ts
   10453  apps/voyages/src/App.tsx
   82746  apps/voyages/src/components/AdminDocuSealManager.tsx
    8029  apps/voyages/src/components/AdminLoginModal.tsx
   11040  apps/voyages/src/components/ConsultationPasswordModal.tsx
    8318  apps/voyages/src/components/Header.tsx
   23352  apps/voyages/src/components/MassRelanceModal.tsx
   22709  apps/voyages/src/components/PdfExportModal.tsx
   13449  apps/voyages/src/components/PiecesJointesAdminModal.tsx
    6582  apps/voyages/src/components/PiecesJointesSection.tsx
    7823  apps/voyages/src/components/PurgeStudentsModal.tsx
   28013  apps/voyages/src/components/StudentDetailModal.tsx
    6896  apps/voyages/src/components/SyncLogsView.tsx
   82396  apps/voyages/src/components/TeacherDashboard.tsx
    5503  apps/voyages/src/components/TripPasswordModal.tsx
    1498  apps/voyages/src/index.css
     302  apps/voyages/src/main.tsx
    7379  apps/voyages/src/piecesConfig.ts
    4020  apps/voyages/src/types.ts
    3746  apps/voyages/src/utils/apiFetch.ts
    1135  apps/voyages/src/utils/etablissement.ts
    8734  apps/voyages/src/utils/excelGenerator.ts
   12724  apps/voyages/src/utils/pdfGenerator.ts
    1251  apps/voyages/src/utils/storage.ts
     508  apps/voyages/tsconfig.json
     387  apps/voyages/vite.config.ts
    6016  docker-compose.yml
   33918  docs/DOCUMENTATION.md
 2520620  docs/README-CODE-COMPLET.md
   82686  docs/origine/README-fichesanitaire.md
   27421  docs/origine/README-infirmerie.md
      18  docs/origine/README-portail.md
  163255  docs/origine/README-voyages.md
 2815721  installer-ndm-sante.sh
     485  installer/footer.sh
    2631  installer/header.sh
    1863  passerelle/ndm-proxy.conf
    1973  passerelle/templates/default.conf.template
     452  postgres-init/01-bases.sh
    2289  scripts/fabriquer-installateur.sh
   10401  scripts/generer-readme.sh
   11997  scripts/installer.sh
    6143  scripts/ndm.sh
    4764  scripts/push-github.sh
```

---
*Fin du README — généré le 11/10/2026 à 18:32 par scripts/generer-readme.sh*
