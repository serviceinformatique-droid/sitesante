# 📚 Portail des Voyages Scolaires — DocuSeal, doubles signatures & pièces jointes

> **Ce fichier est généré automatiquement** après chaque installation ou mise à jour
> (`/opt/portail-voyages/app/generate-readme.sh`). Il contient **tout** ce qu'il faut savoir pour
> maintenir, réinstaller ou faire évoluer le projet — y compris l'intégralité des scripts.
> **Pour une nouvelle discussion avec une IA : joindre ce fichier** (et si besoin `README-CODE-COMPLET.md`).

## 0. État de cette instance (au 11/10/2026 16:11:03)

| Élément | Valeur |
|---|---|
| Version du portail | **1.4.0** |
| Serveur | docuseal-upload-orga — IP 172.17.0.1 (LXC Proxmox, Debian GNU/Linux 12 (bookworm)) |
| Node.js / npm | v24.21.0 / 11.19.0 |
| Service systemd | `portail-voyages` — active / enabled |
| URL locale | http://172.17.0.1:3000 |
| Dossier application | `/opt/portail-voyages/app` |
| Base de données (JSON) | `/opt/portail-voyages/app/data/database.json` (12K) |
| Sauvegardes | `/opt/portail-voyages/app/backups/` (0 fichiers) |
| **Pièces jointes** | `/opt/portail-voyages/pieces-jointes` — 3 fichier(s), 1.6M |
| README | `/opt/readme/README.md` + `/opt/readme/README-CODE-COMPLET.md` |
| Dépôt GitHub | https://github.com/serviceinformatique-droid/orgavoyageV2 |

### Pièces jointes par dossier (nombre de fichiers uniquement, aucun nom d'élève)

```
Londres/                                                     0 fichier(s)
Londres/501/                                                 3 fichier(s)
```

### Variables .env actuelles (secrets masqués)

```ini
PORT=3000
NODE_ENV=production
ADMIN_PASSWORD=********
FRAME_ANCESTORS=*
ALLOW_INSECURE_TLS=false
APP_URL=https://voyages.mon-etablissement.fr
PIECES_DIR=/opt/portail-voyages/pieces-jointes
PIECES_PAR_VOYAGE=true
PIECES_TAILLE_MAX_MO=30
AUTO_SYNC_MINUTES=15
```

## 1. Cahier des charges (intégralité des exigences)

1. **Tout type de sortie / voyage scolaire** (le premier cas était un voyage en Allemagne, mais le portail sert pour
   n'importe quel voyage, en France, dans l'UE ou hors UE) : la fiche d'inscription est saisie par les parents dans **DocuSeal**.
2. Renseignements de la fiche : **nom de l'enfant**, **prénom de l'enfant**, **classe de l'enfant**,
   **nom du responsable**, **prénom du responsable** (+ e-mail / téléphone des signataires).
3. **Pièces jointes configurables voyage par voyage**, à téléverser par les parents **dans le formulaire DocuSeal, juste
   avant la signature**. Exemples (préréglages fournis, modifiables librement) :
   - *Voyage dans l'UE* (ex. Allemagne) : **carte d'identité**, **autorisation de sortie du territoire** (AST, Cerfa 15646),
     **carte de mutuelle européenne** (CEAM) ;
   - *Voyage hors UE* : passeport, autorisation de sortie du territoire, attestation d'assurance rapatriement ;
   - *Sortie / séjour en France* : attestation d'assurance scolaire, fiche sanitaire ;
   - *Aucune pièce jointe*.
4. **Une fois signé**, les pièces sont **copiées automatiquement dans un dossier du serveur**, nommées
   `NOM_Prenom_NomDeLaPiece.ext` et **classées automatiquement par classe**.
5. Script **tout-en-un** (sh / cat) qui installe **en une seule fois** le projet complet (squelette + tout le contenu),
   **backend + frontend**, **fonctionnel immédiatement**.
6. Site **100 % responsive**, adapté aux téléphones portables.
7. Le projet doit fonctionner **en iframe**.
8. **100 % sur le serveur**, **rien en cache du navigateur**.
9. Environnement : **LXC Proxmox Debian 12**, **Nginx Proxy Manager (NPM)** et **Docker** (DocuSeal).
10. Toujours indiquer **dans quel répertoire déposer le fichier avec FileZilla** et **la commande pour l'exécuter**.
11. Après chaque installation / mise à jour : **README extrêmement détaillé dans `/opt/readme`**, contenant tous les détails
    et scripts du projet, **poussé sur GitHub** (utilisateur `serviceinformatique-droid`).
12. Scripts en `cat` / `sh`, dont un **script pour pousser sur GitHub**.

