## 0. Conventions de travail avec Claude (à respecter dans toute nouvelle conversation)

- Répondre en **français**.
- Livrer des **scripts complets** (`cat` / `sh`), jamais d'extraits ni de modifications manuelles à faire à la main.
- Indiquer **systématiquement** le répertoire où déposer chaque fichier avec **FileZilla** (SFTP, utilisateur `root`, transfert en mode **binaire**) et la commande exacte pour l'exécuter.
- Après **toute installation ou mise à jour** : régénérer ce README dans `/opt/readme/README.md` (extrêmement détaillé, auto-suffisant, contenant tous les scripts) **et pousser le projet sur GitHub** (`serviceinformatique-droid/sitesante`). C'est fait automatiquement par `scripts/installer.sh`.
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
│   ├── push-github.sh           # push vers github.com/serviceinformatique-droid/sitesante
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
- Fiche Sanitaire : clé `cerfa_establishment_name_v1` (fiches, PDF, liste des inscrits, e-mails de relance `{etablissement}`, message d'accueil des nouveaux parents `{etablissement}`) ;
- Fiche Infirmerie : `branding.schoolName` — **tous** les textes (en-têtes, écrans de connexion parent et personnel, tableau de bord, texte d'autorisation parentale, écran de confirmation, aperçu et PDF A4 de la fiche, titre de l'onglet, cahier des charges RGPD via la variable `{{ETABLISSEMENT}}`, attestation RGPD) ; logo et sous-titre conservés ;
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

### 8ter. Comptes parents communs Fiche Sanitaire ⇄ Fiche Infirmerie (v1.3.0)

**Principe : un parent = une adresse e-mail = un compte valable dans les deux applications** (mêmes identifiant, mot de passe, question et réponse secrètes).

| Événement | Effet automatique |
|---|---|
| Inscription dans la Fiche Sanitaire | compte créé dans la Fiche Infirmerie (nom, prénom, téléphone, empreintes) |
| Inscription dans la Fiche Infirmerie | compte créé dans la Fiche Sanitaire (+ message d'accueil de la messagerie) |
| Changement de mot de passe (par le parent, « mot de passe oublié », console centrale, administration de la Fiche Sanitaire) | recopié dans l'autre application ; sessions ouvertes du compte fermées de l'autre côté |
| Compte supprimé d'un côté après synchronisation | **non recréé** (la suppression est respectée ; l'autre compte est conservé) |
| Parent inscrit séparément dans les deux applications avec des mots de passe différents (avant la v1.3.0) | **conflit** affiché dans la console centrale : bouton « Garder celui de la Fiche Sanitaire / de l'Infirmerie », ou nouveau mot de passe défini depuis la console (appliqué aux deux) |
| Adresse déjà utilisée par un compte du personnel de la Fiche Sanitaire | non synchronisé (signalé) |

**Déclenchement** : chaque application prévient le portail dès qu'un compte change (`POST /internal/parents/sync`, réseau Docker interne, regroupé sur 1,5 s : le compte est disponible dans l'autre application en 2 à 3 secondes) ; contrôle complet toutes les 5 minutes ; bouton « 🔄 Synchroniser maintenant » dans la console. 1re synchronisation 20 s après le démarrage du portail : les comptes déjà existants sont recopiés.

**Aucun mot de passe en clair** : seules les empreintes circulent, et chaque application sait vérifier le format de l'autre :
- Fiche Sanitaire : `scrypt$N$r$p$sel$clé` (natif) + `pbkdf2-sha512$100000$sel$hex` / `pbkdf2a-sha256$50000$sel$hex` (venant de l'Infirmerie) ;
- Fiche Infirmerie : PBKDF2 natif + `scrypt$…` (venant de la Fiche Sanitaire). Réponses secrètes : la règle de comparaison d'origine est conservée (minuscules ; sans accents pour celles créées dans l'Infirmerie).
État de synchronisation : table `portail_parents_sync` (e-mail, SHA-256 de l'empreinte commune, présence de chaque côté) dans la base `portail` ; il sert à savoir **quel côté a changé**.
Routes internes (secret `NDM_INTERNAL_SECRET`, bloquées par la passerelle depuis l'extérieur) : `GET /api/internal/parents` et `POST /api/internal/parents/import` (`mode` = `create` | `password`) dans les deux applications.

Les écrans de connexion des deux applications indiquent aux familles que le compte est commun.

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

- Dépôt : `https://github.com/serviceinformatique-droid/sitesante` (créé en privé automatiquement s'il n'existe pas).
- 1re configuration : `bash /opt/ndm-sante/scripts/push-github.sh` (demande le jeton PAT classic, case `repo`), ou `GITHUB_TOKEN=ghp_xxx bash /opt/ndm-sante/scripts/push-github.sh`. Le jeton est enregistré dans `/root/.github-token`.
- Ensuite, **chaque installation / mise à jour pousse automatiquement** le code + `README.md` + `docs/README-CODE-COMPLET.md`.
- Jamais envoyés : `.env`, `donnees/`, `sauvegardes/`, `backups-installateur/`, `node_modules/`, `dist/`, l'installateur.
- **Réinstaller depuis GitHub** sur un LXC neuf (Docker déjà installé ou non) :
  ```bash
  apt-get update && apt-get install -y git
  git clone https://github.com/serviceinformatique-droid/sitesante.git /opt/ndm-sante   # demande le jeton (dépôt privé)
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
