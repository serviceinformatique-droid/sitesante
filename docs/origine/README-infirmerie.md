*Dernière mise à jour / vérification automatique : jeudi 8 octobre 2026 à 20:07*

# Fiche Infirmerie Numérique – Ensemble Scolaire Notre-Dame des Missions – Saint-Pierre

> **Documentation Technique & Guide Exhaustif d'Exploitation et d'Architecture**  
> Application web Full-Stack (**React 19 + Express / Node.js + TypeScript**) conçue sur mesure pour la gestion dématérialisée, le chiffrement fort, la signature électronique et l'archivage sécurisé des fiches infirmerie scolaires.  
> Conçue pour un fonctionnement autonome sur **Serveur Dédié / Conteneur Proxmox LXC (Debian 12)** avec **npm** et **Docker**, intégrable en **Iframe**, et **100 % exécutée côté serveur (zéro cache navigateur)**.

---

## Sommaire

1. [Vue d'Ensemble & Objectifs du Projet](#1-vue-densemble--objectifs-du-projet)
2. [Cahier des Charges & Matrice de Conformité Réglementaire](#2-cahier-des-charges--matrice-de-conformité-réglementaire)
3. [Architecture Technique & Stack Logicielle](#3-architecture-technique--stack-logicielle)
4. [Sécurité, Chiffrement AES-256-GCM & Zéro Cache](#4-sécurité-chiffrement-aes-256-gcm--zéro-cache)
5. [Identifiants & Comptes d'Accès par Défaut](#5-identifiants--comptes-daccès-par-défaut)
6. [Arborescence du Projet & Rôle de Chaque Fichier](#6-arborescence-du-projet--rôle-de-chaque-fichier)
7. [API Endpoints (Serveur Express)](#7-api-endpoints-serveur-express)
8. [Guide de Déploiement Complet sur Proxmox LXC (Debian 12)](#8-guide-de-déploiement-complet-sur-proxmox-lxc-debian-12)
9. [Déploiement avec FileZilla (Arborescence et Droits)](#9-déploiement-avec-filezilla-arborescence-et-droits)
10. [Déploiement Docker & Docker Compose](#10-déploiement-docker--docker-compose)
11. [Gestion du Stockage, Archives & Procédure de Purge](#11-gestion-du-stockage-archives--procédure-de-purge)
12. [Personnalisation de l'Identité de l'Établissement & Logo](#12-personnalisation-de-lidentité-de-létablissement--logo)
13. [Procédure de Mise à Jour & Script de Push GitHub](#13-procédure-de-mise-à-jour--script-de-push-github)
14. [Restauration GitHub sur un Nouveau Conteneur Proxmox LXC & Ports Réseau](#14-restauration-github-sur-un-nouveau-conteneur-proxmox-lxc--ports-réseau)
15. [Dépannage & FAQ Technique](#15-dépannage--faq-technique)

---

## 1. Vue d'Ensemble & Objectifs du Projet

L'application **Fiche Infirmerie Numérique** remplace intégralement les fiches d'urgence et de renseignements médicaux papier traditionnellement distribuées aux familles à chaque rentrée scolaire.

### Principes Directeurs
- **Fluidité Parentale :** Parcours responsive 100 % adapté aux smartphones, tablettes et ordinateurs, guidé étape par étape.
- **Rigueur Médicale & Légale :** Aucune étape ne peut être contournée. Les dates de rappel vaccinal (DTP, BCG, ROR, Coqueluche), les contacts d'urgence hiérarchisés et le médecin traitant sont rigoureusement contrôlés.
- **Authentification Sécurisée des Familles :** Création de compte parent avec question secrète pour récupération de mot de passe autonome, évitant la surcharge du secrétariat.
- **Portail d'Administration Scolaire Puissant :** Vue classe par classe, suivi en temps réel des dépôts et signatures, changement de classe d'un élève en 1 clic, export CSV complet, génération et prévisualisation A4 haute fidélité.
- **100 % Serveur & Zéro Donnée dans le Cache du Navigateur :** Toutes les données de santé et identités transitent sans mise en cache locale (interdiction stricte du LocalStorage pour les données sensibles, en-têtes HTTP de purge de cache).
- **Intégration Iframe Transparente :** Peut être embarquée dans n'importe quel ENT, portail Proxmox ou site web d'établissement sans blocage de sécurité CSP/CORS.

---

## 2. Cahier des Charges & Matrice de Conformité Réglementaire

| Exigence Spécifiée | Niveau | Détail de l'Implémentation Technique |
| :--- | :---: | :--- |
| **Intégralité des champs de la fiche papier officielle** | 100% | Identité élève, date de naissance, adresse, médecin traitant, 2 responsables légaux (numéros pro/perso avec case "non concerné"), contact d'urgence tiers, antécédents, PAI/allergies, vaccins. |
| **Dépôt obligatoire du carnet de vaccinations** | 100% | Composant `VaccinationUpload.tsx` : Upload de photos / scans (JPEG, PNG, PDF), redimensionnement intelligent, multi-pages. |
| **Relecture & validation avant signature** | 100% | Étape dédiée de vérification visuelle intégrale des informations saisies (`ReviewModalOrStep.tsx`). |
| **Signature électronique manuscrite horodatée** | 100% | Canvas tactile réactif (`SignaturePad.tsx`), mention légale obligatoire *"Lu et approuvé"*, horodatage certifié ISO à la seconde. |
| **Génération PDF A4 sans chevauchement** | 100% | Moteur vectoriel jsPDF calibré (`pdfGenerator.ts`) avec pagination rigoureuse, mise en page sans débordement (notamment sur le contact d'urgence et la mention grand-mère). |
| **Gestion des Classes Scolaires (CRUD dynamique)** | 100% | Modal dédié : ajout d'une classe, renommage avec répercussion automatique sur tous les élèves rattachés, suppression, réassignation individuelle d'un élève. |
| **Vue Administrateur "Classe par classe"** | 100% | Accordéon pliable par classe avec indicateurs : Complète, Carnet joint, Signée, Archivée sur serveur. |
| **Aperçu Officiel en Iframe sans échec** | 100% | Modal d'aperçu haute résolution (`FicheDocumentPreview.tsx`) éliminant les blocages des plugins PDF des navigateurs mobiles. |
| **Fonctionnalité "Purger la liste"** | 100% | Boutons de purge globale et de suppression individuelle sur les archives physiques du serveur et sur la base des fiches élèves. |
| **Identité de l'établissement & Logo dynamique** | 100% | Bouton « Identité & Logo » dans l'en-tête admin : personnalisation du nom de l'établissement, sous-titre et téléversement de logo (PNG, JPG, SVG, WebP) persistant sur le serveur. |
| **Zéro Cache Navigateur & 100 % Serveur** | 100% | En-têtes HTTP `no-store, no-cache, must-revalidate`, balises méta HTML anti-cache, sauvegarde automatique des brouillons sur l'API `/api/draft`. |
| **Conformité RGPD & CNIL** | 100% | Registre des traitements intégré téléchargeable en PDF officiel, chiffrement au repos AES-256-GCM, consentement explicite obligatoire. |

---

## 3. Architecture Technique & Stack Logicielle

### Frontend
- **Framework :** React 19 (Hooks, TypeScript strict)
- **Bundler :** Vite 8
- **Styles :** Tailwind CSS v4 (`@tailwindcss/vite`)
- **Composants d'icônes :** Lucide React
- **Génération documentaire :** jsPDF (rendu vectoriel haute résolution A4)
- **Signature tactile :** HTML5 Canvas fluide avec support touch iOS/Android

### Backend
- **Runtime :** Node.js LTS (v20 ou v22)
- **Serveur HTTP :** Express 4 avec middleware proxy Vite en dev et livraison statique optimisée en production
- **Chiffrement :** Module natif `crypto` Node.js (AES-256-GCM avec vecteur d'initialisation 96-bit unique par enregistrement et tag d'authentification)
- **Hachage des mots de passe :** PBKDF2 avec sel unique cryptographique (100 000 itérations, SHA-512)
- **Persistance des données :** Fichiers chiffrés et JSON sur le système de fichiers (`/data`)
- **Synchronisation Nextcloud (optionnelle) :** WebDAV natif HTTP avec miroir local de secours

---

## 4. Sécurité, Chiffrement AES-256-GCM & Zéro Cache

### Politique Zéro Cache Navigateur
Pour respecter l'obligation formelle de ne laisser aucune trace de données médicales dans le cache du navigateur client (cybercafé, poste partagé de l'établissement ou téléphone d'un tiers) :
1. **Middleware Express anti-cache :**
   ```http
   Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
   Pragma: no-cache
   Expires: 0
   Surrogate-Control: no-store
   ```
2. **Métadonnées HTML d'interdiction :** `<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate">`
3. **Brouillons Côté Serveur Uniquement :** L'auto-sauvegarde pendant la saisie parentale se fait via l'API `/api/draft`, aucun `localStorage` ni `sessionStorage` n'est utilisé pour stocker des informations nominatives ou médicales.

### Chiffrement au Repos (AES-256-GCM)
- Une clé maîtresse de 256 bits est générée au premier démarrage dans `data/.master_encryption.key` avec permissions strictes `chmod 600`.
- Les comptes d'utilisateurs (`data/accounts.enc`), les fiches infirmerie (`data/fiches.enc`) et les brouillons (`data/draft.enc`) sont systématiquement chiffrés.
- Format de stockage chiffré : `<IV_HEX>:<AUTH_TAG_HEX>:<CIPHERTEXT_HEX>`. Toute altération du fichier rend le déchiffrement impossible (protection contre les modifications frauduleuses).

---

## 5. Identifiants & Comptes d'Accès par Défaut

Le système gère deux types d'espaces avec authentification :

### A. Espace Administration & Infirmerie (Personnel de l'Établissement)
Accessible via le bouton **« Espace Infirmerie & Direction »** en haut à droite.

| Rôle | Identifiant (Username) | Mot de Passe par Défaut | Droits & Accès |
| :--- | :--- | :--- | :--- |
| **Direction / Administrateur** | `admin` | `infirmerie2026!` *(ou `infirmerie2026`)* | Accès complet : Fiches, Classes, Branding, Archives, Purge, RGPD, Configuration Nextcloud. |
| **Service Infirmerie** | `infirmerie` | `infirmerie2026!` *(ou `infirmerie2026`)* | Consultation médicale, validation des fiches, export PDF/CSV, impression, gestion des classes. |

> **Changement de mot de passe :** Dans l'en-tête du tableau de bord admin, le bouton vert **« Mot de passe »** permet de changer immédiatement le mot de passe de la session connectée.

### B. Espace Famille (Parents d'Élèves)
- Les parents créent leur compte en 30 secondes avec leur adresse e-mail, téléphone, mot de passe (min. 6 caractères) et une **question secrète** personnalisée.
- En cas d'oubli de mot de passe, un lien **« Mot de passe oublié ? »** permet de réinitialiser le compte instantanément en répondant à leur question secrète.

---

## 6. Arborescence du Projet & Rôle de Chaque Fichier

```text
/opt/infirmerie/
├── data/                                 # Dossier créé au démarrage (persistant)
│   ├── .master_encryption.key            # Clé maîtresse AES-256 (chmod 600)
│   ├── accounts.enc                      # Comptes admin et parents chiffrés
│   ├── fiches.enc / fiches.json          # Fiches élèves chiffrées + miroir
│   ├── classes.json                      # Liste des classes scolaires actives
│   ├── branding.json                     # Nom, sous-titre et logo en Base64
│   ├── config.json                       # Configuration Nextcloud WebDAV
│   └── archives/                         # Stockage physique des PDF
│       └── FICHES INFIRMERIE/
│           └── 2026-2027/
│               └── [Classe]/             # Ex: 6A, 501, 3B
│                   ├── [NOM]_[Prenom]_Fiche_infirmerie_2026-2027.pdf
│                   └── [NOM]_[Prenom]_Carnet_vaccinations_2026-2027.pdf
│
├── public/                               # Fichiers statiques publics
│   ├── favicon.svg                       # Favicon officiel
│   └── ndm-logo.png                      # Logo par défaut de l'établissement
│
├── scripts/
│   └── generate-readme.js                # Régénérateur automatique du README
│
├── src/
│   ├── components/
│   │   ├── AdminDashboard.tsx            # Tableau de bord complet de gestion
│   │   ├── AdminLoginCard.tsx            # Formulaire de connexion admin/infirmerie
│   │   ├── AuthorizationSection.tsx      # Section autorisations légales et urgences
│   │   ├── ChangeStaffPasswordModal.tsx  # Fenêtre de modification du mot de passe
│   │   ├── ClassManagementModal.tsx      # Gestionnaire CRUD des classes scolaires
│   │   ├── ConfirmationSuccess.tsx       # Écran de succès post-signature
│   │   ├── EditStudentClassModal.tsx     # Changement rapide de la classe d'un élève
│   │   ├── FicheDocumentPreview.tsx      # Prévisualisation A4 haute fidélité (zéro bug)
│   │   ├── Header.tsx                    # Barre de navigation avec logo dynamique
│   │   ├── HealthFormSection.tsx         # Saisie médicale : vaccins, PAI, allergies
│   │   ├── ParentAuthCard.tsx            # Connexion, inscription et reset parent
│   │   ├── ReviewModalOrStep.tsx         # Étape de relecture obligatoire parentale
│   │   ├── RgpdComplianceView.tsx        # Registre et attestation RGPD/CNIL
│   │   ├── SchoolBrandingModal.tsx       # Personnalisation du nom d'établissement et logo
│   │   ├── SignaturePad.tsx              # Pavé de signature tactile/souris
│   │   ├── StudentFormSection.tsx        # Identité élève et responsables légaux
│   │   └── VaccinationUpload.tsx         # Module d'upload du carnet vaccinal
│   │
│   ├── utils/
│   │   ├── logoHelper.ts                 # Gestion et encodage des logos
│   │   ├── pdfGenerator.ts               # Moteur jsPDF anti-chevauchement A4
│   │   └── rgpdPdfGenerator.ts           # Générateur du document officiel RGPD
│   │
│   ├── App.tsx                           # Composant racine, routage et gestion d'état
│   ├── index.css                         # Styles Tailwind CSS et polices
│   ├── main.tsx                          # Point d'entrée React 19
│   └── types.ts                          # Définition des types TypeScript stricts
│
├── .env.example                          # Modèle des variables d'environnement
├── CAHIER_DES_CHARGES_RGPD.md            # Spécifications détaillées de conformité
├── docker-compose.yml                    # Déploiement en conteneur Docker
├── Dockerfile                            # Image Docker Debian 12 / Node 20 LTS
├── index.html                            # Point d'entrée HTML5 sans cache
├── install.sh                            # Script shell d'installation tout-en-un
├── package.json                          # Dépendances et scripts npm
├── push-github.sh                        # Script de push automatique vers GitHub
├── server.ts                             # Serveur Express backend complet
├── tsconfig.json                         # Configuration TypeScript
└── vite.config.ts                        # Configuration du bundler Vite
```

---

## 7. API Endpoints (Serveur Express)

### Fiches Infirmerie
- `GET /api/fiches` : Récupère la liste des fiches enregistrées.
- `GET /api/fiches/:id` : Récupère les données d'une fiche spécifique.
- `POST /api/fiches` : Crée ou met à jour une fiche avec génération et archivage PDF.
- `DELETE /api/fiches/:id` : Supprime définitivement la fiche d'un élève.
- `POST /api/fiches/purge` : Purge l'intégralité des fiches enregistrées dans la base.
- `PATCH /api/fiches/:id/classe` : Modifie la classe d'un élève.
- `POST /api/fiches/:id/retry-sync` : Relance la synchronisation Nextcloud.

### Brouillons Sécurisés (Côté Serveur)
- `GET /api/draft` : Récupère le dernier brouillon en cours de saisie.
- `POST /api/draft` : Sauvegarde automatique du brouillon en temps réel.
- `DELETE /api/draft` : Efface le brouillon après signature.

### Authentification & Sécurité
- `POST /api/auth/admin/login` : Connexion admin / infirmerie (vérification hash PBKDF2).
- `POST /api/auth/admin/change-password` : Changement de mot de passe staff.
- `POST /api/auth/parent/register` : Création de compte parent avec question secrète.
- `POST /api/auth/parent/login` : Connexion parentale.
- `POST /api/auth/parent/forgot-password/question` : Récupération de la question secrète.
- `POST /api/auth/parent/forgot-password/reset` : Réinitialisation du mot de passe parent.

### Classes Scolaires
- `GET /api/classes` : Liste des classes actives ordonnées.
- `POST /api/classes` : Création d'une nouvelle classe.
- `POST /api/classes/rename` : Renommage d'une classe (propagation automatique à tous les élèves rattachés).
- `POST /api/classes/delete` : Suppression d'une classe.

### Identité de l'Établissement & Branding
- `GET /api/branding` : Nom de l'établissement, sous-titre et logo (Base64).
- `POST /api/branding` : Mise à jour du nom, du sous-titre et du logo personnalisé.

### Stockage & Archives Physiques
- `GET /api/nextcloud/tree` : Renvoie l'arborescence complète des fichiers PDF sur le disque dur.
- `DELETE /api/archives/file` : Supprime un fichier PDF spécifique.
- `POST /api/archives/purge` : Supprime tous les fichiers dans `FICHES INFIRMERIE`.

---

## 8. Guide de Déploiement Complet sur Proxmox LXC (Debian 12)

### Étape 1 : Créer le conteneur LXC Proxmox
- **OS Template :** Debian 12 standard (Bookworm).
- **Ressources recommandées :** 1 à 2 vCPU, 1024 Mo de RAM, 8 Go d'espace disque.
- **Réseau :** IP statique ou DHCP (ex: `192.168.1.150`).

### Étape 2 : Déposer les fichiers sur le serveur
Déposez les fichiers dans le répertoire recommandé :
```bash
/opt/infirmerie
```

### Étape 3 : Exécuter l'installation en 1 seule commande
Connectez-vous en SSH ou via la console Proxmox sur votre conteneur LXC, puis exécutez :
```bash
cd /opt/infirmerie
chmod +x install.sh
./install.sh
```

Le script s'occupe de tout :
1. Mise à jour de Debian 12 (`apt update && apt upgrade -y`).
2. Installation de Node.js 20 LTS et npm.
3. Installation des dépendances du projet (`npm install`).
4. Création des répertoires de données persistantes (`data/`, `data/archives/`).
5. Compilation de production (`npm run build`).
6. Création et activation automatique du service **systemd** (`fiche-infirmerie.service`).

L'application est immédiatement opérationnelle sur :
`http://VOTRE_IP_LXC:3001`

---

## 9. Déploiement avec FileZilla (Arborescence et Droits)

Si vous transférez le projet via SFTP avec FileZilla :

1. **Répertoire cible distant :**
   ```text
   /opt/infirmerie/
   ```
2. **Fichiers et dossiers à transférer :**
   - Transférez tout le contenu du projet (**src**, **public**, **scripts**, `server.ts`, `package.json`, `tsconfig.json`, `vite.config.ts`, `install.sh`, etc.).
   - *Ne transférez pas* `node_modules` (il sera généré sur place par npm).
3. **Attribution des permissions :**
   Dans la console SSH du conteneur LXC :
   ```bash
   cd /opt/infirmerie
   chmod -R 755 /opt/infirmerie
   chmod +x install.sh push-github.sh
   ```
4. **Lancement du script :**
   ```bash
   ./install.sh
   ```

---

## 10. Déploiement Docker & Docker Compose

Pour ceux qui privilégient Docker sur Proxmox Debian 12 :

### Démarrage avec docker-compose
```bash
cd /opt/infirmerie
docker compose up -d --build
```

### Vérifier l'état du conteneur
```bash
docker compose ps
docker compose logs -f
```

Les données restent persistantes dans le volume monté `./data:/app/data`.

---

## 11. Gestion du Stockage, Archives & Procédure de Purge

Tous les documents générés sont stockés physiquement sur le disque dur du serveur dans :
```text
/opt/infirmerie/data/archives/FICHES INFIRMERIE/[Année]/[Classe]/
```

### Comment purger la liste depuis l'interface graphique :
1. Connectez-vous avec le compte `admin` ou `infirmerie`.
2. Pour vider les documents physiques :
   - Rendez-vous sur l'onglet **« Explorateur des fichiers PDF & Carnets sur le serveur »**.
   - Cliquez sur le bouton rouge **« Purger la liste »** et confirmez. Tous les fichiers PDF et dossiers d'élèves sont supprimés du disque.
3. Pour vider la liste des fiches enregistrées :
   - Rendez-vous sur l'onglet **« Par classe »** ou **« Toutes les fiches »**.
   - Cliquez sur le bouton rouge **« Purger les fiches »** et confirmez.

### Comment purger manuellement en ligne de commande :
```bash
# Vider tous les fichiers PDF archivés
rm -rf /opt/infirmerie/data/archives/FICHES\ INFIRMERIE/* /opt/infirmerie/data/nextcloud_storage/FICHES\ INFIRMERIE/*

# (Optionnel) Réinitialiser également la base des fiches
rm -f /opt/infirmerie/data/fiches.*

# Redémarrer le service
systemctl restart fiche-infirmerie
```

---

## 12. Personnalisation de l'Identité de l'Établissement & Logo

Dans la barre supérieure du tableau de bord d'administration :
1. Cliquez sur le bouton **« Identité & Logo »**.
2. Modifiez le nom officiel (ex: *ENSEMBLE SCOLAIRE NOTRE-DAME DES MISSIONS – SAINT-PIERRE*).
3. Modifiez le sous-titre (ex: *Sous-contrat d'Association avec l'État*).
4. Téléversez votre propre logo (formats acceptés : PNG, JPG, SVG, WebP).
5. Cliquez sur **« Enregistrer »**. La mise à jour est instantanée dans toute l'application et sur les en-têtes des PDF générés.

---

## 13. Procédure de Mise à Jour & Script de Push GitHub

### A. Mettre à jour l'application en production sur le serveur LXC
```bash
cd /opt/infirmerie
# Si vous utilisez Git :
git pull

# Si vous avez transféré des fichiers par FileZilla :
npm run update

# Redémarrer le service pour charger les modifications :
systemctl restart fiche-infirmerie
```

### B. Pusher le code source vers GitHub
Un script dédié `push-github.sh` est inclus pour automatiser le commit et le push vers votre compte GitHub (`serviceinformatique-droid`) :
```bash
cd /opt/infirmerie
chmod +x push-github.sh
./push-github.sh "Description de votre mise à jour"
```

Le script régénère automatiquement le README, compile le projet, effectue le commit Git et pousse les modifications sur votre dépôt distant.

---

## 14. Restauration GitHub sur un Nouveau Conteneur Proxmox LXC & Ports Réseau

### Quel est le port du projet ?
Le projet est configuré sur GitHub pour écouter sur le **Port TCP 3001** :
- **Adresse locale :** `http://localhost:3001`
- **Adresse réseau / intranet :** `http://<IP_DU_LXC>:3001`
- **Configuration :** La variable d'environnement `PORT` (définie à `3001` par défaut) est déclarée dans le service systemd `/etc/systemd/system/fiche-infirmerie.service`, dans `docker-compose.yml` (`3001:3001`), et dans le script de restauration `restore-lxc.sh`.

#### Que se passe-t-il si vous avez DÉJÀ Node.js 20 LTS installé sur votre conteneur ?
**Aucun problème, tout est 100% transparent et sécurisé !**
- Le script `restore-lxc.sh` ainsi que le script `install.sh` effectuent un test préalable : `command -v node` et vérifient si la version installée est supérieure ou égale à 18 (Node.js 20 LTS répond à `>= 18`).
- **Si Node.js 20 LTS est déjà présent :** Le script affiche immédiatement `[OK] Node.js déjà installé en version compatible : v20.x.x. Aucune réinstallation nécessaire.`
- **Il n'écrase pas, ne réinstalle pas et ne télécharge pas de doublon de Node.js.** Il passe directement à l'étape suivante (clonage et installation des dépendances `npm install`). Vos configurations système existantes sont ainsi préservées.

#### Vérifier que le port 3001 écoute correctement :
```bash
ss -tlpn | grep 3001
# ou
curl -I http://localhost:3001
```

#### Changer de port (ex: passer sur le port 8080, 3000 ou 80) :
1. Éditer le service systemd :
   ```bash
   nano /etc/systemd/system/fiche-infirmerie.service
   ```
2. Modifier la ligne : `Environment=PORT=8080` (ou tout autre port).
3. Recharger et redémarrer :
   ```bash
   systemctl daemon-reload
   systemctl restart fiche-infirmerie
   ```

---

### Procédure de Restauration Complète depuis GitHub sur un Nouveau Conteneur LXC

Un script d'automatisation clé en main `restore-lxc.sh` est fourni à la racine du projet.

#### Méthode 1 : Restauration en 1 seule ligne de commande (Recommandée)
Sur votre nouveau conteneur Proxmox LXC (Debian 12 vierge), connectez-vous en console root et exécutez directement :

```bash
# 1. Cloner le dépôt GitHub dans /opt/infirmerie
git clone https://github.com/serviceinformatique-droid/fiche-infirmerie.git /opt/infirmerie

# 2. Se positionner dans le répertoire
cd /opt/infirmerie

# 3. Lancer le script de restauration et démarrage automatique
chmod +x restore-lxc.sh
./restore-lxc.sh
```

#### Méthode 2 : Restauration avec FileZilla
1. **Connexion SFTP :** Ouvrez FileZilla, connectez-vous avec l'IP du nouveau LXC et le compte `root`.
2. **Répertoire cible :** Déposez le fichier `restore-lxc.sh` dans le dossier `/root/` ou dans `/opt/infirmerie/`.
3. **Exécution dans la console Proxmox :**
   ```bash
   chmod +x /root/restore-lxc.sh
   /root/restore-lxc.sh https://github.com/serviceinformatique-droid/fiche-infirmerie.git
   ```

#### Ce que le script `restore-lxc.sh` réalise automatiquement :
1. Met à jour les paquets Debian 12 (`apt update`) et installe les outils de base (`git`, `curl`, `build-essential`).
2. Vérifie la présence de Node.js : **si Node.js 20 LTS est déjà présent, il le conserve sans le réinstaller**. Sinon, il installe Node.js 20 LTS.
3. Clone ou met à jour le code source depuis `https://github.com/serviceinformatique-droid/fiche-infirmerie.git` dans `/opt/infirmerie`.
4. Crée l'arborescence des dossiers de stockage persistants (`/opt/infirmerie/data/archives/FICHES INFIRMERIE`).
5. Installe les dépendances npm (`npm install`).
6. Compile l'application pour la production (`npm run build`).
7. Crée et active le service systemd `/etc/systemd/system/fiche-infirmerie.service` sur le **port 3001**.
8. Démarre l'application et affiche l'URL d'accès avec l'adresse IP détectée (`http://<IP_DU_LXC>:3001`).

#### Optionnel : Restaurer les données existantes (élèves et archives de l'ancien LXC)
Si vous souhaitez transférer la base existante depuis votre ancien conteneur LXC vers le nouveau :
1. Sur l'ancien conteneur, archivez le dossier de données :
   ```bash
   tar -czvf /root/backup_data_infirmerie.tar.gz -C /opt/infirmerie data
   ```
2. Transférez `backup_data_infirmerie.tar.gz` sur le nouveau conteneur (via SCP ou FileZilla dans `/root/`).
3. Sur le nouveau conteneur :
   ```bash
   tar -xzvf /root/backup_data_infirmerie.tar.gz -C /opt/infirmerie/
   chmod 600 /opt/infirmerie/data/.master_encryption.key 2>/dev/null || true
   systemctl restart fiche-infirmerie
   ```

---

## 15. Dépannage & FAQ Technique

### L'application ne démarre pas après redémarrage du serveur LXC
Vérifiez que le service systemd est bien activé :
```bash
systemctl status fiche-infirmerie
journalctl -u fiche-infirmerie -n 50 --no-pager
```

### Le port 3000 est déjà occupé
Vous pouvez modifier le port dans `/etc/systemd/system/fiche-infirmerie.service` en changeant `Environment=PORT=3000` par `PORT=8080`, puis :
```bash
systemctl daemon-reload
systemctl restart fiche-infirmerie
```

### Affichage dans une Iframe (ENT / Proxmox)
L'application intègre nativement l'en-tête HTTP :
```http
Content-Security-Policy: frame-ancestors *
```
Elle ne bloque aucun affichage en iframe et s'adapte automatiquement à la largeur du conteneur parent.

---

*Documentation technique certifiée conforme aux exigences de l'Ensemble Scolaire Notre-Dame des Missions – Saint-Pierre.*