### Fonctionnalités héritées (v1.1) conservées
- Multi-voyages / multi-instances DocuSeal (URL, clé API, modèle par voyage).
- Suivi des **doubles signatures** parentales (Parent 1 / Parent 2), statuts COMPLET / À FINALISER / NON SIGNÉ, doublons.
- Correction manuelle de la classe (verrouillée, prioritaire sur DocuSeal).
- Relances individuelles et en masse (via l'API DocuSeal, message Pronote / e-mail pré-rempli).
- Exports Excel et PDF, document récapitulatif imprimable.
- Rôles : **Administrateur** (mot de passe), **Consultation/Comptabilité** (lecture seule), **Enseignant** (mot de passe par voyage).
- Journal des synchronisations / webhooks.

### Nouveautés v1.2 (pièces jointes)
- Module serveur `server/attachments.ts` : détection des champs « Fichier », téléchargement, nommage, classement, déplacement
  automatique en cas de changement de classe, vérification du modèle DocuSeal.
- Synchronisation automatique toutes les `AUTO_SYNC_MINUTES` minutes + déclenchement par **webhook** DocuSeal.
- Fiche élève : section **Pièces jointes (x/N)** avec Voir / Télécharger / Récupérer depuis DocuSeal.
- Tableau enseignant : indicateur **📎 x/N pièces** par élève (N = pièces demandées pour le voyage).
- Administration : bouton **📎** par voyage → vérification du modèle, état par classe, récupération immédiate.
- Politique **zéro cache navigateur** (en-têtes `no-store` partout, pas d'ETag), **aucune ressource externe** (Google Fonts retiré).
- Installateur **tout-en-un**, README auto-généré dans `/opt/readme`, push GitHub automatisé (création du dépôt privé si besoin).

## 2. Architecture

```
Parents (mobile/PC) ──► DocuSeal (Docker) ── formulaire : élève, classe, responsable,
                                               champs « Fichier » demandés, Signature
                              │
                              │  webhook (form.completed / submission.completed)  +  API REST (X-Auth-Token)
                              ▼
            ┌──────────── Portail Voyages (Node.js / Express, service systemd « portail-voyages ») ─────────────┐
            │  server.ts               routes API, en-têtes iframe + no-cache, fichiers statiques (dist/)       │
            │  server/db.ts            base JSON (data/database.json), synchro DocuSeal, relances, webhooks     │
            │  server/attachments.ts   pièces jointes : téléchargement → PIECES_DIR/<Voyage>/<Classe>/...       │
            │  server/auth.ts          jetons signés HMAC, scrypt, anti-brute-force                             │
            └─────────────────────────────────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS (Nginx Proxy Manager → http://IP_LXC:3000)
Enseignants / Admin / Compta : application React (Vite + Tailwind), utilisable seule ou en <iframe>
```

- **Frontend** : React 19, Vite 6, Tailwind CSS 4, lucide-react, jsPDF, xlsx. Compilé dans `dist/`.
- **Backend** : Express 4 compilé par esbuild dans `dist/server.cjs` (une seule commande `npm run build`).
- **Stockage** : fichier JSON (pas de SGBD à administrer) + fichiers des pièces jointes sur disque.
- **Sessions** : jetons en en-tête (`x-admin-token`, `x-consultation-token`) conservés en `sessionStorage`
  (effacés à la fermeture de l'onglet) → pas de cookie, donc **aucun problème de cookies tiers en iframe**.

### Arborescence sur le serveur

```
/root/installer-portail-voyages.sh     ← installateur tout-en-un déposé avec FileZilla
/root/portail-voyages-identifiants.txt ← mot de passe admin généré (chmod 600)
/opt/readme/README.md                  ← CE fichier
/opt/readme/README-CODE-COMPLET.md     ← tout le code source
/opt/portail-voyages/
├── app/                               ← application (dépôt GitHub)
│   ├── .env                           ← configuration (jamais écrasée, jamais poussée)
│   ├── data/database.json             ← base (jamais écrasée)
│   ├── backups/                       ← sauvegardes automatiques de la base
│   ├── dist/                          ← build (frontend + server.cjs)
│   ├── server.ts, server/*.ts, src/** ← code source
│   └── install.sh, update.sh, push-github.sh, generate-readme.sh, make-installer.sh
├── pieces-jointes/                    ← PIECES_DIR
│   └── <Voyage>/<Classe>/NOM_Prenom_Carte-Identite.pdf
│                          NOM_Prenom_Autorisation-Sortie-Territoire.jpg
│                          NOM_Prenom_Carte-Mutuelle-Europeenne.png
├── installer-portail-voyages.sh       ← copie du dernier installateur exécuté
└── backups-installer/                 ← archive .tgz de l'app avant chaque réinstallation
```

## 3. Installation (première fois)

1. **FileZilla** : connexion **SFTP** au LXC (hôte = IP du LXC, port 22, utilisateur `root`).
   Si la connexion root SFTP est refusée : dans le LXC `sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config && systemctl restart ssh`.
2. Déposer **`installer-portail-voyages.sh`** dans le répertoire **`/root/`**.
3. Dans la console Proxmox du LXC (ou SSH), en root :
   ```bash
   bash /root/installer-portail-voyages.sh
   ```
   Options :
   ```bash
   NGINX_DOMAIN=voyages.mon-ecole.fr bash /root/installer-portail-voyages.sh   # Nginx local en plus (sinon NPM)
   GITHUB_PUSH=1 bash /root/installer-portail-voyages.sh                       # pousse sur GitHub à la fin
   GITHUB_TOKEN=ghp_xxx GITHUB_PUSH=1 bash /root/installer-portail-voyages.sh  # sans question
   ```
4. Le mot de passe administrateur est affiché et copié dans `/root/portail-voyages-identifiants.txt`.
5. **Nginx Proxy Manager** : *Hosts → Proxy Hosts → Add* : domaine `voyages.mon-ecole.fr`, scheme `http`,
   IP du LXC, port `3000`, cocher *Block Common Exploits* et *Websockets Support*, onglet SSL : Let's Encrypt + *Force SSL*.
   **Ne pas** ajouter `X-Frame-Options` dans *Advanced* (bloquerait l'iframe). Pour les gros fichiers, *Advanced* :
   `client_max_body_size 50M;`
6. Ouvrir le portail → **Administration** → *Ajouter un site DocuSeal* (URL de DocuSeal, clé API, modèle).
7. Configurer le **modèle DocuSeal** (§ 5) et le **webhook** (§ 6), puis bouton **📎** du voyage → *Vérifier*.

### Ce que fait l'installateur tout-en-un
1. Vérifie root, corrige les fins de ligne Windows (CRLF) éventuelles.
2. Archive l'application existante (`/opt/portail-voyages/backups-installer/app_AAAAMMJJ_HHMMSS.tgz`) et la base.
3. Écrit **tous les fichiers du projet** (squelette + contenu) dans `/opt/portail-voyages/app/` (sans toucher à `.env`, `data/`, pièces jointes).
4. Lance `install.sh` : paquets Debian, Node.js 24 LTS (NodeSource), utilisateur système `portail-voyages`, `.env`
   (mot de passe aléatoire), `npm ci` + `npm run build`, droits, service systemd, test `/api/health`,
   Nginx optionnel, README (`/opt/readme`), push GitHub (si identifiants enregistrés ou `GITHUB_PUSH=1`).

## 4. Mises à jour

- **Méthode recommandée** : déposer le nouvel `installer-portail-voyages.sh` dans **`/root/`** (FileZilla) puis :
  ```bash
  bash /root/installer-portail-voyages.sh
  ```
- **Fichiers modifiés à la main** (FileZilla dans `/opt/portail-voyages/app/…`) puis :
  ```bash
  bash /opt/portail-voyages/app/update.sh
  ```
- **Depuis GitHub** :
  ```bash
  GIT_PULL=1 bash /opt/portail-voyages/app/update.sh
  ```
- **Régénérer un installateur tout-en-un** à partir de l'application actuelle :
  ```bash
  bash /opt/portail-voyages/app/make-installer.sh     # → /opt/portail-voyages/installer-portail-voyages.sh
  ```
Chaque mise à jour : sauvegarde de la base, build, redémarrage, **README régénéré**, push GitHub si identifiants présents.

## 5. Configuration du modèle DocuSeal (fiche d'inscription)

Dans DocuSeal (*Modèles → votre fiche → Modifier*), créer les champs suivants (les noms sont reconnus automatiquement,
majuscules/accents indifférents) :

| Champ DocuSeal | Type | Rôle | Remarque |
|---|---|---|---|
| `Nom de l'enfant` | Texte | Parent 1 (1re partie) | obligatoire |
| `Prénom de l'enfant` | Texte | Parent 1 | obligatoire |
| `Classe` | Liste déroulante (ex. 4A, 4B…) | Parent 1 | obligatoire — sert au classement des dossiers |
| `Nom du responsable` | Texte | Parent 1 | obligatoire |
| `Prénom du responsable` | Texte | Parent 1 | obligatoire |
| `Téléphone du responsable` | Téléphone | Parent 1 | facultatif |
| **une ligne par pièce demandée** (ex. `Carte d'identité`, `Fiche sanitaire`…) | **Fichier** | Parent 1 | obligatoire, **avant la signature** |
| `Signature` | Signature | Parent 1 | en dernier |
| `Signature` | Signature | Parent 2 (2e partie) | si double signature |

### Pièces jointes demandées : configuration par voyage
Administration → ✏️ *Modifier* le voyage → **« Pièces jointes demandées aux parents »** (une pièce par ligne) :
- boutons de préréglage : *Voyage dans l'Union européenne*, *Voyage hors Union européenne*, *Sortie / séjour en France*,
  *Aucune pièce jointe* — puis modifier librement le texte ;
- mots-clés facultatifs après `|` (autres noms de champ DocuSeal acceptés), ex. `Fiche sanitaire | sanitaire, vaccins` ;
- ou bouton **📎 → « Reprendre les champs Fichier du modèle »** : la liste est construite automatiquement à partir des
  champs *Fichier* trouvés dans le modèle DocuSeal du voyage.
- Les voyages créés avant la v1.4 (sans liste) gardent les 3 pièces historiques (carte d'identité, AST, CEAM).
- Changer la liste après coup reclasse et renomme automatiquement les fichiers déjà reçus.

Rapprochement champ DocuSeal ↔ pièce : nom identique (majuscules/accents/ponctuation ignorés), puis nom du champ
contenant le libellé, puis mots-clés. Mots-clés intégrés pour les pièces courantes :
- Carte d'identité : `identité`, `carte d'identité`, `CNI`, `pièce d'identité`
- Passeport : `passeport`, `passport`
- Autorisation de sortie du territoire : `sortie du territoire`, `autorisation de sortie`, `AST`, `cerfa 15646`
- Carte de mutuelle européenne : `mutuelle`, `CEAM`, `carte européenne`, `européenne`

**Placer les pièces juste avant la signature** : dans le constructeur, la liste des champs (panneau de droite) définit
l'ordre des étapes du formulaire ; glisser les champs *Fichier* **au-dessus** du champ *Signature* du même rôle.
Sur mobile, DocuSeal propose alors « Prendre une photo » ou « Choisir un fichier » pour chaque pièce.

Tout autre champ *Fichier* est aussi récupéré (catégorie « Autres fichiers », nommé d'après le champ).
Le bouton **📎 → Vérification du modèle** contrôle, pour chaque pièce demandée : présence du champ, type *Fichier*,
obligatoire, position avant la signature ; il liste aussi les champs *Fichier* du modèle non demandés dans le portail.

## 6. Webhook DocuSeal (temps réel)

DocuSeal → *Paramètres → Webhooks* → URL :
```
https://voyages.mon-ecole.fr/api/webhooks/docuseal/<ID_DU_VOYAGE>
```
(l'URL exacte est affichée par le bouton 🔗 *Webhook* du voyage dans l'Administration). Événements : `form.completed`,
`submission.completed`, `submission.created`. Si `WEBHOOK_SECRET` est défini dans `.env`, ajouter `?secret=<valeur>` à l'URL
(ou l'en-tête `X-Webhook-Secret`). À chaque webhook : synchronisation complète du voyage (anti-rebond 3 s) puis
téléchargement des pièces des parents qui viennent de signer. Sans webhook, la synchronisation automatique
(`AUTO_SYNC_MINUTES`, 15 min par défaut) fait le même travail.

> DocuSeal dans Docker sur le même LXC/hôte : l'URL DocuSeal saisie dans le portail doit être joignable **depuis le LXC du
> portail** (ex. `http://192.168.1.50:3001` ou `https://docuseal.mon-ecole.fr`). Si DocuSeal utilise un certificat auto-signé :
> `ALLOW_INSECURE_TLS=true` dans `.env`.

## 7. Pièces jointes : fonctionnement détaillé

1. Le parent remplit la fiche, téléverse les pièces demandées pour ce voyage, **signe**.
2. DocuSeal envoie le webhook (ou la synchro périodique / manuelle passe).
3. Le portail met à jour l'inscription (élève, classe, signatures) puis, **pour chaque parent ayant signé**,
   lit ses valeurs (`GET /api/submissions/{id}`, à défaut `GET /api/submitters/{id}`) et télécharge chaque fichier
   (URL fournie par DocuSeal, en-tête `X-Auth-Token`).
4. Enregistrement **atomique** dans :
   ```
   PIECES_DIR/<Voyage>/<Classe>/<NOM>_<Prenom>_<Piece>.<ext>
   ex. /opt/portail-voyages/pieces-jointes/Sejour-Berlin-2027/4B/DUPONT_Lea_Carte-Identite.pdf
   ```
   - noms sans accents ni espaces (compatibles Windows/Samba) ; extension déduite du type MIME (pdf, jpg, png, heic…) ;
   - plusieurs fichiers dans un même champ → suffixe `_2`, `_3` ;
   - homonyme dans la même classe → suffixe `_Dossier<n°>` (aucun écrasement) ;
   - `PIECES_PAR_VOYAGE=false` → `PIECES_DIR/<Classe>/…`.
5. Un signataire déjà traité n'est plus re-téléchargé (liste `pieces_submitters_traites`), sauf « Récupérer à nouveau ».
6. **Changement de classe** (correction par l'enseignant ou dans DocuSeal) → fichiers **déplacés** automatiquement dans
   le dossier de la nouvelle classe (les dossiers vides sont supprimés). Idem si le nom de l'élève est corrigé.
7. Consultation dans le portail : fiche élève → *Pièces jointes (x/N)* → **Voir** / **Télécharger** (mêmes droits que
   la liste des élèves : admin, compta, ou mot de passe du voyage).
   **Toute une classe d'un coup** : tableau de bord → cliquer sur la carte de la classe (ou choisir la classe dans le
   filtre) → bouton **📎 Pièces jointes 4B (.zip)**. L'archive contient un dossier par élève :
   ```
   Sejour-Berlin-2027_4B_pieces-jointes.zip
   ├── Recapitulatif_pieces.csv          (Classe ; Nom ; Prénom ; pièce présente OUI / MANQUANTE)
   └── 4B/
       ├── DUPONT_Lea/   DUPONT_Lea_Carte-Identite.pdf, …_Autorisation-Sortie-Territoire.jpg, …_Carte-Mutuelle-Europeenne.png
       └── MARTIN_Hugo/  …
   ```
   Sans filtre de classe : toutes les classes du voyage (un dossier par classe puis par élève).
8. Erreurs (fichier trop gros, DocuSeal injoignable…) : visibles dans le **Journal** (type `pieces_jointes`) et
   `journalctl -u portail-voyages`.

Partager le dossier sur le réseau (optionnel, Samba) :
```bash
apt install -y samba
cat >> /etc/samba/smb.conf <<'EOF'
[pieces-voyages]
   path = /opt/portail-voyages/pieces-jointes
   read only = yes
   valid users = @portail-voyages
EOF
adduser secretariat && usermod -aG portail-voyages secretariat && smbpasswd -a secretariat
systemctl restart smbd
```

## 8. Intégration en iframe

```html
<iframe src="https://voyages.mon-ecole.fr" style="width:100%;height:100vh;min-height:900px;border:0"
        allow="clipboard-write" loading="lazy"></iframe>
```
- Pas de `X-Frame-Options` ; `Content-Security-Policy: frame-ancestors <FRAME_ANCESTORS>` (défaut `*`).
  Restreindre : `FRAME_ANCESTORS="https://intranet.mon-ecole.fr https://ent.mon-ecole.fr"`.
- Sessions par jetons (pas de cookies) → fonctionne en iframe cross-site, y compris Safari.
- Iframe `sandbox` : `allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals`.
- Nginx Proxy Manager : ne pas ajouter `X-Frame-Options`.

## 9. Zéro cache navigateur — 100 % serveur

- Toutes les réponses (HTML, JS, CSS, API, pièces jointes) : `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`,
  `Pragma: no-cache`, `Expires: 0` ; ETag et Last-Modified désactivés ; appels API en `fetch(..., {cache:'no-store'})`.
- `index.html` contient aussi les balises `<meta http-equiv>` équivalentes.
- Aucune ressource externe (polices système, pas de CDN) : tout est servi par le LXC.
- Seuls les jetons de session sont gardés en `sessionStorage` (pas de données métier), effacés à la fermeture de l'onglet.

## 10. Responsive / mobile

Tailwind (classes `sm:` / `md:` / `lg:`), modales plein écran sur téléphone avec gros boutons de fermeture,
tableaux à défilement horizontal, boutons tactiles (`touch-manipulation`), grilles qui passent en 1 colonne sous 640 px.

## 11. Rôles et sécurité

| Rôle | Accès | Authentification |
|---|---|---|
| Administrateur | tout (voyages, clés API, purge, mots de passe, pièces) | `ADMIN_PASSWORD` (.env) ou mot de passe changé dans l'interface (scrypt) |
| Consultation / Comptabilité | lecture de tous les voyages, exports, pièces | mot de passe consultation (Administration) |
| Enseignant | un voyage : liste, classes, relances, pièces | mot de passe du voyage (facultatif) |

Jetons HMAC-SHA256 à durée limitée (`SESSION_TTL_HOURS`), limitation à 10 essais / 15 min, échappement HTML,
chemins de fichiers vérifiés (pas de sortie de `PIECES_DIR`), service systemd non-root (`ProtectSystem=full`,
`NoNewPrivileges`, écriture limitée à `data/`, `backups/`, `PIECES_DIR`), `.env` en 640, clés API jamais envoyées
aux non-admins. **Les pièces jointes sont des données personnelles sensibles** : restreindre l'accès au dossier,
les supprimer après le voyage (`rm -rf /opt/portail-voyages/pieces-jointes/<Voyage>`), ne pas les pousser sur GitHub
(elles sont hors du dossier `app/`).

## 12. Sauvegarde / restauration

```bash
# Sauvegarde complète (base + .env + pièces jointes)
tar czf /root/sauvegarde-voyages_$(date +%F).tgz -C /opt/portail-voyages app/data app/.env pieces-jointes
# Restauration de la base
systemctl stop portail-voyages
cp /opt/portail-voyages/app/backups/database_AAAAMMJJ_HHMMSS.json /opt/portail-voyages/app/data/database.json
chown portail-voyages: /opt/portail-voyages/app/data/database.json && systemctl start portail-voyages
# Revenir à la version précédente de l'application
ls /opt/portail-voyages/backups-installer/
tar xzf /opt/portail-voyages/backups-installer/app_AAAAMMJJ_HHMMSS.tgz -C /opt/portail-voyages && bash /opt/portail-voyages/app/install.sh
```
Penser aussi aux sauvegardes Proxmox (vzdump) du LXC.

## 13. GitHub

```bash
bash /opt/portail-voyages/app/push-github.sh "message du commit"
```
- Utilisateur : `serviceinformatique-droid` ; dépôt : `orgavoyageV2` (créé **privé** automatiquement si absent).
- Jeton (PAT classic, portée `repo`) demandé une fois puis stocké dans `/root/.git-credentials` (chmod 600) ;
  ou `GITHUB_TOKEN=ghp_xxx bash push-github.sh`. Changer de jeton : `rm /root/.git-credentials`.
- Envoyé : code, scripts, README (copie de `/opt/readme/README.md`), `docs/README-CODE-COMPLET.md`.
  Jamais envoyé : `.env`, `data/`, `backups/`, `node_modules/`, `dist/`, pièces jointes.

## 14. Dépannage

| Symptôme | Vérification / solution |
|---|---|
| Portail inaccessible | `systemctl status portail-voyages` ; `journalctl -u portail-voyages -n 100 --no-pager` ; `curl http://127.0.0.1:3000/api/health` |
| Port déjà utilisé | `ss -ltnp | grep 3000` → changer `PORT` dans `.env` + NPM |
| Iframe blanche / refusée | console navigateur : `frame-ancestors` → ajuster `FRAME_ANCESTORS` ; retirer `X-Frame-Options` dans NPM |
| Synchro DocuSeal en erreur | Administration → ⚡ tester ; clé API (DocuSeal → Paramètres → API) ; URL joignable depuis le LXC : `curl -I https://docuseal…` |
| Pièces non récupérées | 📎 du voyage → *Vérification du modèle* ; le parent a-t-il **signé** ? ; Journal (type pieces_jointes) ; `ls -lR /opt/portail-voyages/pieces-jointes` |
| « fichier trop volumineux » | augmenter `PIECES_TAILLE_MAX_MO` |
| Erreur d'écriture des pièces | droits : `chown -R portail-voyages: /opt/portail-voyages/pieces-jointes` ; `PIECES_DIR` dans `ReadWritePaths` (relancer `install.sh`) |
| Webhook sans effet | Journal → entrée « Webhook DocuSeal reçu » ? sinon URL/secret ; tester : `curl -X POST https://…/api/webhooks/docuseal/<id> -H 'Content-Type: application/json' -d '{}'` |
| Mot de passe admin perdu | `grep ADMIN_PASSWORD /opt/portail-voyages/app/.env` (si changé dans l'interface : remettre `ADMIN_PASSWORD=` puis restart) |
| Build qui échoue | `cd /opt/portail-voyages/app && rm -rf node_modules && npm ci --include=dev && npm run build` |
| Script avec `\r` (édité sous Windows) | `sed -i 's/\r$//' /root/installer-portail-voyages.sh` |

## 15. Commandes utiles

```bash
systemctl restart portail-voyages            # redémarrer
journalctl -u portail-voyages -f             # logs en direct
nano /opt/portail-voyages/app/.env           # configuration (puis restart)
bash /opt/portail-voyages/app/update.sh      # reconstruire + redémarrer + README + GitHub
bash /opt/portail-voyages/app/generate-readme.sh
bash /opt/portail-voyages/app/push-github.sh "message"
bash /opt/portail-voyages/app/make-installer.sh
find /opt/portail-voyages/pieces-jointes -type f | wc -l
du -sh /opt/portail-voyages/pieces-jointes/*
```

## 16. Référence API

Authentification : en-tête `x-admin-token` / `x-consultation-token` (ou `?adminToken=` / `?consultationToken=` pour les liens),
mot de passe de voyage : `x-voyage-password` ou `?password=`.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | /api/health | public | état |
| POST | /api/auth/login | public | `{role, password}` → jeton |
| GET | /api/voyages, /api/voyages/:id | public (clés masquées) | voyages |
| POST/PUT/DELETE | /api/voyages[/:id] | admin | gérer les voyages |
| POST | /api/voyages/:id/sync | voyage | synchronisation DocuSeal (+ pièces en arrière-plan) |
| GET | /api/voyages/:id/inscriptions | voyage | élèves (filtres `search`, `classe`, `statut`) |
| PUT | /api/inscriptions/:id | voyage (classe) / admin | modifier (déplace les pièces si la classe change) |
| POST | /api/inscriptions/:id/relance | voyage | relance parent |
| GET | /api/inscriptions/:id/document | voyage | récapitulatif imprimable |
| GET | /api/inscriptions/:id/pieces/:index | voyage | afficher / télécharger (`?download=1`) une pièce |
| POST | /api/inscriptions/:id/pieces/refresh | voyage | re-télécharger les pièces de l'élève |
| GET | /api/voyages/:id/pieces/summary | voyage | pièces reçues / manquantes par classe |
| POST | /api/voyages/:id/pieces/from-template | admin | pièces demandées = champs Fichier du modèle DocuSeal |
| GET | /api/voyages/:id/pieces/zip?classe=4B | voyage | ZIP des pièces d'une classe, un dossier par élève (`classe=Toutes` : tout le voyage) |
| POST | /api/voyages/:id/pieces/process | admin | synchro + récupération (`{force:true}` pour tout retélécharger) |
| GET | /api/voyages/:id/pieces/template-check | admin | vérifie les champs Fichier du modèle (pièces demandées) |
| POST | /api/webhooks/docuseal/:voyageId | DocuSeal | webhook (option `?secret=`) |
| GET | /api/voyages/:id/export/excel | voyage | export Excel |
| GET | /api/logs | admin | journal |

Liste exhaustive extraite du code :

```
GET *
POST /api/admin/change-consultation-password
GET /api/admin/consultation-password
POST /api/admin/purge-all-inscriptions
POST /api/admin/reset-database
POST /api/admin/seed-demo
POST /api/auth/change-admin-password
POST /api/auth/login
POST /api/auth/verify-admin
GET /api/docuseal/raw-submissions/:voyageId
POST /api/docuseal/templates
POST /api/docuseal/test-direct
GET /api/health
GET /api/inscriptions/:id
PATCH /api/inscriptions/:id
PUT /api/inscriptions/:id
GET /api/inscriptions/:id/document
GET /api/inscriptions/:id/pieces/:index
POST /api/inscriptions/:id/pieces/refresh
POST /api/inscriptions/:id/relance
GET /api/logs
GET /api/logs/sync
GET /api/voyages
POST /api/voyages
DELETE /api/voyages/:id
GET /api/voyages/:id
PUT /api/voyages/:id
POST /api/voyages/:id/delete
GET /api/voyages/:id/export/excel
GET /api/voyages/:id/inscriptions
POST /api/voyages/:id/pieces/from-template
POST /api/voyages/:id/pieces/process
GET /api/voyages/:id/pieces/summary
GET /api/voyages/:id/pieces/template-check
GET /api/voyages/:id/pieces/zip
POST /api/voyages/:id/purge-inscriptions
POST /api/voyages/:id/relance-masse
POST /api/voyages/:id/sync
POST /api/voyages/:id/test-connection
POST /api/voyages/:id/verify-password
POST /api/voyages/sync-all
POST /api/voyages/test-all
POST /api/webhooks/docuseal/:voyageId
```

## 17. Historique des versions

- **1.4.0** — Le portail n'est plus limité au voyage en Allemagne : **pièces jointes demandées configurables voyage par
  voyage** (préréglages UE / hors UE / France / aucune, texte libre avec mots-clés, ou reprise automatique des champs
  Fichier du modèle DocuSeal). Compteurs x/N, vérification du modèle, récapitulatif CSV du ZIP et classement des fichiers
  suivent la liste du voyage ; changement de liste = reclassement automatique des fichiers déjà reçus.

- **1.3.0** — Téléchargement **ZIP des pièces jointes par classe, rangées par élève** depuis le tableau de bord
  (bouton « 📎 Pièces jointes <classe> (.zip) » à côté d'Excel : il suit la classe sélectionnée ; « toutes classes » si
  aucun filtre) et depuis le panneau 📎 de l'Administration. Contenu : `<Classe>/<NOM_Prenom>/<fichiers>` +
  `Recapitulatif_pieces.csv` (OUI / MANQUANTE par pièce, s'ouvre dans Excel). Dépendance ajoutée : `archiver`.

- **1.2.0** — Pièces jointes DocuSeal (carte d'identité, autorisation de sortie du territoire, carte mutuelle européenne)
  copiées sur le serveur après signature, nommées `NOM_Prenom_Piece` et classées par classe ; déplacement auto si la classe
  change ; vérification du modèle ; synchro automatique + webhook ; zéro cache navigateur ; suppression de Google Fonts ;
  Node.js 24 ; installateur tout-en-un ; README auto dans `/opt/readme` ; push GitHub avec création du dépôt.
- **1.1.0** — Version corrigée : sécurité (jetons signés, scrypt, anti-brute-force), iframe (CSP frame-ancestors),
  doubles signatures, relances, exports, consultation/comptabilité.

## 18. Contexte à donner dans une nouvelle discussion

```
Projet : Portail des Voyages Scolaires (React 19 + Vite 6 + Tailwind 4 / Express 4, TypeScript), connecté à DocuSeal.
Serveur : LXC Proxmox Debian 12, Node 24, service systemd "portail-voyages", app dans /opt/portail-voyages/app,
port 3000 derrière Nginx Proxy Manager, DocuSeal en Docker. Base JSON data/database.json.
Pièces jointes configurables par voyage (src/piecesConfig.ts) : server/attachments.ts → /opt/portail-voyages/pieces-jointes/<Voyage>/<Classe>/NOM_Prenom_Piece.ext
Livraison : un installateur tout-en-un /root/installer-portail-voyages.sh (heredocs cat) qui écrit tous les fichiers
puis lance install.sh ; README auto dans /opt/readme ; push GitHub serviceinformatique-droid/orgavoyageV2.
Contraintes : 100 % responsive, fonctionne en iframe, aucun cache navigateur, toujours indiquer le dossier FileZilla
et la commande d'exécution, régénérer le README à chaque mise à jour.
```

## 19. Arborescence du code source

```
.env  (1873 o)
.env.example  (1890 o)
.gitignore  (94 o)
README.md  (1574 o)
docs/README-CODE-COMPLET.md  (606096 o)
generate-readme.sh  (34728 o)
index.html  (1319 o)
install.sh  (6510 o)
installer/footer.sh  (373 o)
installer/header.sh  (2443 o)
make-installer.sh  (2225 o)
nginx-portail.conf  (973 o)
package-lock.json  (182645 o)
package.json  (1078 o)
push-github.sh  (4084 o)
server.ts  (40874 o)
server/attachments.ts  (25101 o)
server/auth.ts  (4248 o)
server/db.ts  (136865 o)
src/App.tsx  (10382 o)
src/components/AdminDocuSealManager.tsx  (82690 o)
src/components/AdminLoginModal.tsx  (8029 o)
src/components/ConsultationPasswordModal.tsx  (11040 o)
src/components/Header.tsx  (7893 o)
src/components/MassRelanceModal.tsx  (23352 o)
src/components/PdfExportModal.tsx  (22709 o)
src/components/PiecesJointesAdminModal.tsx  (13449 o)
src/components/PiecesJointesSection.tsx  (6582 o)
src/components/PurgeStudentsModal.tsx  (7823 o)
src/components/StudentDetailModal.tsx  (28013 o)
src/components/SyncLogsView.tsx  (6896 o)
src/components/TeacherDashboard.tsx  (82396 o)
src/components/TripPasswordModal.tsx  (5503 o)
src/index.css  (1498 o)
src/main.tsx  (302 o)
src/piecesConfig.ts  (7379 o)
src/types.ts  (4020 o)
src/utils/apiFetch.ts  (3746 o)
src/utils/excelGenerator.ts  (8734 o)
src/utils/pdfGenerator.ts  (12724 o)
src/utils/storage.ts  (1251 o)
tsconfig.json  (508 o)
update.sh  (2202 o)
vite.config.ts  (387 o)
```

## 20. Annexes — scripts et fichiers de configuration (contenu intégral)


### `install.sh`

````bash
#!/usr/bin/env bash
# ==============================================================================
# Installation / réinstallation - Portail Voyages Scolaires (Debian 12, LXC Proxmox)
# Emplacement : /opt/portail-voyages/app/install.sh
# Normalement lancé automatiquement par l'installateur tout-en-un :
#     bash /root/installer-portail-voyages.sh
# Peut aussi être relancé seul (idempotent, sans perte de données) :
#     cd /opt/portail-voyages/app && bash install.sh
# Options :
#     NGINX_DOMAIN=voyages.mon-ecole.fr bash install.sh   # Nginx local (sinon Nginx Proxy Manager)
#     GITHUB_PUSH=1 bash install.sh                       # pousse sur GitHub à la fin
# ==============================================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$APP_DIR")"            # /opt/portail-voyages
SERVICE="portail-voyages"
APP_USER="portail-voyages"
NODE_MAJOR=24
README_DIR="/opt/readme"
CRED_FILE="/root/portail-voyages-identifiants.txt"

if [ "$(id -u)" -ne 0 ]; then echo "❌ Lancez ce script en root."; exit 1; fi
if [ ! -f "$APP_DIR/package.json" ]; then echo "❌ package.json introuvable dans $APP_DIR"; exit 1; fi

envget() { grep -E "^$1=" "$APP_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }

echo "==> [1/9] Paquets système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg git build-essential openssl rsync

echo "==> [2/9] Node.js ${NODE_MAJOR} LTS"
CUR_NODE=0
command -v node >/dev/null 2>&1 && CUR_NODE="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
if [ "$CUR_NODE" -lt 20 ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
echo "Node $(node -v) / npm $(npm -v)"

echo "==> [3/9] Utilisateur système"
if ! id "$APP_USER" >/dev/null 2>&1; then
  adduser --system --group --home "$BASE_DIR" "$APP_USER"
fi

echo "==> [4/9] Fichier .env"
if [ ! -f "$APP_DIR/.env" ]; then
  ADMIN_PWD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PWD}|" "$APP_DIR/.env"
  {
    echo "Portail Voyages Scolaires - identifiants générés le $(date '+%d/%m/%Y %H:%M')"
    echo "URL : http://$(hostname -I | awk '{print $1}'):3000"
    echo "Mot de passe administrateur : ${ADMIN_PWD}"
    echo "(modifiable dans $APP_DIR/.env puis : systemctl restart $SERVICE)"
  } > "$CRED_FILE"
  chmod 600 "$CRED_FILE"
  echo "🔑 Mot de passe administrateur généré : ${ADMIN_PWD}  (copie : $CRED_FILE)"
else
  echo ".env existant conservé."
fi
# Ajoute les nouvelles variables (versions >= 1.2.0) sans toucher aux valeurs existantes
add_env() { grep -qE "^#? ?$1=" "$APP_DIR/.env" || echo "$1=$2" >> "$APP_DIR/.env"; }
add_env PIECES_DIR "$BASE_DIR/pieces-jointes"
add_env PIECES_PAR_VOYAGE "true"
add_env PIECES_TAILLE_MAX_MO "30"
add_env AUTO_SYNC_MINUTES "15"
chmod 640 "$APP_DIR/.env"

PORT="$(envget PORT)"; PORT="${PORT:-3000}"
PIECES_DIR="$(envget PIECES_DIR)"; PIECES_DIR="${PIECES_DIR:-$BASE_DIR/pieces-jointes}"

echo "==> [5/9] Dépendances et compilation"
cd "$APP_DIR"
if [ -f package-lock.json ]; then
  npm ci --include=dev --no-audit --no-fund || npm install --include=dev --no-audit --no-fund
else
  npm install --include=dev --no-audit --no-fund
fi
npm run build

echo "==> [6/9] Dossiers et droits"
mkdir -p "$APP_DIR/data" "$APP_DIR/backups" "$PIECES_DIR" "$README_DIR"
chown -R "$APP_USER:$APP_USER" "$BASE_DIR" "$PIECES_DIR"
chmod -R 750 "$BASE_DIR"
chmod -R u+rwX,g+rwX,o-rwx "$APP_DIR/data" "$APP_DIR/backups" "$PIECES_DIR"
chmod +x "$APP_DIR"/*.sh

echo "==> [7/9] Service systemd"
cat > "/etc/systemd/system/${SERVICE}.service" <<UNIT
[Unit]
Description=Portail des Voyages Scolaires (DocuSeal + pièces jointes)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/node ${APP_DIR}/dist/server.cjs
Restart=always
RestartSec=5
UMask=0027
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE}
ProtectSystem=full
ProtectHome=true
NoNewPrivileges=true
ReadWritePaths=${APP_DIR}/data ${APP_DIR}/backups ${PIECES_DIR}

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1
systemctl restart "$SERVICE"

ok=0
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
if [ "$ok" = 1 ]; then echo "✅ Service actif et API joignable (port ${PORT})"; else
  echo "❌ Le service ne répond pas :"; journalctl -u "$SERVICE" -n 40 --no-pager; exit 1; fi

echo "==> [8/9] Nginx local (optionnel)"
if [ -n "${NGINX_DOMAIN:-}" ]; then
  apt-get install -y nginx
  sed -e "s/voyages.mon-etablissement.fr/${NGINX_DOMAIN}/g" -e "s/127.0.0.1:3000/127.0.0.1:${PORT}/g" \
    "$APP_DIR/nginx-portail.conf" > /etc/nginx/sites-available/${SERVICE}.conf
  ln -sf /etc/nginx/sites-available/${SERVICE}.conf /etc/nginx/sites-enabled/${SERVICE}.conf
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  echo "✅ Nginx configuré pour ${NGINX_DOMAIN} (HTTPS : apt install certbot python3-certbot-nginx && certbot --nginx -d ${NGINX_DOMAIN})"
else
  echo "Ignoré. Dans Nginx Proxy Manager : Proxy Host -> http://$(hostname -I | awk '{print $1}'):${PORT}"
fi

echo "==> [9/9] README détaillé (${README_DIR}) et GitHub"
bash "$APP_DIR/generate-readme.sh" || echo "⚠️  Génération du README en échec (non bloquant)"
if [ "${GITHUB_PUSH:-0}" = "1" ] || [ -s /root/.git-credentials ]; then
  bash "$APP_DIR/push-github.sh" "Installation / mise à jour $(date '+%Y-%m-%d %H:%M')" || echo "⚠️  Push GitHub en échec (relancez : bash $APP_DIR/push-github.sh)"
else
  echo "ℹ️  Pour pousser sur GitHub : bash $APP_DIR/push-github.sh \"message\""
fi

echo
echo "=================================================================="
echo "✅ Installation terminée : http://$(hostname -I | awk '{print $1}'):${PORT}"
echo "   Pièces jointes : ${PIECES_DIR}/<Voyage>/<Classe>/NOM_Prenom_Piece.ext"
echo "   README complet : ${README_DIR}/README.md"
echo "   Identifiants   : ${CRED_FILE} (1re installation)"
echo "   Logs           : journalctl -u ${SERVICE} -f"
echo "=================================================================="

````

### `update.sh`

````bash
#!/usr/bin/env bash
# ==============================================================================
# Mise à jour - Portail Voyages Scolaires
# Emplacement : /opt/portail-voyages/app/update.sh
# Usage (en root) : cd /opt/portail-voyages/app && bash update.sh
#
# Deux façons de mettre à jour :
#   A) Recommandé : déposer le NOUVEL installateur tout-en-un dans /root/ (FileZilla)
#      puis : bash /root/installer-portail-voyages.sh   (il sauvegarde, écrit les fichiers et appelle install.sh)
#   B) Ce script : après copie manuelle de fichiers (FileZilla) ou via git pull si le dossier est un dépôt git.
# data/, .env et les pièces jointes ne sont JAMAIS écrasés.
# Le README (/opt/readme/README.md) est régénéré et poussé sur GitHub si des identifiants sont enregistrés.
# ==============================================================================
set -euo pipefail

SERVICE="portail-voyages"
APP_USER="portail-voyages"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$APP_DIR")"
cd "$APP_DIR"

if [ "$(id -u)" -ne 0 ]; then echo "❌ Lancez ce script en root (sudo bash update.sh)."; exit 1; fi
echo "📂 Dossier : $APP_DIR"

# 1. Sauvegarde de la base
if [ -f data/database.json ]; then
  mkdir -p backups
  BK="backups/database_$(date +%Y%m%d_%H%M%S).json"
  cp data/database.json "$BK"
  echo "✓ Sauvegarde : $BK"
  ls -1t backups/database_*.json 2>/dev/null | tail -n +31 | xargs -r rm -f   # garde les 30 dernières
fi

# 2. Git (si dépôt et si demandé : GIT_PULL=1)
if [ "${GIT_PULL:-0}" = "1" ] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  echo "==> git pull ($BRANCH)"
  git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
  git pull --ff-only origin "$BRANCH" || { echo "❌ git pull impossible (modifications locales ?) : git stash && git pull origin $BRANCH"; exit 1; }
else
  echo "ℹ️  Mise à jour depuis les fichiers déjà présents (GIT_PULL=1 pour récupérer depuis GitHub)."
fi

# 3. Réinstallation idempotente (dépendances, build, droits, service, README, GitHub)
bash "$APP_DIR/install.sh"
echo "✨ Mise à jour terminée."

````

### `push-github.sh`

````bash
#!/usr/bin/env bash
# ==============================================================================
# Push du projet vers GitHub
# Dépôt : https://github.com/serviceinformatique-droid/orgavoyageV2
# Emplacement : /opt/portail-voyages/app/push-github.sh
# Usage (root) : cd /opt/portail-voyages/app && bash push-github.sh "message du commit"
#
# Authentification : utilisateur GitHub "serviceinformatique-droid" + Personal Access Token (PAT)
#   Créer le PAT : GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
#                  > Generate new token > cocher "repo" > copier le jeton (ghp_...)
#   - 1re fois : le script demande le jeton (saisie masquée) et l'enregistre dans /root/.git-credentials (chmod 600)
#   - ou bien : GITHUB_TOKEN=ghp_xxx bash push-github.sh "message"
# Le dépôt est créé automatiquement (privé) s'il n'existe pas encore.
# .env, data/, backups/, node_modules/ et dist/ sont exclus (.gitignore) : aucun secret n'est envoyé.
# Le README détaillé (/opt/readme/README.md) est copié dans le dépôt avant chaque push.
# ==============================================================================
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

GH_USER="serviceinformatique-droid"
REPO_NAME="${GITHUB_REPO:-orgavoyageV2}"
REPO="https://github.com/${GH_USER}/${REPO_NAME}.git"
MSG="${1:-Mise à jour du portail voyages scolaires}"
CRED="/root/.git-credentials"

command -v git >/dev/null || { apt-get update -y && apt-get install -y git; }
git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
git config --global credential.helper "store --file=${CRED}"

# Jeton : variable d'environnement > fichier enregistré > saisie interactive
TOKEN="${GITHUB_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -s "$CRED" ]; then
  TOKEN="$(grep -m1 "github.com" "$CRED" | sed -E 's#https://[^:]+:([^@]+)@.*#\1#' || true)"
fi
if [ -z "$TOKEN" ]; then
  if [ -t 0 ]; then
    read -r -s -p "Jeton GitHub (PAT) pour ${GH_USER} : " TOKEN; echo
  else
    echo "❌ Aucun jeton GitHub. Relancez : GITHUB_TOKEN=ghp_xxx bash $APP_DIR/push-github.sh"; exit 1
  fi
fi
[ -n "$TOKEN" ] || { echo "❌ Jeton vide."; exit 1; }
umask 077
printf 'https://%s:%s@github.com\n' "$GH_USER" "$TOKEN" > "$CRED"
chmod 600 "$CRED"

# Création du dépôt (privé) s'il n'existe pas
HTTP="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: token ${TOKEN}" "https://api.github.com/repos/${GH_USER}/${REPO_NAME}")"
if [ "$HTTP" = "404" ]; then
  echo "==> Création du dépôt privé ${GH_USER}/${REPO_NAME}"
  curl -fsS -H "Authorization: token ${TOKEN}" -H "Accept: application/vnd.github+json" \
    https://api.github.com/user/repos \
    -d "{\"name\":\"${REPO_NAME}\",\"private\":true,\"description\":\"Portail des voyages scolaires - DocuSeal, doubles signatures, pièces jointes\"}" >/dev/null
elif [ "$HTTP" = "401" ]; then
  echo "❌ Jeton refusé par GitHub (401). Supprimez $CRED et relancez."; exit 1
fi

# README détaillé à jour dans le dépôt
[ -f /opt/readme/README.md ] && cp /opt/readme/README.md "$APP_DIR/README.md"
mkdir -p "$APP_DIR/docs"
[ -f /opt/readme/README-CODE-COMPLET.md ] && cp /opt/readme/README-CODE-COMPLET.md "$APP_DIR/docs/README-CODE-COMPLET.md"

[ -d .git ] || git init -b main
git config user.name  >/dev/null 2>&1 || git config user.name  "$GH_USER"
git config user.email >/dev/null 2>&1 || git config user.email "${GH_USER}@users.noreply.github.com"
if git remote get-url origin >/dev/null 2>&1; then git remote set-url origin "$REPO"; else git remote add origin "$REPO"; fi

git add -A
if git diff --cached --quiet; then echo "Rien de nouveau à valider."; else git commit -m "$MSG"; fi
git branch -M main
# Si le dépôt distant contient déjà des commits non présents ici (ex. README créé sur GitHub), on les intègre
git fetch origin main >/dev/null 2>&1 && git merge --allow-unrelated-histories -X ours --no-edit origin/main >/dev/null 2>&1 || true
git push -u origin main
echo "✅ Poussé sur https://github.com/${GH_USER}/${REPO_NAME}"

````

### `generate-readme.sh`

````bash
#!/usr/bin/env bash
# ==============================================================================
# Génération du README ultra-détaillé - Portail Voyages Scolaires
# Emplacement : /opt/portail-voyages/app/generate-readme.sh
# Usage (root) : bash /opt/portail-voyages/app/generate-readme.sh
# Lancé automatiquement à chaque installation / mise à jour (install.sh, update.sh).
# Produit :
#   /opt/readme/README.md               documentation complète + tous les scripts (à donner dans une nouvelle discussion)
#   /opt/readme/README-CODE-COMPLET.md  code source intégral du projet
#   /opt/portail-voyages/app/README.md  copie (poussée sur GitHub)
# Aucune donnée personnelle (noms d'élèves) ni secret (.env) n'est écrit dans ces fichiers.
# ==============================================================================
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$APP_DIR")"
OUT_DIR="/opt/readme"
OUT="$OUT_DIR/README.md"
OUT_CODE="$OUT_DIR/README-CODE-COMPLET.md"
SERVICE="portail-voyages"
mkdir -p "$OUT_DIR"

envget() { grep -E "^$1=" "$APP_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
PORT="$(envget PORT)"; PORT="${PORT:-3000}"
PIECES_DIR="$(envget PIECES_DIR)"; PIECES_DIR="${PIECES_DIR:-$BASE_DIR/pieces-jointes}"
VERSION="$(grep -m1 '"version"' "$APP_DIR/package.json" | sed -E 's/.*"([0-9.]+)".*/\1/')"
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
NOW="$(date '+%d/%m/%Y %H:%M:%S')"

dump() { # dump <fichier> [langage]
  local f="$1" lang="${2:-}"
  [ -f "$f" ] || return 0
  printf '\n### `%s`\n\n````%s\n' "${f#"$APP_DIR"/}" "$lang"
  cat "$f"
  printf '\n````\n'
}

{
# ---------------------------------------------------------------------------
cat <<'MD'
# 📚 Portail des Voyages Scolaires — DocuSeal, doubles signatures & pièces jointes

> **Ce fichier est généré automatiquement** après chaque installation ou mise à jour
> (`/opt/portail-voyages/app/generate-readme.sh`). Il contient **tout** ce qu'il faut savoir pour
> maintenir, réinstaller ou faire évoluer le projet — y compris l'intégralité des scripts.
> **Pour une nouvelle discussion avec une IA : joindre ce fichier** (et si besoin `README-CODE-COMPLET.md`).

MD

# ---------------------------------------------------------------------------
cat <<MD
## 0. État de cette instance (au ${NOW})

| Élément | Valeur |
|---|---|
| Version du portail | **${VERSION}** |
| Serveur | $(hostname) — IP ${IP:-?} (LXC Proxmox, $(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-Debian}")) |
| Node.js / npm | $(node -v 2>/dev/null || echo absent) / $(npm -v 2>/dev/null || echo absent) |
| Service systemd | \`${SERVICE}\` — $(systemctl is-active "$SERVICE" 2>/dev/null || echo inconnu) / $(systemctl is-enabled "$SERVICE" 2>/dev/null || echo inconnu) |
| URL locale | http://${IP:-IP_DU_LXC}:${PORT} |
| Dossier application | \`${APP_DIR}\` |
| Base de données (JSON) | \`${APP_DIR}/data/database.json\` ($(du -h "$APP_DIR/data/database.json" 2>/dev/null | cut -f1 || echo absente)) |
| Sauvegardes | \`${APP_DIR}/backups/\` ($(ls -1 "$APP_DIR"/backups 2>/dev/null | wc -l) fichiers) |
| **Pièces jointes** | \`${PIECES_DIR}\` — $(find "$PIECES_DIR" -type f 2>/dev/null | wc -l) fichier(s), $(du -sh "$PIECES_DIR" 2>/dev/null | cut -f1) |
| README | \`${OUT}\` + \`${OUT_CODE}\` |
| Dépôt GitHub | https://github.com/serviceinformatique-droid/orgavoyageV2 |

### Pièces jointes par dossier (nombre de fichiers uniquement, aucun nom d'élève)

\`\`\`
$(cd "$PIECES_DIR" 2>/dev/null && find . -mindepth 1 -type d -printf '%P\n' 2>/dev/null | sort | while read -r d; do printf '%-60s %s fichier(s)\n' "$d/" "$(find "$d" -maxdepth 1 -type f | wc -l)"; done || echo "(dossier vide ou absent)")
\`\`\`

### Variables .env actuelles (secrets masqués)

\`\`\`ini
$(grep -vE '^\s*(#|$)' "$APP_DIR/.env" 2>/dev/null | sed -E 's/^([A-Z_]*(PASSWORD|SECRET|TOKEN|KEY)[A-Z_]*)=.*/\1=********/' || echo "(.env absent)")
\`\`\`

MD

# ---------------------------------------------------------------------------
cat <<'MD'
## 1. Cahier des charges (intégralité des exigences)

1. **Tout type de sortie / voyage scolaire** (le premier cas était un voyage en Allemagne, mais le portail sert pour
   n'importe quel voyage, en France, dans l'UE ou hors UE) : la fiche d'inscription est saisie par les parents dans **DocuSeal**.
2. Renseignements de la fiche : **nom de l'enfant**, **prénom de l'enfant**, **classe de l'enfant**,
   **nom du responsable**, **prénom du responsable** (+ e-mail / téléphone des signataires).
3. **Pièces jointes configurables voyage par voyage**, à téléverser par les parents **dans le formulaire DocuSeal, juste
   avant la signature**. Exemples (préréglages fournis, modifiables librement) :
   - *Voyage dans l'UE* (ex. Allemagne) : **carte d'identité**, **autorisation de sortie du territoire** (AST, Cerfa 15646),
     **carte de mutuelle européenne** (CEAM) ;
   - *Voyage hors UE* : passeport, autorisation de sortie du territoire, attestation d'assurance rapatriement ;
   - *Sortie / séjour en France* : attestation d'assurance scolaire, fiche sanitaire ;
   - *Aucune pièce jointe*.
4. **Une fois signé**, les pièces sont **copiées automatiquement dans un dossier du serveur**, nommées
   `NOM_Prenom_NomDeLaPiece.ext` et **classées automatiquement par classe**.
5. Script **tout-en-un** (sh / cat) qui installe **en une seule fois** le projet complet (squelette + tout le contenu),
   **backend + frontend**, **fonctionnel immédiatement**.
6. Site **100 % responsive**, adapté aux téléphones portables.
7. Le projet doit fonctionner **en iframe**.
8. **100 % sur le serveur**, **rien en cache du navigateur**.
9. Environnement : **LXC Proxmox Debian 12**, **Nginx Proxy Manager (NPM)** et **Docker** (DocuSeal).
10. Toujours indiquer **dans quel répertoire déposer le fichier avec FileZilla** et **la commande pour l'exécuter**.
11. Après chaque installation / mise à jour : **README extrêmement détaillé dans `/opt/readme`**, contenant tous les détails
    et scripts du projet, **poussé sur GitHub** (utilisateur `serviceinformatique-droid`).
12. Scripts en `cat` / `sh`, dont un **script pour pousser sur GitHub**.

### Fonctionnalités héritées (v1.1) conservées
- Multi-voyages / multi-instances DocuSeal (URL, clé API, modèle par voyage).
- Suivi des **doubles signatures** parentales (Parent 1 / Parent 2), statuts COMPLET / À FINALISER / NON SIGNÉ, doublons.
- Correction manuelle de la classe (verrouillée, prioritaire sur DocuSeal).
- Relances individuelles et en masse (via l'API DocuSeal, message Pronote / e-mail pré-rempli).
- Exports Excel et PDF, document récapitulatif imprimable.
- Rôles : **Administrateur** (mot de passe), **Consultation/Comptabilité** (lecture seule), **Enseignant** (mot de passe par voyage).
- Journal des synchronisations / webhooks.

### Nouveautés v1.2 (pièces jointes)
- Module serveur `server/attachments.ts` : détection des champs « Fichier », téléchargement, nommage, classement, déplacement
  automatique en cas de changement de classe, vérification du modèle DocuSeal.
- Synchronisation automatique toutes les `AUTO_SYNC_MINUTES` minutes + déclenchement par **webhook** DocuSeal.
- Fiche élève : section **Pièces jointes (x/N)** avec Voir / Télécharger / Récupérer depuis DocuSeal.
- Tableau enseignant : indicateur **📎 x/N pièces** par élève (N = pièces demandées pour le voyage).
- Administration : bouton **📎** par voyage → vérification du modèle, état par classe, récupération immédiate.
- Politique **zéro cache navigateur** (en-têtes `no-store` partout, pas d'ETag), **aucune ressource externe** (Google Fonts retiré).
- Installateur **tout-en-un**, README auto-généré dans `/opt/readme`, push GitHub automatisé (création du dépôt privé si besoin).

## 2. Architecture

```
Parents (mobile/PC) ──► DocuSeal (Docker) ── formulaire : élève, classe, responsable,
                                               champs « Fichier » demandés, Signature
                              │
                              │  webhook (form.completed / submission.completed)  +  API REST (X-Auth-Token)
                              ▼
            ┌──────────── Portail Voyages (Node.js / Express, service systemd « portail-voyages ») ─────────────┐
            │  server.ts               routes API, en-têtes iframe + no-cache, fichiers statiques (dist/)       │
            │  server/db.ts            base JSON (data/database.json), synchro DocuSeal, relances, webhooks     │
            │  server/attachments.ts   pièces jointes : téléchargement → PIECES_DIR/<Voyage>/<Classe>/...       │
            │  server/auth.ts          jetons signés HMAC, scrypt, anti-brute-force                             │
            └─────────────────────────────────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS (Nginx Proxy Manager → http://IP_LXC:3000)
Enseignants / Admin / Compta : application React (Vite + Tailwind), utilisable seule ou en <iframe>
```

- **Frontend** : React 19, Vite 6, Tailwind CSS 4, lucide-react, jsPDF, xlsx. Compilé dans `dist/`.
- **Backend** : Express 4 compilé par esbuild dans `dist/server.cjs` (une seule commande `npm run build`).
- **Stockage** : fichier JSON (pas de SGBD à administrer) + fichiers des pièces jointes sur disque.
- **Sessions** : jetons en en-tête (`x-admin-token`, `x-consultation-token`) conservés en `sessionStorage`
  (effacés à la fermeture de l'onglet) → pas de cookie, donc **aucun problème de cookies tiers en iframe**.

### Arborescence sur le serveur

```
/root/installer-portail-voyages.sh     ← installateur tout-en-un déposé avec FileZilla
/root/portail-voyages-identifiants.txt ← mot de passe admin généré (chmod 600)
/opt/readme/README.md                  ← CE fichier
/opt/readme/README-CODE-COMPLET.md     ← tout le code source
/opt/portail-voyages/
├── app/                               ← application (dépôt GitHub)
│   ├── .env                           ← configuration (jamais écrasée, jamais poussée)
│   ├── data/database.json             ← base (jamais écrasée)
│   ├── backups/                       ← sauvegardes automatiques de la base
│   ├── dist/                          ← build (frontend + server.cjs)
│   ├── server.ts, server/*.ts, src/** ← code source
│   └── install.sh, update.sh, push-github.sh, generate-readme.sh, make-installer.sh
├── pieces-jointes/                    ← PIECES_DIR
│   └── <Voyage>/<Classe>/NOM_Prenom_Carte-Identite.pdf
│                          NOM_Prenom_Autorisation-Sortie-Territoire.jpg
│                          NOM_Prenom_Carte-Mutuelle-Europeenne.png
├── installer-portail-voyages.sh       ← copie du dernier installateur exécuté
└── backups-installer/                 ← archive .tgz de l'app avant chaque réinstallation
```

## 3. Installation (première fois)

1. **FileZilla** : connexion **SFTP** au LXC (hôte = IP du LXC, port 22, utilisateur `root`).
   Si la connexion root SFTP est refusée : dans le LXC `sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config && systemctl restart ssh`.
2. Déposer **`installer-portail-voyages.sh`** dans le répertoire **`/root/`**.
3. Dans la console Proxmox du LXC (ou SSH), en root :
   ```bash
   bash /root/installer-portail-voyages.sh
   ```
   Options :
   ```bash
   NGINX_DOMAIN=voyages.mon-ecole.fr bash /root/installer-portail-voyages.sh   # Nginx local en plus (sinon NPM)
   GITHUB_PUSH=1 bash /root/installer-portail-voyages.sh                       # pousse sur GitHub à la fin
   GITHUB_TOKEN=ghp_xxx GITHUB_PUSH=1 bash /root/installer-portail-voyages.sh  # sans question
   ```
4. Le mot de passe administrateur est affiché et copié dans `/root/portail-voyages-identifiants.txt`.
5. **Nginx Proxy Manager** : *Hosts → Proxy Hosts → Add* : domaine `voyages.mon-ecole.fr`, scheme `http`,
   IP du LXC, port `3000`, cocher *Block Common Exploits* et *Websockets Support*, onglet SSL : Let's Encrypt + *Force SSL*.
   **Ne pas** ajouter `X-Frame-Options` dans *Advanced* (bloquerait l'iframe). Pour les gros fichiers, *Advanced* :
   `client_max_body_size 50M;`
6. Ouvrir le portail → **Administration** → *Ajouter un site DocuSeal* (URL de DocuSeal, clé API, modèle).
7. Configurer le **modèle DocuSeal** (§ 5) et le **webhook** (§ 6), puis bouton **📎** du voyage → *Vérifier*.

### Ce que fait l'installateur tout-en-un
1. Vérifie root, corrige les fins de ligne Windows (CRLF) éventuelles.
2. Archive l'application existante (`/opt/portail-voyages/backups-installer/app_AAAAMMJJ_HHMMSS.tgz`) et la base.
3. Écrit **tous les fichiers du projet** (squelette + contenu) dans `/opt/portail-voyages/app/` (sans toucher à `.env`, `data/`, pièces jointes).
4. Lance `install.sh` : paquets Debian, Node.js 24 LTS (NodeSource), utilisateur système `portail-voyages`, `.env`
   (mot de passe aléatoire), `npm ci` + `npm run build`, droits, service systemd, test `/api/health`,
   Nginx optionnel, README (`/opt/readme`), push GitHub (si identifiants enregistrés ou `GITHUB_PUSH=1`).

## 4. Mises à jour

- **Méthode recommandée** : déposer le nouvel `installer-portail-voyages.sh` dans **`/root/`** (FileZilla) puis :
  ```bash
  bash /root/installer-portail-voyages.sh
  ```
- **Fichiers modifiés à la main** (FileZilla dans `/opt/portail-voyages/app/…`) puis :
  ```bash
  bash /opt/portail-voyages/app/update.sh
  ```
- **Depuis GitHub** :
  ```bash
  GIT_PULL=1 bash /opt/portail-voyages/app/update.sh
  ```
- **Régénérer un installateur tout-en-un** à partir de l'application actuelle :
  ```bash
  bash /opt/portail-voyages/app/make-installer.sh     # → /opt/portail-voyages/installer-portail-voyages.sh
  ```
Chaque mise à jour : sauvegarde de la base, build, redémarrage, **README régénéré**, push GitHub si identifiants présents.

## 5. Configuration du modèle DocuSeal (fiche d'inscription)

Dans DocuSeal (*Modèles → votre fiche → Modifier*), créer les champs suivants (les noms sont reconnus automatiquement,
majuscules/accents indifférents) :

| Champ DocuSeal | Type | Rôle | Remarque |
|---|---|---|---|
| `Nom de l'enfant` | Texte | Parent 1 (1re partie) | obligatoire |
| `Prénom de l'enfant` | Texte | Parent 1 | obligatoire |
| `Classe` | Liste déroulante (ex. 4A, 4B…) | Parent 1 | obligatoire — sert au classement des dossiers |
| `Nom du responsable` | Texte | Parent 1 | obligatoire |
| `Prénom du responsable` | Texte | Parent 1 | obligatoire |
| `Téléphone du responsable` | Téléphone | Parent 1 | facultatif |
| **une ligne par pièce demandée** (ex. `Carte d'identité`, `Fiche sanitaire`…) | **Fichier** | Parent 1 | obligatoire, **avant la signature** |
| `Signature` | Signature | Parent 1 | en dernier |
| `Signature` | Signature | Parent 2 (2e partie) | si double signature |

### Pièces jointes demandées : configuration par voyage
Administration → ✏️ *Modifier* le voyage → **« Pièces jointes demandées aux parents »** (une pièce par ligne) :
- boutons de préréglage : *Voyage dans l'Union européenne*, *Voyage hors Union européenne*, *Sortie / séjour en France*,
  *Aucune pièce jointe* — puis modifier librement le texte ;
- mots-clés facultatifs après `|` (autres noms de champ DocuSeal acceptés), ex. `Fiche sanitaire | sanitaire, vaccins` ;
- ou bouton **📎 → « Reprendre les champs Fichier du modèle »** : la liste est construite automatiquement à partir des
  champs *Fichier* trouvés dans le modèle DocuSeal du voyage.
- Les voyages créés avant la v1.4 (sans liste) gardent les 3 pièces historiques (carte d'identité, AST, CEAM).
- Changer la liste après coup reclasse et renomme automatiquement les fichiers déjà reçus.

Rapprochement champ DocuSeal ↔ pièce : nom identique (majuscules/accents/ponctuation ignorés), puis nom du champ
contenant le libellé, puis mots-clés. Mots-clés intégrés pour les pièces courantes :
- Carte d'identité : `identité`, `carte d'identité`, `CNI`, `pièce d'identité`
- Passeport : `passeport`, `passport`
- Autorisation de sortie du territoire : `sortie du territoire`, `autorisation de sortie`, `AST`, `cerfa 15646`
- Carte de mutuelle européenne : `mutuelle`, `CEAM`, `carte européenne`, `européenne`

**Placer les pièces juste avant la signature** : dans le constructeur, la liste des champs (panneau de droite) définit
l'ordre des étapes du formulaire ; glisser les champs *Fichier* **au-dessus** du champ *Signature* du même rôle.
Sur mobile, DocuSeal propose alors « Prendre une photo » ou « Choisir un fichier » pour chaque pièce.

Tout autre champ *Fichier* est aussi récupéré (catégorie « Autres fichiers », nommé d'après le champ).
Le bouton **📎 → Vérification du modèle** contrôle, pour chaque pièce demandée : présence du champ, type *Fichier*,
obligatoire, position avant la signature ; il liste aussi les champs *Fichier* du modèle non demandés dans le portail.

## 6. Webhook DocuSeal (temps réel)

DocuSeal → *Paramètres → Webhooks* → URL :
```
https://voyages.mon-ecole.fr/api/webhooks/docuseal/<ID_DU_VOYAGE>
```
(l'URL exacte est affichée par le bouton 🔗 *Webhook* du voyage dans l'Administration). Événements : `form.completed`,
`submission.completed`, `submission.created`. Si `WEBHOOK_SECRET` est défini dans `.env`, ajouter `?secret=<valeur>` à l'URL
(ou l'en-tête `X-Webhook-Secret`). À chaque webhook : synchronisation complète du voyage (anti-rebond 3 s) puis
téléchargement des pièces des parents qui viennent de signer. Sans webhook, la synchronisation automatique
(`AUTO_SYNC_MINUTES`, 15 min par défaut) fait le même travail.

> DocuSeal dans Docker sur le même LXC/hôte : l'URL DocuSeal saisie dans le portail doit être joignable **depuis le LXC du
> portail** (ex. `http://192.168.1.50:3001` ou `https://docuseal.mon-ecole.fr`). Si DocuSeal utilise un certificat auto-signé :
> `ALLOW_INSECURE_TLS=true` dans `.env`.

## 7. Pièces jointes : fonctionnement détaillé

1. Le parent remplit la fiche, téléverse les pièces demandées pour ce voyage, **signe**.
2. DocuSeal envoie le webhook (ou la synchro périodique / manuelle passe).
3. Le portail met à jour l'inscription (élève, classe, signatures) puis, **pour chaque parent ayant signé**,
   lit ses valeurs (`GET /api/submissions/{id}`, à défaut `GET /api/submitters/{id}`) et télécharge chaque fichier
   (URL fournie par DocuSeal, en-tête `X-Auth-Token`).
4. Enregistrement **atomique** dans :
   ```
   PIECES_DIR/<Voyage>/<Classe>/<NOM>_<Prenom>_<Piece>.<ext>
   ex. /opt/portail-voyages/pieces-jointes/Sejour-Berlin-2027/4B/DUPONT_Lea_Carte-Identite.pdf
   ```
   - noms sans accents ni espaces (compatibles Windows/Samba) ; extension déduite du type MIME (pdf, jpg, png, heic…) ;
   - plusieurs fichiers dans un même champ → suffixe `_2`, `_3` ;
   - homonyme dans la même classe → suffixe `_Dossier<n°>` (aucun écrasement) ;
   - `PIECES_PAR_VOYAGE=false` → `PIECES_DIR/<Classe>/…`.
5. Un signataire déjà traité n'est plus re-téléchargé (liste `pieces_submitters_traites`), sauf « Récupérer à nouveau ».
6. **Changement de classe** (correction par l'enseignant ou dans DocuSeal) → fichiers **déplacés** automatiquement dans
   le dossier de la nouvelle classe (les dossiers vides sont supprimés). Idem si le nom de l'élève est corrigé.
7. Consultation dans le portail : fiche élève → *Pièces jointes (x/N)* → **Voir** / **Télécharger** (mêmes droits que
   la liste des élèves : admin, compta, ou mot de passe du voyage).
   **Toute une classe d'un coup** : tableau de bord → cliquer sur la carte de la classe (ou choisir la classe dans le
   filtre) → bouton **📎 Pièces jointes 4B (.zip)**. L'archive contient un dossier par élève :
   ```
   Sejour-Berlin-2027_4B_pieces-jointes.zip
   ├── Recapitulatif_pieces.csv          (Classe ; Nom ; Prénom ; pièce présente OUI / MANQUANTE)
   └── 4B/
       ├── DUPONT_Lea/   DUPONT_Lea_Carte-Identite.pdf, …_Autorisation-Sortie-Territoire.jpg, …_Carte-Mutuelle-Europeenne.png
       └── MARTIN_Hugo/  …
   ```
   Sans filtre de classe : toutes les classes du voyage (un dossier par classe puis par élève).
8. Erreurs (fichier trop gros, DocuSeal injoignable…) : visibles dans le **Journal** (type `pieces_jointes`) et
   `journalctl -u portail-voyages`.

Partager le dossier sur le réseau (optionnel, Samba) :
```bash
apt install -y samba
cat >> /etc/samba/smb.conf <<'EOF'
[pieces-voyages]
   path = /opt/portail-voyages/pieces-jointes
   read only = yes
   valid users = @portail-voyages
EOF
adduser secretariat && usermod -aG portail-voyages secretariat && smbpasswd -a secretariat
systemctl restart smbd
```

## 8. Intégration en iframe

```html
<iframe src="https://voyages.mon-ecole.fr" style="width:100%;height:100vh;min-height:900px;border:0"
        allow="clipboard-write" loading="lazy"></iframe>
```
- Pas de `X-Frame-Options` ; `Content-Security-Policy: frame-ancestors <FRAME_ANCESTORS>` (défaut `*`).
  Restreindre : `FRAME_ANCESTORS="https://intranet.mon-ecole.fr https://ent.mon-ecole.fr"`.
- Sessions par jetons (pas de cookies) → fonctionne en iframe cross-site, y compris Safari.
- Iframe `sandbox` : `allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals`.
- Nginx Proxy Manager : ne pas ajouter `X-Frame-Options`.

## 9. Zéro cache navigateur — 100 % serveur

- Toutes les réponses (HTML, JS, CSS, API, pièces jointes) : `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`,
  `Pragma: no-cache`, `Expires: 0` ; ETag et Last-Modified désactivés ; appels API en `fetch(..., {cache:'no-store'})`.
- `index.html` contient aussi les balises `<meta http-equiv>` équivalentes.
- Aucune ressource externe (polices système, pas de CDN) : tout est servi par le LXC.
- Seuls les jetons de session sont gardés en `sessionStorage` (pas de données métier), effacés à la fermeture de l'onglet.

## 10. Responsive / mobile

Tailwind (classes `sm:` / `md:` / `lg:`), modales plein écran sur téléphone avec gros boutons de fermeture,
tableaux à défilement horizontal, boutons tactiles (`touch-manipulation`), grilles qui passent en 1 colonne sous 640 px.

## 11. Rôles et sécurité

| Rôle | Accès | Authentification |
|---|---|---|
| Administrateur | tout (voyages, clés API, purge, mots de passe, pièces) | `ADMIN_PASSWORD` (.env) ou mot de passe changé dans l'interface (scrypt) |
| Consultation / Comptabilité | lecture de tous les voyages, exports, pièces | mot de passe consultation (Administration) |
| Enseignant | un voyage : liste, classes, relances, pièces | mot de passe du voyage (facultatif) |

Jetons HMAC-SHA256 à durée limitée (`SESSION_TTL_HOURS`), limitation à 10 essais / 15 min, échappement HTML,
chemins de fichiers vérifiés (pas de sortie de `PIECES_DIR`), service systemd non-root (`ProtectSystem=full`,
`NoNewPrivileges`, écriture limitée à `data/`, `backups/`, `PIECES_DIR`), `.env` en 640, clés API jamais envoyées
aux non-admins. **Les pièces jointes sont des données personnelles sensibles** : restreindre l'accès au dossier,
les supprimer après le voyage (`rm -rf /opt/portail-voyages/pieces-jointes/<Voyage>`), ne pas les pousser sur GitHub
(elles sont hors du dossier `app/`).

## 12. Sauvegarde / restauration

```bash
# Sauvegarde complète (base + .env + pièces jointes)
tar czf /root/sauvegarde-voyages_$(date +%F).tgz -C /opt/portail-voyages app/data app/.env pieces-jointes
# Restauration de la base
systemctl stop portail-voyages
cp /opt/portail-voyages/app/backups/database_AAAAMMJJ_HHMMSS.json /opt/portail-voyages/app/data/database.json
chown portail-voyages: /opt/portail-voyages/app/data/database.json && systemctl start portail-voyages
# Revenir à la version précédente de l'application
ls /opt/portail-voyages/backups-installer/
tar xzf /opt/portail-voyages/backups-installer/app_AAAAMMJJ_HHMMSS.tgz -C /opt/portail-voyages && bash /opt/portail-voyages/app/install.sh
```
Penser aussi aux sauvegardes Proxmox (vzdump) du LXC.

## 13. GitHub

```bash
bash /opt/portail-voyages/app/push-github.sh "message du commit"
```
- Utilisateur : `serviceinformatique-droid` ; dépôt : `orgavoyageV2` (créé **privé** automatiquement si absent).
- Jeton (PAT classic, portée `repo`) demandé une fois puis stocké dans `/root/.git-credentials` (chmod 600) ;
  ou `GITHUB_TOKEN=ghp_xxx bash push-github.sh`. Changer de jeton : `rm /root/.git-credentials`.
- Envoyé : code, scripts, README (copie de `/opt/readme/README.md`), `docs/README-CODE-COMPLET.md`.
  Jamais envoyé : `.env`, `data/`, `backups/`, `node_modules/`, `dist/`, pièces jointes.

## 14. Dépannage

| Symptôme | Vérification / solution |
|---|---|
| Portail inaccessible | `systemctl status portail-voyages` ; `journalctl -u portail-voyages -n 100 --no-pager` ; `curl http://127.0.0.1:3000/api/health` |
| Port déjà utilisé | `ss -ltnp | grep 3000` → changer `PORT` dans `.env` + NPM |
| Iframe blanche / refusée | console navigateur : `frame-ancestors` → ajuster `FRAME_ANCESTORS` ; retirer `X-Frame-Options` dans NPM |
| Synchro DocuSeal en erreur | Administration → ⚡ tester ; clé API (DocuSeal → Paramètres → API) ; URL joignable depuis le LXC : `curl -I https://docuseal…` |
| Pièces non récupérées | 📎 du voyage → *Vérification du modèle* ; le parent a-t-il **signé** ? ; Journal (type pieces_jointes) ; `ls -lR /opt/portail-voyages/pieces-jointes` |
| « fichier trop volumineux » | augmenter `PIECES_TAILLE_MAX_MO` |
| Erreur d'écriture des pièces | droits : `chown -R portail-voyages: /opt/portail-voyages/pieces-jointes` ; `PIECES_DIR` dans `ReadWritePaths` (relancer `install.sh`) |
| Webhook sans effet | Journal → entrée « Webhook DocuSeal reçu » ? sinon URL/secret ; tester : `curl -X POST https://…/api/webhooks/docuseal/<id> -H 'Content-Type: application/json' -d '{}'` |
| Mot de passe admin perdu | `grep ADMIN_PASSWORD /opt/portail-voyages/app/.env` (si changé dans l'interface : remettre `ADMIN_PASSWORD=` puis restart) |
| Build qui échoue | `cd /opt/portail-voyages/app && rm -rf node_modules && npm ci --include=dev && npm run build` |
| Script avec `\r` (édité sous Windows) | `sed -i 's/\r$//' /root/installer-portail-voyages.sh` |

## 15. Commandes utiles

```bash
systemctl restart portail-voyages            # redémarrer
journalctl -u portail-voyages -f             # logs en direct
nano /opt/portail-voyages/app/.env           # configuration (puis restart)
bash /opt/portail-voyages/app/update.sh      # reconstruire + redémarrer + README + GitHub
bash /opt/portail-voyages/app/generate-readme.sh
bash /opt/portail-voyages/app/push-github.sh "message"
bash /opt/portail-voyages/app/make-installer.sh
find /opt/portail-voyages/pieces-jointes -type f | wc -l
du -sh /opt/portail-voyages/pieces-jointes/*
```

## 16. Référence API

Authentification : en-tête `x-admin-token` / `x-consultation-token` (ou `?adminToken=` / `?consultationToken=` pour les liens),
mot de passe de voyage : `x-voyage-password` ou `?password=`.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | /api/health | public | état |
| POST | /api/auth/login | public | `{role, password}` → jeton |
| GET | /api/voyages, /api/voyages/:id | public (clés masquées) | voyages |
| POST/PUT/DELETE | /api/voyages[/:id] | admin | gérer les voyages |
| POST | /api/voyages/:id/sync | voyage | synchronisation DocuSeal (+ pièces en arrière-plan) |
| GET | /api/voyages/:id/inscriptions | voyage | élèves (filtres `search`, `classe`, `statut`) |
| PUT | /api/inscriptions/:id | voyage (classe) / admin | modifier (déplace les pièces si la classe change) |
| POST | /api/inscriptions/:id/relance | voyage | relance parent |
| GET | /api/inscriptions/:id/document | voyage | récapitulatif imprimable |
| GET | /api/inscriptions/:id/pieces/:index | voyage | afficher / télécharger (`?download=1`) une pièce |
| POST | /api/inscriptions/:id/pieces/refresh | voyage | re-télécharger les pièces de l'élève |
| GET | /api/voyages/:id/pieces/summary | voyage | pièces reçues / manquantes par classe |
| POST | /api/voyages/:id/pieces/from-template | admin | pièces demandées = champs Fichier du modèle DocuSeal |
| GET | /api/voyages/:id/pieces/zip?classe=4B | voyage | ZIP des pièces d'une classe, un dossier par élève (`classe=Toutes` : tout le voyage) |
| POST | /api/voyages/:id/pieces/process | admin | synchro + récupération (`{force:true}` pour tout retélécharger) |
| GET | /api/voyages/:id/pieces/template-check | admin | vérifie les champs Fichier du modèle (pièces demandées) |
| POST | /api/webhooks/docuseal/:voyageId | DocuSeal | webhook (option `?secret=`) |
| GET | /api/voyages/:id/export/excel | voyage | export Excel |
| GET | /api/logs | admin | journal |

Liste exhaustive extraite du code :

MD
printf '```\n'
grep -oE "app\.(get|post|put|patch|delete)\('[^']+'" "$APP_DIR/server.ts" | sed -E "s/app\.([a-z]+)\('(.*)'/\U\1\E \2/" | sort -k2 | uniq
printf '```\n\n'

# ---------------------------------------------------------------------------
cat <<'MD'
## 17. Historique des versions

- **1.4.0** — Le portail n'est plus limité au voyage en Allemagne : **pièces jointes demandées configurables voyage par
  voyage** (préréglages UE / hors UE / France / aucune, texte libre avec mots-clés, ou reprise automatique des champs
  Fichier du modèle DocuSeal). Compteurs x/N, vérification du modèle, récapitulatif CSV du ZIP et classement des fichiers
  suivent la liste du voyage ; changement de liste = reclassement automatique des fichiers déjà reçus.

- **1.3.0** — Téléchargement **ZIP des pièces jointes par classe, rangées par élève** depuis le tableau de bord
  (bouton « 📎 Pièces jointes <classe> (.zip) » à côté d'Excel : il suit la classe sélectionnée ; « toutes classes » si
  aucun filtre) et depuis le panneau 📎 de l'Administration. Contenu : `<Classe>/<NOM_Prenom>/<fichiers>` +
  `Recapitulatif_pieces.csv` (OUI / MANQUANTE par pièce, s'ouvre dans Excel). Dépendance ajoutée : `archiver`.

- **1.2.0** — Pièces jointes DocuSeal (carte d'identité, autorisation de sortie du territoire, carte mutuelle européenne)
  copiées sur le serveur après signature, nommées `NOM_Prenom_Piece` et classées par classe ; déplacement auto si la classe
  change ; vérification du modèle ; synchro automatique + webhook ; zéro cache navigateur ; suppression de Google Fonts ;
  Node.js 24 ; installateur tout-en-un ; README auto dans `/opt/readme` ; push GitHub avec création du dépôt.
- **1.1.0** — Version corrigée : sécurité (jetons signés, scrypt, anti-brute-force), iframe (CSP frame-ancestors),
  doubles signatures, relances, exports, consultation/comptabilité.

## 18. Contexte à donner dans une nouvelle discussion

```
Projet : Portail des Voyages Scolaires (React 19 + Vite 6 + Tailwind 4 / Express 4, TypeScript), connecté à DocuSeal.
Serveur : LXC Proxmox Debian 12, Node 24, service systemd "portail-voyages", app dans /opt/portail-voyages/app,
port 3000 derrière Nginx Proxy Manager, DocuSeal en Docker. Base JSON data/database.json.
Pièces jointes configurables par voyage (src/piecesConfig.ts) : server/attachments.ts → /opt/portail-voyages/pieces-jointes/<Voyage>/<Classe>/NOM_Prenom_Piece.ext
Livraison : un installateur tout-en-un /root/installer-portail-voyages.sh (heredocs cat) qui écrit tous les fichiers
puis lance install.sh ; README auto dans /opt/readme ; push GitHub serviceinformatique-droid/orgavoyageV2.
Contraintes : 100 % responsive, fonctionne en iframe, aucun cache navigateur, toujours indiquer le dossier FileZilla
et la commande d'exécution, régénérer le README à chaque mise à jour.
```

## 19. Arborescence du code source

MD
printf '```\n'
(cd "$APP_DIR" && find . \( -path ./node_modules -o -path ./dist -o -path ./.git -o -path ./data -o -path ./backups \) -prune -o -type f -printf '%P  (%s o)\n' | sort)
printf '```\n\n'

# ---------------------------------------------------------------------------
cat <<'MD'
## 20. Annexes — scripts et fichiers de configuration (contenu intégral)

MD
dump "$APP_DIR/install.sh" bash
dump "$APP_DIR/update.sh" bash
dump "$APP_DIR/push-github.sh" bash
dump "$APP_DIR/generate-readme.sh" bash
dump "$APP_DIR/make-installer.sh" bash
printf '\n### `/etc/systemd/system/%s.service` (généré par install.sh)\n\n````ini\n' "$SERVICE"
cat "/etc/systemd/system/${SERVICE}.service" 2>/dev/null || echo "(non installé)"
printf '\n````\n'
dump "$APP_DIR/nginx-portail.conf" nginx
dump "$APP_DIR/.env.example" ini
dump "$APP_DIR/package.json" json
dump "$APP_DIR/vite.config.ts" ts
dump "$APP_DIR/tsconfig.json" json
dump "$APP_DIR/.gitignore"

cat <<'MD'

## 21. Annexes — code serveur principal

MD
dump "$APP_DIR/server/attachments.ts" ts
dump "$APP_DIR/server.ts" ts
dump "$APP_DIR/server/auth.ts" ts
dump "$APP_DIR/src/types.ts" ts

printf '\n---\nLe code source complet (frontend + backend) est dans `%s` et sur GitHub.\n' "$OUT_CODE"
} > "$OUT"

# ---------------------------------------------------------------------------
# Code source intégral
{
  printf '# Portail Voyages Scolaires v%s — code source complet\n\nGénéré le %s depuis `%s`.\n' "$VERSION" "$NOW" "$APP_DIR"
  (cd "$APP_DIR" && find . \( -path ./node_modules -o -path ./dist -o -path ./.git -o -path ./data -o -path ./backups -o -path ./docs \) -prune -o -type f -print | sed 's#^\./##' | sort) |
  while read -r f; do
    case "$f" in
      .env|package-lock.json|README.md) continue ;;
    esac
    ext="${f##*.}"
    case "$ext" in ts|tsx) lang=ts ;; sh) lang=bash ;; json) lang=json ;; css) lang=css ;; html) lang=html ;; conf) lang=nginx ;; *) lang="" ;; esac
    dump "$APP_DIR/$f" "$lang"
  done
} > "$OUT_CODE"

cp "$OUT" "$APP_DIR/README.md"
chmod 644 "$OUT" "$OUT_CODE"
echo "✅ README généré : $OUT ($(du -h "$OUT" | cut -f1)) + $OUT_CODE ($(du -h "$OUT_CODE" | cut -f1))"

````

### `make-installer.sh`

````bash
#!/usr/bin/env bash
# ==============================================================================
# Fabrique l'installateur TOUT-EN-UN à partir de l'application actuelle
# Emplacement : /opt/portail-voyages/app/make-installer.sh
# Usage (root) : bash /opt/portail-voyages/app/make-installer.sh [fichier_de_sortie]
#   défaut : /opt/portail-voyages/installer-portail-voyages.sh
# Le fichier produit contient TOUS les fichiers du projet (heredocs "cat", base64 pour les binaires),
# encadrés par installer/header.sh et installer/footer.sh. À récupérer avec FileZilla pour
# réinstaller sur un autre LXC : le déposer dans /root/ puis  bash /root/installer-portail-voyages.sh
# ==============================================================================
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$APP_DIR")"
OUT="${1:-$BASE_DIR/installer-portail-voyages.sh}"
D="__PVS_FIN_DU_FICHIER__"
VERSION="$(grep -m1 '"version"' "$APP_DIR/package.json" | sed -E 's/.*"([0-9.]+)".*/\1/')"
NOW="$(date '+%d/%m/%Y %H:%M')"

cd "$APP_DIR"
mapfile -t FILES < <(find . \( -path ./node_modules -o -path ./dist -o -path ./.git -o -path ./data -o -path ./backups -o -path ./docs \) -prune \
  -o -type f ! -name '.env' ! -name '*.log' ! -name 'installer-portail-voyages*.sh' -print | sed 's#^\./##' | LC_ALL=C sort)
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
chmod 750 "$OUT"
bash -n "$OUT" && echo "✅ Installateur créé : $OUT ($COUNT fichiers, $(du -h "$OUT" | cut -f1))"
echo "   FileZilla : déposer dans /root/ du LXC cible, puis : bash /root/$(basename "$OUT")"

````

### `/etc/systemd/system/portail-voyages.service` (généré par install.sh)

````ini
[Unit]
Description=Portail des Voyages Scolaires (DocuSeal + pièces jointes)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=portail-voyages
Group=portail-voyages
WorkingDirectory=/opt/portail-voyages/app
EnvironmentFile=/opt/portail-voyages/app/.env
ExecStart=/usr/bin/node /opt/portail-voyages/app/dist/server.cjs
Restart=always
RestartSec=5
UMask=0027
StandardOutput=journal
StandardError=journal
SyslogIdentifier=portail-voyages
ProtectSystem=full
ProtectHome=true
NoNewPrivileges=true
ReadWritePaths=/opt/portail-voyages/app/data /opt/portail-voyages/app/backups /opt/portail-voyages/pieces-jointes

[Install]
WantedBy=multi-user.target

````

### `nginx-portail.conf`

````nginx
# /etc/nginx/sites-available/portail-voyages.conf
# Compatible iframe : AUCUN en-tête X-Frame-Options ici (il bloquerait l'intégration).
# Le contrôle des sites autorisés se fait dans .env via FRAME_ANCESTORS (en-tête CSP frame-ancestors).
server {
    listen 80;
    server_name voyages.mon-etablissement.fr;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;

        # Ne pas ajouter/laisser passer X-Frame-Options : l'iframe serait refusée
        proxy_hide_header X-Frame-Options;

        # 100 % serveur : pas de cache proxy (les en-têtes no-store sont posés par l'application Node)
        proxy_buffering off;
        proxy_cache off;
    }
}

````

### `.env.example`

````ini
# ===== Portail Voyages Scolaires — configuration =====
# Fichier réel : /opt/portail-voyages/app/.env (créé automatiquement par install.sh, jamais écrasé)
# Après modification : systemctl restart portail-voyages

PORT=3000
NODE_ENV=production

# Mot de passe administrateur. install.sh en génère un aléatoire à la 1re installation
# (copie dans /root/portail-voyages-identifiants.txt).
ADMIN_PASSWORD=ChangezMoi-MotDePasseLong

# Mot de passe "consultation / comptabilité" initial (optionnel, modifiable ensuite dans Administration)
# CONSULTATION_PASSWORD=

# Secret de signature des sessions (optionnel : généré automatiquement dans data/.session-secret)
# SESSION_SECRET=

# Durée de validité d'une session admin / consultation, en heures (défaut 12)
# SESSION_TTL_HOURS=12

# Secret du webhook DocuSeal (optionnel mais conseillé). Si défini, DocuSeal doit l'envoyer :
# en-tête "X-Webhook-Secret: <secret>" ou URL ...?secret=<secret>
# WEBHOOK_SECRET=

# IFRAME : sites autorisés à intégrer le portail (séparés par des espaces). "*" = tous.
# Exemple : FRAME_ANCESTORS="https://intranet.mon-ecole.fr https://ent.mon-ecole.fr"
FRAME_ANCESTORS=*

# Mettre "true" UNIQUEMENT si vos instances DocuSeal utilisent un certificat auto-signé
ALLOW_INSECURE_TLS=false

APP_URL=https://voyages.mon-etablissement.fr

# ===== Pièces jointes DocuSeal (liste des pièces configurée voyage par voyage dans l'Administration) =====
# Dossier du serveur où les pièces sont copiées après signature
PIECES_DIR=/opt/portail-voyages/pieces-jointes
# true  : PIECES_DIR/<Voyage>/<Classe>/NOM_Prenom_Piece.ext
# false : PIECES_DIR/<Classe>/NOM_Prenom_Piece.ext
PIECES_PAR_VOYAGE=true
# Taille maximale d'un fichier téléchargé (Mo)
PIECES_TAILLE_MAX_MO=30

# Synchronisation automatique DocuSeal + récupération des pièces (minutes, 0 = désactivée)
AUTO_SYNC_MINUTES=15

````

### `package.json`

````json
{
  "name": "portail-voyages-scolaires",
  "private": true,
  "version": "1.4.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "start": "node dist/server.cjs",
    "preview": "vite preview",
    "clean": "rm -rf dist server.js",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@tailwindcss/vite": "^4.1.14",
    "@vitejs/plugin-react": "^5.0.4",
    "archiver": "^7.0.1",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.8",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/archiver": "^6.0.4",
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "autoprefixer": "^10.4.21",
    "esbuild": "^0.25.0",
    "tailwindcss": "^4.1.14",
    "tsx": "^4.21.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.3"
  }
}

````

### `vite.config.ts`

````ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1500,
    },
  };
});

````

### `tsconfig.json`

````json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}

````

### `.gitignore`

````
node_modules/
dist/
build/
coverage/
.DS_Store
*.log
.env
.env.*
!.env.example
data/
backups/

````

## 21. Annexes — code serveur principal


### `server/attachments.ts`

````ts
/**
 * Pièces jointes DocuSeal -> serveur
 * ----------------------------------
 * Les parents téléversent dans le formulaire DocuSeal (champs de type "Fichier", placés avant la signature)
 * les pièces demandées POUR CE VOYAGE (liste configurable : voir src/piecesConfig.ts), par exemple
 * carte d'identité + autorisation de sortie du territoire + carte européenne d'assurance maladie pour un voyage
 * dans l'UE, passeport + assurance rapatriement hors UE, fiche sanitaire pour une sortie en France…
 * Dès qu'un parent a signé, ses fichiers sont téléchargés depuis DocuSeal et rangés sur le serveur :
 *   PIECES_DIR/<Voyage>/<Classe>/<NOM>_<Prenom>_<Piece>.<ext>
 * Si la classe (ou le nom) de l'élève change ensuite, les fichiers sont déplacés / renommés automatiquement.
 */
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import type { Response } from 'express';
import { Inscription, PieceJointe, PieceRequise, Voyage } from '../src/types.js';
import { detecterPiece, normPiece, piecesDuVoyage, safeName, suffixePiece } from '../src/piecesConfig.js';
import { db, normalizeDocuSealUrl } from './db.js';

export { safeName };

export const PIECES_DIR = path.resolve(process.env.PIECES_DIR || path.join(process.cwd(), '..', 'pieces-jointes'));
// true (défaut) : PIECES_DIR/<Voyage>/<Classe>/   —   false : PIECES_DIR/<Classe>/
const PAR_VOYAGE = (process.env.PIECES_PAR_VOYAGE || 'true').toLowerCase() !== 'false';
const MAX_BYTES = (parseInt(process.env.PIECES_TAILLE_MAX_MO || '30', 10) || 30) * 1024 * 1024;

const nowStr = () => new Date().toISOString().replace('T', ' ').substring(0, 16);

function capitalize(s: string): string {
  return s
    .toLowerCase()
    .split('-')
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join('-');
}

function isSignatureField(name: string): boolean {
  return /\b(signature|signer|paraphe|initiales?|initials?)\b/.test(normPiece(name));
}

/** Définition (libellé + suffixe de fichier) d'une pièce, y compris "autre" (champ Fichier non prévu) */
function definitionPiece(voyage: Voyage, fieldName: string): { type: string; libelle: string; suffixe: string } {
  const p = detecterPiece(piecesDuVoyage(voyage), fieldName);
  if (p) return { type: p.id, libelle: p.libelle, suffixe: suffixePiece(p) };
  return { type: 'autre', libelle: fieldName, suffixe: suffixePiece({ libelle: fieldName }) };
}
function looksLikeFileUrl(v: unknown): v is string {
  return typeof v === 'string' && (/^https?:\/\//i.test(v) || v.startsWith('/')) && v.length < 4000;
}

/** Liste des fichiers (champ, url) présents dans les valeurs d'un signataire DocuSeal */
export function extractFileValues(submitter: any, pieces: PieceRequise[]): Array<{ field: string; url: string; index: number }> {
  const out: Array<{ field: string; url: string; index: number }> = [];
  const push = (field: string, value: unknown) => {
    if (!field || isSignatureField(field)) return;
    const urls = (Array.isArray(value) ? value : [value]).filter(looksLikeFileUrl);
    const isPiece = Boolean(detecterPiece(pieces, field));
    urls.forEach((url, i) => {
      // Champ non reconnu : on ne garde que les URL qui ressemblent vraiment à un fichier DocuSeal
      if (!isPiece && !/\/(file|blobs?|storage|attachments?|rails\/active_storage)\//i.test(url)) return;
      out.push({ field, url, index: i });
    });
  };
  const values = submitter?.values;
  if (Array.isArray(values)) {
    for (const item of values) push(item?.field ?? item?.name ?? item?.title, item?.value ?? item?.url);
  } else if (values && typeof values === 'object') {
    for (const [k, v] of Object.entries(values)) push(k, v);
  }
  return out;
}

const MIME_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/tiff': '.tif',
};

function extensionFor(mime: string, url: string): string {
  const m = (mime || '').split(';')[0].trim().toLowerCase();
  if (MIME_EXT[m]) return MIME_EXT[m];
  try {
    const ext = path.extname(decodeURIComponent(new URL(url, 'http://x').pathname)).toLowerCase();
    if (/^\.[a-z0-9]{2,5}$/.test(ext)) return ext === '.jpeg' ? '.jpg' : ext;
  } catch {
    /* ignoré */
  }
  return '.bin';
}

/** Dossier relatif (à PIECES_DIR) attendu pour une inscription */
export function expectedDir(voyage: Voyage, item: Inscription): string {
  const classe = safeName(item.classe || 'Non spécifiée', 'Non-specifiee');
  return PAR_VOYAGE ? path.join(safeName(voyage.nom, `Voyage-${voyage.id}`), classe) : classe;
}

function baseFileName(item: Inscription, def: { suffixe: string }, index: number): string {
  const nom = safeName(item.eleve_nom, 'NOM').toUpperCase();
  const prenom = capitalize(safeName(item.eleve_prenom, 'Prenom'));
  return `${nom}_${prenom}_${def.suffixe}${index > 0 ? `_${index + 1}` : ''}`;
}

function absPath(rel: string): string {
  const abs = path.resolve(PIECES_DIR, rel);
  if (!abs.startsWith(PIECES_DIR + path.sep)) throw new Error('Chemin de pièce jointe invalide');
  return abs;
}

export function pieceAbsolutePath(p: PieceJointe): string {
  return absPath(p.chemin);
}

/** Choisit un nom libre (évite d'écraser le fichier d'un homonyme) */
function freeRelPath(dir: string, base: string, ext: string, item: Inscription, ownRel?: string): string {
  let rel = path.join(dir, `${base}${ext}`);
  if (rel === ownRel || !fs.existsSync(absPath(rel))) return rel;
  const owned = new Set((item.pieces_jointes || []).map((p) => p.chemin));
  if (owned.has(rel)) return rel;
  rel = path.join(dir, `${base}_Dossier${safeName(item.docuseal_submission_id, 'X')}${ext}`);
  return rel;
}

function authHeaders(voyage: Voyage): Record<string, string> {
  const key = voyage.docuseal_api_key?.trim() || '';
  return { 'X-Auth-Token': key, Authorization: `Bearer ${key}` };
}

async function fetchJson(voyage: Voyage, apiPath: string): Promise<any | null> {
  const base = normalizeDocuSealUrl(voyage.docuseal_url);
  const res = await fetch(`${base}${apiPath}`, {
    headers: { ...authHeaders(voyage), 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  return res.json();
}

async function downloadFile(voyage: Voyage, url: string): Promise<{ buffer: Buffer; mime: string }> {
  const base = normalizeDocuSealUrl(voyage.docuseal_url);
  const full = url.startsWith('/') ? `${base}${url}` : url;
  const res = await fetch(full, { headers: authHeaders(voyage), redirect: 'follow', signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} lors du téléchargement`);
  const len = parseInt(res.headers.get('content-length') || '0', 10);
  if (len > MAX_BYTES) throw new Error(`fichier trop volumineux (${Math.round(len / 1048576)} Mo)`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error('fichier trop volumineux');
  if (buffer.length === 0) throw new Error('fichier vide');
  return { buffer, mime: (res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim() };
}

function writeAtomic(abs: string, buffer: Buffer): void {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.part-${process.pid}`;
  fs.writeFileSync(tmp, buffer, { mode: 0o640 });
  fs.renameSync(tmp, abs);
}

/** Déplace / renomme les fichiers si la classe ou le nom de l'élève a changé. Retourne true si modifié. */
export function reconcileInscription(voyage: Voyage, item: Inscription): boolean {
  if (!item.pieces_jointes || item.pieces_jointes.length === 0) return false;
  let changed = false;
  const dir = expectedDir(voyage, item);
  const counters = new Map<string, number>();
  for (const p of item.pieces_jointes) {
    // La liste des pièces du voyage a pu changer : on rapproche à nouveau le champ DocuSeal
    const redetecte = definitionPiece(voyage, p.champ_docuseal);
    if (redetecte.type !== p.type) {
      p.type = redetecte.type;
      p.libelle = redetecte.libelle;
      changed = true;
    }
    const conf = piecesDuVoyage(voyage).find((d) => d.id === p.type);
    const def = { suffixe: conf ? suffixePiece(conf) : suffixePiece({ libelle: p.type === 'autre' ? p.champ_docuseal : p.libelle || p.champ_docuseal }) };
    const key = `${p.type}|${p.champ_docuseal}`;
    const idx = counters.get(key) || 0;
    counters.set(key, idx + 1);
    const ext = path.extname(p.fichier) || '.bin';
    const wanted = freeRelPath(dir, baseFileName(item, def, idx), ext, item, p.chemin);
    if (wanted === p.chemin) continue;
    try {
      const from = absPath(p.chemin);
      if (!fs.existsSync(from)) continue;
      const to = absPath(wanted);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);
      removeEmptyDirs(path.dirname(from));
      p.chemin = wanted;
      p.fichier = path.basename(wanted);
      changed = true;
      console.log(`[Pièces jointes] Déplacé : ${from} -> ${to}`);
    } catch (e: any) {
      console.error('[Pièces jointes] Déplacement impossible :', e?.message || e);
    }
  }
  return changed;
}

function removeEmptyDirs(dir: string): void {
  try {
    let d = dir;
    while (d.startsWith(PIECES_DIR + path.sep) && fs.readdirSync(d).length === 0) {
      fs.rmdirSync(d);
      d = path.dirname(d);
    }
  } catch {
    /* ignoré */
  }
}

/** Identifiants numériques des signataires DocuSeal ayant signé */
function signedSubmitterIds(item: Inscription): string[] {
  const ids: string[] = [];
  for (const p of [item.parent1, item.parent2]) {
    if (p?.statut === 'signed' && p.submitter_id && /^\d+$/.test(p.submitter_id)) ids.push(p.submitter_id);
  }
  return [...new Set(ids)];
}

export interface ProcessResult {
  nouveaux: number;
  erreurs: string[];
}

/**
 * Récupère les fichiers des parents ayant signé pour une inscription.
 * force=true : retélécharge tout (bouton "Récupérer à nouveau").
 */
export async function processInscription(voyage: Voyage, item: Inscription, force = false): Promise<ProcessResult> {
  const result: ProcessResult = { nouveaux: 0, erreurs: [] };
  if (!item.pieces_jointes) item.pieces_jointes = [];
  if (!item.pieces_submitters_traites) item.pieces_submitters_traites = [];

  const signed = signedSubmitterIds(item);
  const todo = force ? signed : signed.filter((id) => !item.pieces_submitters_traites!.includes(id));
  if (todo.length === 0 || !voyage.docuseal_api_key) {
    reconcileInscription(voyage, item);
    return result;
  }

  // Détail de la soumission (valeurs de tous les signataires)
  let submitters: any[] = [];
  try {
    const sub = await fetchJson(voyage, `/api/submissions/${encodeURIComponent(item.docuseal_submission_id)}`);
    if (sub && Array.isArray(sub.submitters)) submitters = sub.submitters;
  } catch (e: any) {
    result.erreurs.push(`${item.eleve_nom} ${item.eleve_prenom} : soumission illisible (${e?.message || e})`);
  }

  for (const sid of todo) {
    let s = submitters.find((x) => String(x.id) === sid);
    if (!s || !s.values) {
      try {
        s = (await fetchJson(voyage, `/api/submitters/${sid}`)) || s;
      } catch {
        /* ignoré */
      }
    }
    if (!s) {
      result.erreurs.push(`${item.eleve_nom} ${item.eleve_prenom} : signataire #${sid} introuvable`);
      continue;
    }

    const files = extractFileValues(s, piecesDuVoyage(voyage));
    let okForSubmitter = true;
    const dir = expectedDir(voyage, item);
    const perField = new Map<string, number>();

    for (const f of files) {
      const pieceDef = definitionPiece(voyage, f.field);
      const key = `${pieceDef.type}|${f.field}`;
      const idx = perField.get(key) || 0;
      perField.set(key, idx + 1);

      const already = item.pieces_jointes.find(
        (p) => p.submitter_id === sid && p.champ_docuseal === f.field && (p.index ?? 0) === idx
      );
      if (already && !force && fs.existsSync(absPath(already.chemin))) continue;

      try {
        const { buffer, mime } = await downloadFile(voyage, f.url);
        const ext = extensionFor(mime, f.url);
        const rel = freeRelPath(dir, baseFileName(item, pieceDef, idx), ext, item, already?.chemin);
        writeAtomic(absPath(rel), buffer);
        if (already && already.chemin !== rel) {
          try {
            fs.unlinkSync(absPath(already.chemin));
          } catch {
            /* ignoré */
          }
        }
        const piece: PieceJointe = {
          type: pieceDef.type,
          libelle: pieceDef.libelle,
          champ_docuseal: f.field,
          fichier: path.basename(rel),
          chemin: rel,
          taille: buffer.length,
          mime,
          submitter_id: sid,
          date_recuperation: nowStr(),
          index: idx,
        };
        item.pieces_jointes = item.pieces_jointes.filter((p) => p !== already);
        item.pieces_jointes.push(piece);
        result.nouveaux++;
        console.log(`[Pièces jointes] ${voyage.nom} / ${item.classe} : ${piece.fichier} (${buffer.length} o)`);
      } catch (e: any) {
        okForSubmitter = false;
        result.erreurs.push(`${item.eleve_nom} ${item.eleve_prenom} – ${f.field} : ${e?.message || e}`);
      }
    }

    if (okForSubmitter && !item.pieces_submitters_traites.includes(sid)) item.pieces_submitters_traites.push(sid);
  }

  reconcileInscription(voyage, item);
  return result;
}

/** Si une synchronisation a remplacé l'objet pendant le téléchargement, on reporte les pièces sur l'objet courant */
export function writeBack(item: Inscription): void {
  const cur = db.getInscriptionById(item.id);
  if (cur && cur !== item) {
    cur.pieces_jointes = item.pieces_jointes;
    cur.pieces_submitters_traites = item.pieces_submitters_traites;
  }
}

// ---- Traitement d'un voyage entier (verrou + anti-rebond) ----
const running = new Map<string, Promise<ProcessResult>>();
const timers = new Map<string, NodeJS.Timeout>();

export async function processVoyage(voyageId: string, force = false): Promise<ProcessResult> {
  const current = running.get(voyageId);
  if (current) return current;
  const job = (async () => {
    const total: ProcessResult = { nouveaux: 0, erreurs: [] };
    const voyage = db.getVoyageById(voyageId, true);
    if (!voyage) return total;
    for (const item of db.getInscriptions(voyageId)) {
      try {
        const r = await processInscription(voyage, item, force);
        total.nouveaux += r.nouveaux;
        total.erreurs.push(...r.erreurs);
        writeBack(item);
      } catch (e: any) {
        total.erreurs.push(`${item.eleve_nom} ${item.eleve_prenom} : ${e?.message || e}`);
      }
    }
    db.persist();
    if (total.nouveaux > 0 || total.erreurs.length > 0) {
      db.addLog({
        voyage_id: voyage.id,
        voyage_nom: voyage.nom,
        type: 'pieces_jointes',
        status: total.erreurs.length ? (total.nouveaux ? 'warning' : 'error') : 'success',
        message:
          `Pièces jointes : ${total.nouveaux} fichier(s) enregistré(s) dans ${PIECES_DIR}` +
          (total.erreurs.length ? ` — ${total.erreurs.length} erreur(s) : ${total.erreurs.slice(0, 3).join(' | ')}` : ''),
      });
      db.persist();
    }
    return total;
  })().finally(() => running.delete(voyageId));
  running.set(voyageId, job);
  return job;
}

/** Planifie (avec anti-rebond) une synchro DocuSeal + récupération des pièces pour un voyage */
export function scheduleSyncAndPieces(voyageId: string, delayMs = 3000, withSync = true): void {
  const t = timers.get(voyageId);
  if (t) clearTimeout(t);
  timers.set(
    voyageId,
    setTimeout(async () => {
      timers.delete(voyageId);
      try {
        if (withSync) await db.syncVoyage(voyageId);
        await processVoyage(voyageId);
      } catch (e) {
        console.error('[Pièces jointes] Erreur de traitement planifié :', e);
      }
    }, delayMs)
  );
}

/** Synchronisation automatique périodique (AUTO_SYNC_MINUTES, 0 = désactivée) */
export function startAutoSync(): void {
  const minutes = parseInt(process.env.AUTO_SYNC_MINUTES ?? '15', 10);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.log('[Auto-sync] désactivée (AUTO_SYNC_MINUTES=0)');
    return;
  }
  console.log(`[Auto-sync] DocuSeal + pièces jointes toutes les ${minutes} min — dossier : ${PIECES_DIR}`);
  setInterval(async () => {
    for (const v of db.getVoyages(true)) {
      if (!v.docuseal_api_key || v.statut === 'termine') continue;
      try {
        await db.syncVoyage(v.id);
        await processVoyage(v.id);
      } catch (e) {
        console.error(`[Auto-sync] ${v.nom} :`, e);
      }
    }
  }, minutes * 60 * 1000).unref();
}

/** Vérifie que le modèle DocuSeal contient bien un champ Fichier par pièce demandée, avant la signature */
export async function checkTemplate(voyage: Voyage): Promise<{
  success: boolean;
  message: string;
  pieces: Array<{ type: string; libelle: string; trouve: boolean; champ?: string; type_champ?: string; obligatoire?: boolean; avant_signature?: boolean; role?: string }>;
  champs: Array<{ name: string; type: string; role?: string }>;
  champs_fichier_non_prevus: string[];
}> {
  const empty = { pieces: [], champs: [], champs_fichier_non_prevus: [] };
  if (!voyage.docuseal_api_key) return { success: false, message: 'Clé API DocuSeal manquante.', ...empty };
  let tpl: any;
  try {
    tpl = await fetchJson(voyage, `/api/templates/${encodeURIComponent(voyage.docuseal_template_id)}`);
  } catch (e: any) {
    return { success: false, message: `DocuSeal injoignable : ${e?.message || e}`, ...empty };
  }
  if (!tpl) return { success: false, message: `Modèle #${voyage.docuseal_template_id} introuvable (clé API ?)`, ...empty };

  const roles = new Map<string, string>((tpl.submitters || []).map((s: any) => [s.uuid, s.name]));
  const fields: any[] = Array.isArray(tpl.fields) ? tpl.fields : [];
  const champs = fields.map((f) => ({ name: String(f.name || ''), type: String(f.type || ''), role: roles.get(f.submitter_uuid) }));

  const requises = piecesDuVoyage(voyage);
  const isFile = (f: any) => f.type === 'file' || f.type === 'image';
  const pieces = requises.map((def) => {
    const idx = fields.findIndex((f) => isFile(f) && detecterPiece(requises, f.name || '')?.id === def.id);
    if (idx === -1) return { type: def.id, libelle: def.libelle, trouve: false };
    const f = fields[idx];
    const sigIdx = fields.findIndex((x) => x.type === 'signature' && x.submitter_uuid === f.submitter_uuid);
    return {
      type: def.id,
      libelle: def.libelle,
      trouve: true,
      champ: f.name,
      type_champ: f.type,
      obligatoire: f.required !== false,
      avant_signature: sigIdx === -1 ? true : idx < sigIdx,
      role: roles.get(f.submitter_uuid),
    };
  });

  const champs_fichier_non_prevus = fields
    .filter((f) => f.type === 'file' && !detecterPiece(requises, f.name || ''))
    .map((f) => String(f.name || ''));
  const ok = pieces.every((p) => p.trouve && p.avant_signature && p.type_champ === 'file');
  return {
    success: ok,
    message:
      requises.length === 0
        ? 'Aucune pièce jointe demandée pour ce voyage (les champs Fichier éventuels seront récupérés en « Autres fichiers »).'
        : ok
        ? `✓ Le modèle contient les ${requises.length} champ(s) « Fichier » demandé(s), placé(s) avant la signature.`
        : 'Le modèle DocuSeal doit être complété : voir le détail ci-dessous.',
    pieces,
    champs,
    champs_fichier_non_prevus,
  };
}

/** Noms des champs « Fichier » du modèle DocuSeal du voyage (pour pré-remplir la liste des pièces demandées) */
export async function fileFieldsOfTemplate(voyage: Voyage): Promise<string[] | null> {
  if (!voyage.docuseal_api_key) return null;
  const tpl = await fetchJson(voyage, `/api/templates/${encodeURIComponent(voyage.docuseal_template_id)}`);
  if (!tpl || !Array.isArray(tpl.fields)) return null;
  const names = tpl.fields.filter((f: any) => f.type === 'file').map((f: any) => String(f.name || '').trim()).filter(Boolean);
  return [...new Set<string>(names)];
}

/** Après changement de la liste des pièces d'un voyage : reclasse / renomme les fichiers déjà reçus */
export function reconcileVoyage(voyageId: string): void {
  const voyage = db.getVoyageById(voyageId, true);
  if (!voyage) return;
  let changed = false;
  for (const item of db.getInscriptions(voyageId)) if (reconcileInscription(voyage, item)) changed = true;
  if (changed) db.persist();
}

/**
 * Archive ZIP des pièces jointes d'une classe (ou de toutes les classes), rangées par élève :
 *   <Classe>/<NOM_Prenom>/<NOM_Prenom_Piece.ext>   +   Recapitulatif_pieces.csv
 */
export async function streamPiecesZip(res: Response, voyage: Voyage, classe: string): Promise<void> {
  const toutes = !classe || classe === 'Toutes' || classe === 'Tous';
  const list = db
    .getInscriptions(voyage.id)
    .filter((i) => toutes || i.classe === classe)
    .sort((a, b) => a.classe.localeCompare(b.classe, 'fr', { numeric: true }) || a.eleve_nom.localeCompare(b.eleve_nom, 'fr') || a.eleve_prenom.localeCompare(b.eleve_prenom, 'fr'));

  const zipName = `${safeName(voyage.nom, 'Voyage')}_${toutes ? 'Toutes-classes' : safeName(classe, 'Classe')}_pieces-jointes.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = archiver('zip', { zlib: { level: 1 } }); // PDF/JPG déjà compressés : compression rapide
  archive.on('warning', (e) => console.warn('[ZIP pièces jointes]', e.message));
  archive.on('error', (e) => {
    console.error('[ZIP pièces jointes]', e);
    res.destroy(e);
  });
  archive.pipe(res);

  const requises = piecesDuVoyage(voyage);
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv: string[] = [['Classe', 'Nom', 'Prénom', 'Dossier ZIP', ...requises.map((r) => r.libelle), 'Autres fichiers', 'Signatures'].map(q).join(';')];
  const usedFolders = new Set<string>();
  let nbFichiers = 0;

  for (const item of list) {
    const classeDir = safeName(item.classe || 'Non spécifiée', 'Non-specifiee');
    let eleveDir = `${safeName(item.eleve_nom, 'NOM').toUpperCase()}_${capitalize(safeName(item.eleve_prenom, 'Prenom'))}`;
    if (usedFolders.has(`${classeDir}/${eleveDir}`)) eleveDir += `_Dossier${safeName(item.docuseal_submission_id, 'X')}`;
    usedFolders.add(`${classeDir}/${eleveDir}`);

    const present = new Set<string>();
    let autres = 0;
    for (const p of item.pieces_jointes || []) {
      let abs: string;
      try {
        abs = absPath(p.chemin);
      } catch {
        continue;
      }
      if (!fs.existsSync(abs)) continue;
      archive.file(abs, { name: `${classeDir}/${eleveDir}/${p.fichier}` });
      nbFichiers++;
      if (requises.some((r) => r.id === p.type)) present.add(p.type);
      else autres++;
    }
    csv.push(
      [
        item.classe,
        item.eleve_nom,
        item.eleve_prenom,
        present.size || autres ? `${classeDir}/${eleveDir}` : '(aucun fichier)',
        ...requises.map((r) => (present.has(r.id) ? 'OUI' : 'MANQUANTE')),
        String(autres),
        `${item.nombre_signatures}/2`,
      ]
        .map(q)
        .join(';')
    );
  }

  // BOM UTF-8 : le récapitulatif s'ouvre directement dans Excel avec les accents
  archive.append('﻿' + csv.join('\r\n') + '\r\n', { name: 'Recapitulatif_pieces.csv' });
  if (nbFichiers === 0) {
    archive.append(
      `Aucune pièce jointe n'est encore disponible pour ${toutes ? 'ce voyage' : `la classe ${classe}`}.\r\n` +
        `Les fichiers sont récupérés depuis DocuSeal dès qu'un parent a signé (synchronisation automatique ou webhook).\r\n`,
      { name: 'LISEZMOI.txt' }
    );
  }
  await archive.finalize();
}

/** Résumé par classe pour un voyage */
export function summarizeVoyage(voyageId: string) {
  const list = db.getInscriptions(voyageId);
  const requises = piecesDuVoyage(db.getVoyageById(voyageId, false));
  const classes = new Map<string, { classe: string; eleves: number; complets: number; manquants: Array<{ id: string; eleve: string; manque: string[] }> }>();
  for (const item of list) {
    const c = classes.get(item.classe) || { classe: item.classe, eleves: 0, complets: 0, manquants: [] };
    c.eleves++;
    const types = new Set((item.pieces_jointes || []).map((p) => p.type));
    const manque = requises.filter((d) => !types.has(d.id)).map((d) => d.libelle);
    if (manque.length === 0) c.complets++;
    else c.manquants.push({ id: item.id, eleve: `${item.eleve_nom} ${item.eleve_prenom}`, manque });
    classes.set(item.classe, c);
  }
  return {
    dossier: PIECES_DIR,
    par_voyage: PAR_VOYAGE,
    pieces_requises: requises,
    classes: [...classes.values()].sort((a, b) => a.classe.localeCompare(b.classe, 'fr', { numeric: true })),
  };
}

````

### `server.ts`

````ts
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import * as XLSX from 'xlsx';
import { db, Database, normalizeDocuSealUrl } from './server/db.js';
import {
  issueToken,
  verifyToken,
  isRateLimited,
  registerFailure,
  clearFailures,
  esc,
  safeEqual,
} from './server/auth.js';
import fs from 'fs';
import { nettoyerPieces, texteVersPieces } from './src/piecesConfig.js';
import {
  PIECES_DIR,
  pieceAbsolutePath,
  processInscription,
  processVoyage,
  reconcileInscription,
  scheduleSyncAndPieces,
  startAutoSync,
  checkTemplate,
  summarizeVoyage,
  streamPiecesZip,
  writeBack,
  fileFieldsOfTemplate,
  reconcileVoyage,
} from './server/attachments.js';

// Certificats auto-signés (réseau interne) : désactivé par défaut, à activer explicitement dans .env
if (process.env.ALLOW_INSECURE_TLS === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('⚠️  ALLOW_INSECURE_TLS=true : la validation des certificats TLS est désactivée.');
}

const PORT = parseInt(process.env.PORT || '3000', 10) || 3000;
// Sites autorisés à intégrer le portail en iframe. "*" = tous (défaut). Exemple : "https://intranet.mon-ecole.fr https://ent.mon-ecole.fr"
const FRAME_ANCESTORS = (process.env.FRAME_ANCESTORS || '*').trim();

async function startServer() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // derrière Nginx / Nginx Proxy Manager

  // ---- En-têtes de sécurité compatibles iframe (pas de X-Frame-Options : il bloquerait l'iframe) ----
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', `frame-ancestors ${FRAME_ANCESTORS}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // 100 % serveur : aucune réponse (HTML, JS, CSS, API, fichiers) n'est mise en cache par le navigateur
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  app.use(express.json({ limit: '2mb' }));

  // ---- Authentification par jetons signés ----
  const headerStr = (req: Request, name: string): string | undefined => {
    const v = req.headers[name];
    return Array.isArray(v) ? v[0] : v;
  };

  const rolesFromRequest = (req: Request): Set<string> => {
    const roles = new Set<string>();
    const candidates = [
      headerStr(req, 'x-admin-token'),
      headerStr(req, 'x-consultation-token'),
      typeof req.query.adminToken === 'string' ? req.query.adminToken : undefined,
      typeof req.query.consultationToken === 'string' ? req.query.consultationToken : undefined,
      typeof req.query.cToken === 'string' ? req.query.cToken : undefined,
      (headerStr(req, 'authorization') || '').replace(/^Bearer\s+/i, '') || undefined,
    ];
    for (const c of candidates) {
      const role = verifyToken(c);
      if (role) roles.add(role);
    }
    return roles;
  };

  const checkAdminAuth = (req: Request): boolean => rolesFromRequest(req).has('admin');
  const checkConsultationAuth = (req: Request): boolean => {
    const r = rolesFromRequest(req);
    return r.has('admin') || r.has('consultation');
  };

  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!checkAdminAuth(req)) {
      return res.status(403).json({ success: false, error: 'Accès administrateur requis', message: 'Accès administrateur requis' });
    }
    next();
  };

  /** Accès à un voyage : admin, consultation, voyage sans mot de passe, ou mot de passe de voyage valide */
  const hasVoyageAccess = (req: Request, voyageId: string): boolean => {
    if (checkConsultationAuth(req)) return true;
    const candidates: string[] = [];
    const single = headerStr(req, 'x-voyage-password');
    if (single) candidates.push(single);
    if (typeof req.query.password === 'string') candidates.push(req.query.password);
    const multi = headerStr(req, 'x-voyage-passwords');
    if (multi) {
      try {
        const map = JSON.parse(decodeURIComponent(multi));
        if (map && typeof map[voyageId] === 'string') candidates.push(map[voyageId]);
      } catch {
        /* ignoré */
      }
    }
    if (candidates.length === 0) return db.checkVoyageAccessPassword(voyageId, '');
    return candidates.some((c) => db.checkVoyageAccessPassword(voyageId, c));
  };

  const denyVoyage = (res: Response) =>
    res.status(403).json({ error: 'Accès restreint : mot de passe requis pour ce voyage.', passwordRequired: true });

  /** Wrapper async : toute exception devient une réponse 500 au lieu de faire tomber le serveur */
  const wrap =
    (fn: (req: Request, res: Response) => Promise<unknown> | unknown) =>
    (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res)).catch(next);
    };

  const clientKey = (req: Request, scope: string) => `${scope}:${req.ip}`;

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth: Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { role, password, email } = req.body || {};
    const key = clientKey(req, 'login');

    if (role === 'admin' || role === 'consultation' || role === 'comptable') {
      if (isRateLimited(key)) {
        return res.status(429).json({ success: false, message: 'Trop de tentatives. Réessayez dans quelques minutes.' });
      }
    }

    if (role === 'admin') {
      if (db.verifyAdminPassword(password)) {
        clearFailures(key);
        return res.json({
          success: true,
          role: 'admin',
          token: issueToken('admin'),
          user: { nom: 'Administrateur Général', email: email || '', role: 'admin', isAdmin: true },
        });
      }
      registerFailure(key);
      return res.status(401).json({ success: false, message: 'Mot de passe administrateur incorrect' });
    }

    // Consultation / Comptabilité (lecture seule sur tous les voyages)
    if (role === 'consultation' || role === 'comptable') {
      if (db.verifyConsultationPassword(password)) {
        clearFailures(key);
        return res.json({
          success: true,
          role: 'consultation',
          token: issueToken('consultation'),
          user: { nom: 'Service Comptabilité', email: email || '', role: 'consultation', isAdmin: false, isConsultation: true },
        });
      }
      registerFailure(key);
      return res.status(401).json({ success: false, message: 'Mot de passe de consultation incorrect' });
    }

    // Enseignant : accès libre (la protection se fait voyage par voyage)
    return res.json({
      success: true,
      role: 'professeur',
      token: '',
      user: { nom: req.body?.nom || 'Professeur Organisateur', email: email || '', role: 'professeur', isAdmin: false },
    });
  });

  // Vérification du mot de passe admin pour les opérations sensibles
  app.post('/api/auth/verify-admin', (req: Request, res: Response) => {
    const key = clientKey(req, 'login');
    if (isRateLimited(key)) {
      return res.status(429).json({ success: false, message: 'Trop de tentatives. Réessayez dans quelques minutes.' });
    }
    if (db.verifyAdminPassword(req.body?.password)) {
      clearFailures(key);
      return res.json({ success: true, token: issueToken('admin') });
    }
    registerFailure(key);
    return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
  });

  // Change Admin Password (Admin only)
  app.post('/api/auth/change-admin-password', (req: Request, res: Response) => {
    if (!checkAdminAuth(req)) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 8) {
      return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit comporter au moins 8 caractères' });
    }
    if (!db.verifyAdminPassword(currentPassword)) {
      return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect' });
    }
    db.setAdminPassword(newPassword.trim());
    return res.json({ success: true, message: 'Mot de passe administrateur mis à jour avec succès' });
  });

  // Get Consultation Password (Admin only)
  app.get('/api/admin/consultation-password', (req: Request, res: Response) => {
    if (!checkAdminAuth(req)) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }
    return res.json({ success: true, password: db.getConsultationPassword() });
  });

  // Change Consultation Password (Admin only)
  app.post('/api/admin/change-consultation-password', (req: Request, res: Response) => {
    if (!checkAdminAuth(req)) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }
    const { newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Le mot de passe consultation doit comporter au moins 6 caractères' });
    }
    db.setConsultationPassword(newPassword.trim());
    return res.json({
      success: true,
      message: 'Mot de passe consultation (comptabilité) mis à jour avec succès',
      password: newPassword.trim(),
    });
  });

  // List Voyages
  app.get('/api/voyages', (req: Request, res: Response) => {
    const isAdmin = checkAdminAuth(req);
    const list = db.getVoyages(isAdmin);
    res.json(list);
  });

  // Get Single Voyage
  app.get('/api/voyages/:id', (req: Request, res: Response) => {
    const isAdmin = checkAdminAuth(req);
    const voyage = db.getVoyageById(req.params.id, isAdmin);
    if (!voyage) {
      return res.status(404).json({ error: 'Voyage non trouvé' });
    }
    res.json(voyage);
  });

  // Create Voyage / DocuSeal Site (Admin only)
  app.post('/api/voyages', requireAdmin, (req: Request, res: Response) => {
    const { nom, destination, date_depart, date_retour, docuseal_url, docuseal_api_key, docuseal_template_id } = req.body;

    if (!nom || !destination || !date_depart || !date_retour || !docuseal_url || !docuseal_api_key || !docuseal_template_id) {
      return res.status(400).json({ error: 'Champs obligatoires manquants (Nom, Destination, Dates, URL DocuSeal, Clé API, Template ID)' });
    }

    const newVoyage = db.addVoyage({
      nom,
      description: req.body.description,
      destination,
      date_depart,
      date_retour,
      etablissement: req.body.etablissement,
      classes_concernees: Array.isArray(req.body.classes_concernees) ? req.body.classes_concernees : [req.body.classes_concernees || 'Toutes'],
      statut: req.body.statut,
      docuseal_instance_name: req.body.docuseal_instance_name,
      docuseal_url,
      docuseal_api_key,
      docuseal_template_id,
      mot_de_passe: typeof req.body.mot_de_passe === 'string' ? req.body.mot_de_passe : undefined,
      // Pièces jointes demandées aux parents pour CE voyage ([] = aucune)
      pieces_requises: nettoyerPieces(req.body.pieces_requises) ?? [],
    });

    res.status(201).json(newVoyage);
  });

  // Update Voyage (Admin only)
  app.put('/api/voyages/:id', requireAdmin, (req: Request, res: Response) => {
    const body = { ...(req.body || {}) };
    const piecesChanged = body.pieces_requises !== undefined;
    if (piecesChanged) body.pieces_requises = nettoyerPieces(body.pieces_requises) ?? [];
    const updated = db.updateVoyage(req.params.id, body);
    if (!updated) {
      return res.status(404).json({ error: 'Voyage introuvable' });
    }
    if (piecesChanged) reconcileVoyage(updated.id);
    res.json(updated);
  });

  // Delete Voyage (Admin only) - supports both DELETE and POST for maximum proxy/network compatibility
  const handleDeleteVoyageRequest = (req: Request, res: Response) => {
    const ok = db.deleteVoyage(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Voyage introuvable ou déjà supprimé' });
    }
    res.json({ success: true, message: 'Voyage supprimé avec succès' });
  };

  app.delete('/api/voyages/:id', requireAdmin, handleDeleteVoyageRequest);
  app.post('/api/voyages/:id/delete', requireAdmin, handleDeleteVoyageRequest);

  // Test Connection to a DocuSeal instance
  app.post('/api/voyages/:id/test-connection', requireAdmin, wrap(async (req, res) => {
    const result = await db.testDocuSealConnection(req.params.id);
    res.json(result);
  }));

  // Test temporary connection parameters directly (before saving a voyage)
  app.post('/api/docuseal/test-direct', requireAdmin, wrap(async (req, res) => {
    let { url, apiKey, templateId, voyageId } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL DocuSeal requise.' });
    }
    if ((!apiKey || !apiKey.trim()) && voyageId) {
      const v = db.getVoyageById(voyageId, true);
      if (v?.docuseal_api_key) {
        apiKey = v.docuseal_api_key;
      }
    }
    const result = await Database.executeDocuSealConnectionTest(url, apiKey || '', templateId || '');
    res.json(result);
  }));

  // Fetch templates from DocuSeal instance
  app.post('/api/docuseal/templates', requireAdmin, wrap(async (req, res) => {
    let { url, apiKey, voyageId } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL DocuSeal requise.' });
    }
    if ((!apiKey || !apiKey.trim()) && voyageId) {
      const v = db.getVoyageById(voyageId, true);
      if (v?.docuseal_api_key) {
        apiKey = v.docuseal_api_key;
      }
    }
    const result = await Database.fetchDocuSealTemplates(url, apiKey || '');
    res.json(result);
  }));

  // Debug: View raw submissions from DocuSeal for a voyage
  app.get('/api/docuseal/raw-submissions/:voyageId', requireAdmin, wrap(async (req, res) => {
    const v = db.getVoyageById(req.params.voyageId, true);
    if (!v) return res.status(404).json({ error: 'Voyage introuvable' });

    try {
      const cleanUrl = normalizeDocuSealUrl(v.docuseal_url);
      const endpoint = `${cleanUrl}/api/submissions?template_id=${v.docuseal_template_id}&limit=100`;
      const docuRes = await fetch(endpoint, {
        headers: {
          'X-Auth-Token': v.docuseal_api_key?.trim() || '',
          'Authorization': `Bearer ${v.docuseal_api_key?.trim() || ''}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await docuRes.json();
      res.json({
        httpStatus: docuRes.status,
        url: endpoint,
        data,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }));

  // Purge demo database
  app.post('/api/admin/reset-database', requireAdmin, (req: Request, res: Response) => {
    db.resetToCleanProduction();
    res.json({ success: true, message: 'Base de données réinitialisée à 0 pour la production.' });
  });

  // Seed demonstration trips (Londres, Rome, Madrid, Berlin) with student rosters
  app.post('/api/admin/seed-demo', requireAdmin, (req: Request, res: Response) => {
    db.seedDefaultVoyages();
    res.json({ success: true, message: '4 voyages scolaires (Londres, Rome, Madrid, Berlin) initialisés avec succès avec listes d\'élèves.' });
  });

  // Test all connections
  app.post('/api/voyages/test-all', requireAdmin, wrap(async (req, res) => {
    const voyages = db.getVoyages(true);
    const results: Record<string, any> = {};

    for (const v of voyages) {
      results[v.id] = await db.testDocuSealConnection(v.id);
    }

    res.json({ success: true, results });
  }));

  // Sync specific voyage
  app.post('/api/voyages/:id/sync', wrap(async (req, res) => {
    if (!db.getVoyageById(req.params.id, false)) return res.status(404).json({ success: false, message: 'Voyage introuvable' });
    if (!hasVoyageAccess(req, req.params.id)) return denyVoyage(res);
    const result = await db.syncVoyage(req.params.id);
    // Récupération des pièces jointes des parents ayant signé, en arrière-plan
    if (result.success) scheduleSyncAndPieces(req.params.id, 0, false);
    res.json(result);
  }));

  // Sync all voyages
  app.post('/api/voyages/sync-all', requireAdmin, wrap(async (req, res) => {
    const voyages = db.getVoyages(true);
    let totalAnalyzed = 0;
    let totalNewSignatures = 0;

    for (const v of voyages) {
      const resSync = await db.syncVoyage(v.id);
      if (resSync.success) scheduleSyncAndPieces(v.id, 0, false);
      totalAnalyzed += resSync.stats.analyzed;
      totalNewSignatures += resSync.stats.newSignatures;
    }

    res.json({
      success: true,
      message: `Synchronisation globale terminée (${voyages.length} voyages, ${totalAnalyzed} inscriptions analysées, +${totalNewSignatures} signatures)`,
      stats: { voyagesCount: voyages.length, totalAnalyzed, totalNewSignatures },
    });
  }));

  // Verify Trip Password (for teachers)
  app.post('/api/voyages/:id/verify-password', (req: Request, res: Response) => {
    const key = clientKey(req, `trip-${req.params.id}`);
    if (isRateLimited(key)) {
      return res.status(429).json({ valid: false, message: 'Trop de tentatives. Réessayez dans quelques minutes.' });
    }
    const { password } = req.body || {};
    const result = db.verifyVoyagePassword(req.params.id, password || '');
    if (!result.valid) {
      registerFailure(key);
      return res.status(401).json(result);
    }
    clearFailures(key);
    res.json(result);
  });

  // Purge fictitious / demo students from a specific voyage
  app.post('/api/voyages/:id/purge-inscriptions', requireAdmin, (req: Request, res: Response) => {
    const ok = db.purgeInscriptions(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Voyage introuvable' });
    }
    return res.json({
      success: true,
      message: 'Dossiers fictifs supprimés pour ce voyage. La liste est désormais prête pour la synchronisation réelle.',
    });
  });

  // Purge all demo students from all voyages (Admin only)
  app.post('/api/admin/purge-all-inscriptions', requireAdmin, (req: Request, res: Response) => {
    db.purgeInscriptions();
    return res.json({
      success: true,
      message: 'Tous les élèves fictifs ont été purgés de tous les voyages.',
    });
  });

  // Get Inscriptions for a Voyage with search & filters
  app.get('/api/voyages/:id/inscriptions', (req: Request, res: Response) => {
    const voyage = db.getVoyageById(req.params.id, false);
    if (!voyage) {
      return res.status(404).json({ error: 'Voyage introuvable' });
    }
    if (!hasVoyageAccess(req, req.params.id)) {
      return denyVoyage(res);
    }

    const search = req.query.search as string | undefined;
    const classe = req.query.classe as string | undefined;
    const statut = req.query.statut as string | undefined;

    const list = db.getInscriptions(req.params.id, search, classe, statut);
    res.json(list);
  });

  // Get single inscription
  app.get('/api/inscriptions/:id', (req: Request, res: Response) => {
    const item = db.getInscriptionById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }
    if (!hasVoyageAccess(req, item.voyage_id)) return denyVoyage(res);
    res.json(item);
  });

  // Mise à jour d'une inscription : un non-admin ne peut modifier que la classe
  const handleUpdateInscription = (req: Request, res: Response) => {
    const existing = db.getInscriptionById(req.params.id) || db.getInscriptionById(decodeURIComponent(req.params.id));
    if (!existing) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }
    if (!hasVoyageAccess(req, existing.voyage_id)) return denyVoyage(res);

    let body = req.body || {};
    if (!checkAdminAuth(req)) {
      const classe = typeof body.classe === 'string' ? body.classe.trim() : '';
      if (!classe || classe.length > 50) {
        return res.status(400).json({ error: 'Seule la modification de la classe est autorisée.' });
      }
      body = { classe, classe_modifiee_manuellement: true, voyage_id: existing.voyage_id };
    }
    const updated = db.updateInscription(req.params.id, body, existing.voyage_id);
    if (!updated) {
      return res.status(404).json({ error: 'Inscription non trouvée' });
    }
    // Classe modifiée : les pièces jointes sont déplacées dans le dossier de la nouvelle classe
    const voyageForPieces = db.getVoyageById(updated.voyage_id, true);
    if (voyageForPieces && reconcileInscription(voyageForPieces, updated)) db.persist();
    res.json({ success: true, inscription: updated });
  };
  app.put('/api/inscriptions/:id', handleUpdateInscription);
  app.patch('/api/inscriptions/:id', handleUpdateInscription);

  // Send Relance / Reminder
  app.post('/api/inscriptions/:id/relance', wrap(async (req, res) => {
    const existing = db.getInscriptionById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Inscription introuvable' });
    if (!hasVoyageAccess(req, existing.voyage_id)) return denyVoyage(res);
    const parentNum = req.body?.parentNum === 1 || req.body?.parentNum === 2 ? (req.body.parentNum as 1 | 2) : undefined;
    const result = await db.relanceInscription(req.params.id, parentNum);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  }));

  // Send Mass Relance / Reminders for an entire Voyage
  app.post('/api/voyages/:id/relance-masse', wrap(async (req, res) => {
    if (!db.getVoyageById(req.params.id, false)) return res.status(404).json({ success: false, message: 'Voyage introuvable' });
    if (!hasVoyageAccess(req, req.params.id)) return denyVoyage(res);
    const { targetStatus, classe } = req.body || {};
    const result = await db.relanceMasseVoyage(req.params.id, { targetStatus, classe });
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  }));

  // Document d'inscription signé (HTML imprimable). Accès : même contrôle que la liste des élèves.
  app.get('/api/inscriptions/:id/document', (req: Request, res: Response) => {
    const item = db.getInscriptionById(req.params.id);
    if (!item) {
      return res.status(404).send('Document introuvable');
    }
    if (!hasVoyageAccess(req, item.voyage_id)) {
      return res.status(403).send('Accès restreint : mot de passe du voyage requis.');
    }

    const voyage = db.getVoyageById(item.voyage_id, false);
    const etab = voyage?.etablissement || "L'établissement scolaire Notre Dame des Missions";
    const bothSigned = item.parent1.statut === 'signed' && item.parent2.statut === 'signed';
    const nbSigned = (item.parent1.statut === 'signed' ? 1 : 0) + (item.parent2.statut === 'signed' ? 1 : 0);

    const sigBox = (label: string, p: typeof item.parent1, fallbackId: string) => {
      const signed = p.statut === 'signed';
      return `
    <div class="sig-box ${signed ? 'signed' : ''}">
      <div class="sig-status" style="color: ${signed ? '#15803d' : '#b45309'};">
        ${signed ? '🟢' : '🟠'} ${esc(label)} — ${signed ? 'SIGNÉ' : 'EN ATTENTE'}
      </div>
      <div><strong>Nom :</strong> ${esc(p.nom)}</div>
      <div><strong>Email :</strong> ${esc(p.email)}</div>
      <div><strong>Téléphone :</strong> ${esc(p.telephone || 'Non renseigné')}</div>
      <div><strong>Date de signature :</strong> ${esc(p.date_signature || 'En attente')}</div>
      <div class="sig-stamp">
        Identifiant DocuSeal Submitter : ${esc(p.submitter_id || fallbackId)}<br>
        Horodatage : ${esc(p.date_signature || 'N/A')}
      </div>
    </div>`;
    };

    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Document d'inscription — ${esc(item.eleve_nom)} ${esc(item.eleve_prenom)}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 40px; color: #1e293b; background: #fff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .badge { padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: bold; display: inline-block; }
    .badge.ok { background: #dcfce7; color: #166534; }
    .badge.ko { background: #fef3c7; color: #92400e; }
    .section-title { font-size: 16px; font-weight: bold; margin-top: 30px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; color: #334155; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { text-align: left; padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 14px; }
    th { background: #f8fafc; font-weight: 600; width: 30%; }
    .signatures-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin-top: 25px; }
    .sig-box { border: 2px solid #cbd5e1; border-radius: 8px; padding: 16px; background: #f8fafc; }
    .sig-box.signed { border-color: #22c55e; background: #f0fdf4; }
    .sig-status { font-weight: bold; font-size: 14px; margin-bottom: 8px; }
    .sig-stamp { font-family: monospace; font-size: 11px; color: #64748b; background: #fff; padding: 8px; border-radius: 4px; border: 1px dashed #cbd5e1; margin-top: 10px; }
    .doc-footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #cbd5e1; font-size: 12px; color: #64748b; text-align: center; }
    @media print { .no-print { display: none; } body { margin: 15mm; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: right;">
    <button onclick="window.print()" style="background: #2563eb; color: white; padding: 10px 18px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🖨️ Imprimer ou enregistrer en PDF</button>
  </div>

  <div class="header">
    <div>
      <h1 style="margin: 0; font-size: 22px; color: #0f172a;">${esc(etab)}</h1>
      <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Dossier d'inscription au voyage scolaire — ${esc(voyage?.nom || 'Voyage')}</p>
    </div>
    <div>
      <span class="badge ${bothSigned ? 'ok' : 'ko'}">${bothSigned ? '✓ DOSSIER COMPLET (2/2 SIGNATURES DOCUSEAL)' : `DOSSIER INCOMPLET (${nbSigned}/2 SIGNATURES)`}</span>
    </div>
  </div>

  <div class="section-title">1. INFORMATIONS SUR L'ÉLÈVE</div>
  <table>
    <tr><th>Nom de l'enfant</th><td><strong>${esc(item.eleve_nom)}</strong></td></tr>
    <tr><th>Prénom de l'enfant</th><td>${esc(item.eleve_prenom)}</td></tr>
    <tr><th>Classe</th><td>${esc(item.classe)}</td></tr>
    <tr><th>Voyage concerné</th><td>${esc(voyage?.nom)} (${esc(voyage?.destination)})</td></tr>
    <tr><th>Période du voyage</th><td>Du ${esc(voyage?.date_depart)} au ${esc(voyage?.date_retour)}</td></tr>
  </table>

  <div class="section-title">2. SIGNATURES PARENTALES ÉLECTRONIQUES (DocuSeal)</div>
  <div class="signatures-grid">
    ${sigBox('PARENT 1', item.parent1, 'subm_ds_p1')}
    ${sigBox('PARENT 2', item.parent2, 'subm_ds_p2')}
  </div>

  <div class="section-title">3. CONDITIONS PARTICULIÈRES ET ENGAGEMENT</div>
  <p style="font-size: 13px; line-height: 1.6; color: #475569;">
    Les représentants légaux susmentionnés certifient sur l'honneur avoir pris connaissance du règlement des sorties et voyages scolaires, de la charte de vie collective, des modalités d'assurance et d'assistance rapatriement. Les consentements électroniques ont été recueillis via DocuSeal.
  </p>

  <div class="doc-footer">
    Document généré automatiquement par le Portail des Voyages Scolaires de ${esc(etab)}.<br>
    Identifiant de soumission DocuSeal : <code>${esc(item.docuseal_submission_id)}</code> | Instance : <code>${esc(voyage?.docuseal_instance_name)}</code><br>
    Ce récapitulatif ne remplace pas le document signé original conservé dans DocuSeal.
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(htmlContent);
  });

  // Export Excel for a trip
  app.get('/api/voyages/:id/export/excel', (req: Request, res: Response) => {
    const voyage = db.getVoyageById(req.params.id, false);
    if (!voyage) {
      return res.status(404).send('Voyage non trouvé');
    }
    if (!hasVoyageAccess(req, voyage.id)) {
      return res.status(403).send('Accès refusé : mot de passe du voyage requis pour télécharger l’export.');
    }

    const inscriptions = db.getInscriptions(voyage.id);

    // Build structured data array for Excel
    const rows = inscriptions.map((item, idx) => ({
      'N°': idx + 1,
      'Nom Élève': item.eleve_nom,
      'Prénom Élève': item.eleve_prenom,
      'Classe': item.classe,
      'Statut Global': item.statut === 'COMPLET' ? 'COMPLET (2/2)' : item.statut === 'A_FINALISER' ? 'À FINALISER (1/2)' : 'NON SIGNÉ (0/2)',
      'Nb Signatures': `${item.nombre_signatures}/2`,
      'Parent 1 - Nom': item.parent1.nom,
      'Parent 1 - Statut': item.parent1.statut === 'signed' ? 'Signé' : 'En attente',
      'Parent 1 - Email': item.parent1.email,
      'Parent 1 - Téléphone': item.parent1.telephone || '',
      'Parent 1 - Date Signature': item.parent1.date_signature || '',
      'Parent 2 - Nom': item.parent2.nom,
      'Parent 2 - Statut': item.parent2.statut === 'signed' ? 'Signé' : 'En attente',
      'Parent 2 - Email': item.parent2.email,
      'Parent 2 - Téléphone': item.parent2.telephone || '',
      'Parent 2 - Date Signature': item.parent2.date_signature || '',
      'Date Inscription': item.date_creation,
      'Dernière Synchronisation': item.date_derniere_synchronisation,
      'Remarques': item.remarques || '',
      'Réf DocuSeal': item.docuseal_submission_id,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto calculate column widths
    const colWidths = [
      { wch: 6 },  // N°
      { wch: 18 }, // Nom
      { wch: 18 }, // Prénom
      { wch: 10 }, // Classe
      { wch: 22 }, // Statut Global
      { wch: 14 }, // Nb Signatures
      { wch: 24 }, // Parent 1 Nom
      { wch: 14 }, // Parent 1 Statut
      { wch: 28 }, // Parent 1 Email
      { wch: 16 }, // Parent 1 Tel
      { wch: 20 }, // Parent 1 Date
      { wch: 24 }, // Parent 2 Nom
      { wch: 14 }, // Parent 2 Statut
      { wch: 28 }, // Parent 2 Email
      { wch: 16 }, // Parent 2 Tel
      { wch: 20 }, // Parent 2 Date
      { wch: 18 }, // Date Insc
      { wch: 22 }, // Date Sync
      { wch: 22 }, // Remarques
      { wch: 22 }, // Ref DocuSeal
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inscriptions');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const safeAsciiFilename = `Inscriptions_${voyage.nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().substring(0, 10)}.xlsx`;
    const encodedFilename = encodeURIComponent(`Inscriptions_${voyage.nom}_${new Date().toISOString().substring(0, 10)}.xlsx`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.send(buffer);
  });

  // Webhook DocuSeal endpoint
  // Si WEBHOOK_SECRET est défini, DocuSeal doit l'envoyer (en-tête X-Webhook-Secret, ou ?secret=...)
  app.post('/api/webhooks/docuseal/:voyageId', (req: Request, res: Response) => {
    const expected = process.env.WEBHOOK_SECRET?.trim();
    if (expected) {
      const provided = headerStr(req, 'x-webhook-secret') || (typeof req.query.secret === 'string' ? req.query.secret : '');
      if (!provided || !safeEqual(provided, expected)) {
        return res.status(401).json({ success: false, message: 'Secret de webhook invalide' });
      }
    }
    const result = db.handleWebhook(req.params.voyageId, req.body || {});
    // Synchro complète + téléchargement des pièces jointes (anti-rebond 3 s : DocuSeal envoie plusieurs événements)
    if (db.getVoyageById(req.params.voyageId, false)) scheduleSyncAndPieces(req.params.voyageId, 3000, true);
    res.json(result);
  });

  // ---- PIÈCES JOINTES (carte d'identité, autorisation de sortie du territoire, carte mutuelle européenne) ----

  // Téléchargement d'une pièce jointe (mêmes droits que la liste des élèves du voyage)
  app.get('/api/inscriptions/:id/pieces/:index', (req: Request, res: Response) => {
    const item = db.getInscriptionById(req.params.id);
    if (!item) return res.status(404).send('Inscription introuvable');
    if (!hasVoyageAccess(req, item.voyage_id)) return res.status(403).send('Accès restreint : mot de passe du voyage requis.');
    const piece = (item.pieces_jointes || [])[parseInt(req.params.index, 10)];
    if (!piece) return res.status(404).send('Pièce jointe introuvable');
    let abs: string;
    try {
      abs = pieceAbsolutePath(piece);
    } catch {
      return res.status(400).send('Chemin invalide');
    }
    if (!fs.existsSync(abs)) return res.status(404).send('Fichier absent du serveur (relancez la récupération).');
    const disposition = req.query.download === '1' ? 'attachment' : 'inline';
    const ascii = piece.fichier.replace(/[^A-Za-z0-9._-]/g, '_');
    res.setHeader('Content-Type', piece.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(piece.fichier)}`);
    res.sendFile(abs, { etag: false, lastModified: false, cacheControl: false });
  });

  // Forcer la récupération des pièces d'un élève
  app.post('/api/inscriptions/:id/pieces/refresh', wrap(async (req, res) => {
    const item = db.getInscriptionById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Inscription introuvable' });
    if (!hasVoyageAccess(req, item.voyage_id)) return denyVoyage(res);
    const voyage = db.getVoyageById(item.voyage_id, true);
    if (!voyage) return res.status(404).json({ success: false, message: 'Voyage introuvable' });
    const r = await processInscription(voyage, item, true);
    writeBack(item);
    db.persist();
    const current = db.getInscriptionById(item.id) || item;
    res.json({
      success: r.erreurs.length === 0,
      message: r.erreurs.length
        ? `${r.nouveaux} fichier(s) récupéré(s), ${r.erreurs.length} erreur(s) : ${r.erreurs.join(' | ')}`
        : r.nouveaux > 0
        ? `✓ ${r.nouveaux} fichier(s) récupéré(s) et classé(s) sur le serveur.`
        : 'Aucun fichier à récupérer (le parent doit avoir signé et téléversé ses pièces dans DocuSeal).',
      inscription: current,
    });
  }));

  // Résumé par classe des pièces reçues / manquantes
  app.get('/api/voyages/:id/pieces/summary', (req: Request, res: Response) => {
    if (!db.getVoyageById(req.params.id, false)) return res.status(404).json({ error: 'Voyage introuvable' });
    if (!hasVoyageAccess(req, req.params.id)) return denyVoyage(res);
    res.json(summarizeVoyage(req.params.id));
  });

  // ZIP des pièces jointes d'une classe (?classe=4B) ou de tout le voyage (?classe=Toutes), rangées par élève
  app.get('/api/voyages/:id/pieces/zip', wrap(async (req, res) => {
    const voyage = db.getVoyageById(req.params.id, false);
    if (!voyage) return res.status(404).send('Voyage introuvable');
    if (!hasVoyageAccess(req, voyage.id)) return res.status(403).send('Accès restreint : mot de passe du voyage requis.');
    const classe = typeof req.query.classe === 'string' ? req.query.classe : 'Toutes';
    await streamPiecesZip(res, voyage, classe);
  }));

  // Récupérer maintenant toutes les pièces d'un voyage (admin)
  app.post('/api/voyages/:id/pieces/process', requireAdmin, wrap(async (req, res) => {
    if (!db.getVoyageById(req.params.id, false)) return res.status(404).json({ success: false, message: 'Voyage introuvable' });
    const sync = await db.syncVoyage(req.params.id);
    const r = await processVoyage(req.params.id, req.body?.force === true);
    res.json({
      success: sync.success && r.erreurs.length === 0,
      message: `${sync.success ? 'Synchronisation OK' : `Synchronisation : ${sync.message}`} — ${r.nouveaux} fichier(s) enregistré(s) dans ${PIECES_DIR}${
        r.erreurs.length ? ` — ${r.erreurs.length} erreur(s) : ${r.erreurs.slice(0, 5).join(' | ')}` : ''
      }`,
      nouveaux: r.nouveaux,
      erreurs: r.erreurs,
    });
  }));

  // Pièces demandées = champs « Fichier » du modèle DocuSeal (admin)
  app.post('/api/voyages/:id/pieces/from-template', requireAdmin, wrap(async (req, res) => {
    const voyage = db.getVoyageById(req.params.id, true);
    if (!voyage) return res.status(404).json({ success: false, message: 'Voyage introuvable' });
    const names = await fileFieldsOfTemplate(voyage);
    if (!names) return res.status(400).json({ success: false, message: 'Modèle DocuSeal illisible (URL, clé API ou n° de modèle ?)' });
    const updated = db.updateVoyage(voyage.id, { pieces_requises: texteVersPieces(names.join('\n')) });
    reconcileVoyage(voyage.id);
    res.json({
      success: true,
      message: names.length
        ? `✓ ${names.length} pièce(s) reprise(s) du modèle : ${names.join(', ')}`
        : 'Le modèle ne contient aucun champ « Fichier » : aucune pièce demandée.',
      pieces_requises: updated?.pieces_requises || [],
    });
  }));

  // Vérification du modèle DocuSeal (champs Fichier avant la signature) (admin)
  app.get('/api/voyages/:id/pieces/template-check', requireAdmin, wrap(async (req, res) => {
    const voyage = db.getVoyageById(req.params.id, true);
    if (!voyage) return res.status(404).json({ success: false, message: 'Voyage introuvable' });
    res.json(await checkTemplate(voyage));
  }));

  // Sync Logs - support both /api/logs/sync and /api/logs
  const handleGetLogs = (req: Request, res: Response) => {
    const parsed = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1000) : 100;
    const logs = db.getLogs(limit);
    res.json(logs);
  };

  app.get('/api/logs', requireAdmin, handleGetLogs);
  app.get('/api/logs/sync', requireAdmin, handleGetLogs);

  // Toute route /api inconnue renvoie du JSON (et non la page d'accueil)
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({ error: 'Route API introuvable' });
  });

  // --- VITE (dev) / FICHIERS STATIQUES (production) ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Pas d'ETag / Last-Modified : le navigateur retélécharge tout depuis le serveur à chaque visite
    const noCacheStatic = { etag: false, lastModified: false, maxAge: 0, cacheControl: false, index: false };
    app.use(express.static(distPath, noCacheStatic));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'), { etag: false, lastModified: false, cacheControl: false });
    });
  }

  // Gestionnaire d'erreurs global
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    console.error(`[${new Date().toISOString()}] Erreur ${req.method} ${req.originalUrl} :`, err);
    if (res.headersSent) return;
    res.status(500).json({ success: false, error: 'Erreur interne du serveur', message: 'Erreur interne du serveur' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Portail Voyages Scolaires démarré sur http://localhost:${PORT}`);
    try {
      fs.mkdirSync(PIECES_DIR, { recursive: true });
    } catch (e: any) {
      console.error(`⚠️  Dossier des pièces jointes inaccessible (${PIECES_DIR}) : ${e?.message || e}`);
    }
    startAutoSync();
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('Promesse rejetée non gérée :', reason);
});

startServer().catch((err) => {
  console.error('Échec du démarrage du serveur :', err);
  process.exit(1);
});

````

### `server/auth.ts`

````ts
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SECRET_FILE = path.join(DATA_DIR, '.session-secret');

export type Role = 'admin' | 'consultation';

/** Secret de signature des jetons : variable d'env SESSION_SECRET, sinon généré et conservé dans data/.session-secret */
function loadSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const s = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
      if (s.length >= 32) return s;
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const s = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, s, { mode: 0o600 });
    return s;
  } catch {
    // Dernier recours : secret en mémoire (les sessions sautent au redémarrage)
    return crypto.randomBytes(48).toString('hex');
  }
}

const SECRET = loadSecret();
const TOKEN_TTL_MS = (parseInt(process.env.SESSION_TTL_HOURS || '12', 10) || 12) * 3600 * 1000;

const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64url');
const sign = (payload: string) => crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');

export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function issueToken(role: Role): string {
  const payload = b64(JSON.stringify({ r: role, e: Date.now() + TOKEN_TTL_MS, n: crypto.randomBytes(6).toString('hex') }));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: unknown): Role | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (typeof data.e !== 'number' || data.e < Date.now()) return null;
    return data.r === 'admin' || data.r === 'consultation' ? data.r : null;
  } catch {
    return null;
  }
}

// ---- Hachage des mots de passe (scrypt) ----
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function isHashed(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith('scrypt$');
}

export function verifyHash(password: string, stored: string): boolean {
  try {
    const [, saltHex, hashHex] = stored.split('$');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ---- Limiteur de tentatives (anti brute-force) ----
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) return false;
  return rec.count >= MAX_ATTEMPTS;
}
export function registerFailure(key: string): void {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) attempts.set(key, { count: 1, first: now });
  else rec.count++;
}
export function clearFailures(key: string): void {
  attempts.delete(key);
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of attempts) if (now - v.first > WINDOW_MS) attempts.delete(k);
}, 10 * 60 * 1000).unref();

/** Échappement HTML (anti-XSS) pour le document généré côté serveur */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

````

### `src/types.ts`

````ts
export type TripStatus = 'preparation' | 'inscriptions_ouvertes' | 'inscriptions_fermees' | 'termine';
export type SyncConnectionStatus = 'connected' | 'error' | 'testing' | 'untested';
export type InscriptionStatus = 'COMPLET' | 'A_FINALISER' | 'NON_SIGNE';

export interface SignataireInfo {
  nom: string;
  email: string;
  telephone?: string;
  statut: 'signed' | 'pending' | 'not_sent';
  date_signature?: string;
  submitter_id?: string;
  slug?: string;
}

export interface Inscription {
  id: string;
  voyage_id: string;
  eleve_nom: string;
  eleve_prenom: string;
  classe: string;
  docuseal_submission_id: string;
  date_creation: string;
  date_derniere_synchronisation: string;
  parent1: SignataireInfo;
  parent2: SignataireInfo;
  nombre_signatures: 0 | 1 | 2;
  statut: InscriptionStatus;
  document_url?: string;
  derniere_relance?: string;
  remarques?: string;
  classe_modifiee_manuellement?: boolean;

  // Pièces jointes téléversées par les parents dans DocuSeal (copiées sur le serveur après signature)
  pieces_jointes?: PieceJointe[];
  pieces_submitters_traites?: string[]; // submitters DocuSeal signés dont les fichiers ont déjà été récupérés
}

/** Identifiant de la pièce demandée (ex. 'carte_identite', 'fiche_sanitaire'…) ou 'autre' (champ Fichier non prévu) */
export type PieceType = string;

/** Pièce jointe demandée aux parents pour un voyage (configurable voyage par voyage) */
export interface PieceRequise {
  id: string;            // identifiant stable (ex. "carte_identite")
  libelle: string;       // libellé affiché et nom conseillé du champ Fichier DocuSeal
  suffixe?: string;      // suffixe du nom de fichier (sinon calculé depuis le libellé)
  mots_cles?: string[];  // autres noms de champ DocuSeal reconnus
}

export interface PieceJointe {
  type: PieceType;
  libelle: string;        // libellé lisible (ex : "Carte d'identité")
  champ_docuseal: string; // nom du champ "Fichier" dans le modèle DocuSeal
  fichier: string;        // nom du fichier sur le serveur (NOM_Prenom_Piece.ext)
  chemin: string;         // chemin relatif au dossier PIECES_DIR (Voyage/Classe/fichier)
  taille: number;         // octets
  mime: string;
  submitter_id: string;
  date_recuperation: string;
  index?: number;         // rang du fichier si plusieurs fichiers dans le même champ
}

export interface Voyage {
  id: string;
  nom: string;
  description: string;
  destination: string;
  date_depart: string;
  date_retour: string;
  etablissement: string;
  classes_concernees: string[];
  statut: TripStatus;
  
  // DocuSeal configuration
  docuseal_instance_name: string;
  docuseal_url: string;
  docuseal_api_key_masked?: string;
  docuseal_api_key?: string; // Stored server-side only
  docuseal_template_id: string;

  // Pièces jointes demandées aux parents (absent = 3 pièces historiques, [] = aucune)
  pieces_requises?: PieceRequise[];

  // Sync state
  connection_status: SyncConnectionStatus;
  last_test_at?: string;
  last_test_message?: string;
  last_sync_at?: string;
  last_sync_message?: string;
  
  // Access control
  mot_de_passe?: string; // Stored server-side, visible to admin only
  has_password?: boolean; // Exposed to public so UI knows if password is required

  // Stats
  total_inscrits: number;
  total_complets: number;
  total_a_finaliser: number;
  total_doublons?: number;
  total_non_signes: number;
  
  created_at: string;
  updated_at: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  voyage_id: string;
  voyage_nom: string;
  type: 'manual_sync' | 'auto_sync' | 'webhook' | 'connection_test' | 'pieces_jointes';
  status: 'success' | 'warning' | 'error';
  message: string;
  inscriptions_count?: number;
  new_signatures?: number;
  new_inscriptions?: number;
}

export type SyncLog = SyncLogEntry;

export interface UserSession {
  role: 'admin' | 'professeur' | 'consultation';
  nom: string;
  email: string;
  isAdmin: boolean;
  isConsultation?: boolean;
}

````

---
Le code source complet (frontend + backend) est dans `/opt/readme/README-CODE-COMPLET.md` et sur GitHub.
