import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable JSON body parsing with large payload limit for base64 PDFs and carnet images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 100% Server Authoritative - STRICT ZERO BROWSER CACHING & UNIVERSAL IFRAME COMPATIBILITY
app.use((req, res, next) => {
  // Prevent any caching on client and intermediate proxies
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, post-check=0, pre-check=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  // Universal Iframe Embedding: allow embedding in any portal, Proxmox dashboard, Nextcloud app iframe
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  next();
});

// ============================================================================
// SÉCURITÉ (build securite-20261011) — authentification serveur obligatoire
//  - Connexion parent / personnel => jeton de session aléatoire (mémoire serveur, 8 h glissantes)
//  - En-têtes envoyés par le frontend : X-Staff-Token (personnel) / X-Parent-Token (parent)
//  - Toute route /api non listée ci-dessous est RÉSERVÉE AU PERSONNEL (refus par défaut)
//  - Anti force brute : 5 échecs de connexion par adresse IP => blocage 15 min
// ============================================================================
console.log('[infirmerie] build securite-20261011');
app.set('trust proxy', true);

type SessionInfo = { role: 'staff' | 'parent'; id: string; label: string; expires: number };
const SESSION_TTL_MS = (Number(process.env.SESSION_TTL_HOURS) || 8) * 3600 * 1000;
const sessions = new Map<string, SessionInfo>();

function createSession(role: SessionInfo['role'], id: string, label: string): string {
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { role, id, label, expires: Date.now() + SESSION_TTL_MS });
  return token;
}

function readSession(token: string | undefined, role: SessionInfo['role']): SessionInfo | null {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s || s.role !== role) return null;
  if (s.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  s.expires = Date.now() + SESSION_TTL_MS;
  return s;
}

setInterval(() => {
  const now = Date.now();
  for (const [t, s] of sessions) if (s.expires < now) sessions.delete(t);
}, 10 * 60 * 1000).unref();

function headerValue(req: express.Request, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

function staffSession(req: express.Request): SessionInfo | null {
  // ?token= accepté uniquement pour les liens de téléchargement (<a href>), qui ne peuvent pas porter d'en-tête
  const q = req.path === '/api/download-file' && typeof req.query.token === 'string' ? req.query.token : undefined;
  return readSession(headerValue(req, 'x-staff-token') || q, 'staff');
}

function parentSession(req: express.Request): SessionInfo | null {
  return readSession(headerValue(req, 'x-parent-token'), 'parent');
}

// Anti force brute
const loginFailures = new Map<string, { count: number; lockedUntil: number }>();
const MAX_LOGIN_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

function isLocked(req: express.Request): number {
  const f = loginFailures.get(req.ip || '?');
  if (f && f.lockedUntil > Date.now()) return Math.ceil((f.lockedUntil - Date.now()) / 60000);
  return 0;
}
function recordFailure(req: express.Request) {
  const key = req.ip || '?';
  const f = loginFailures.get(key) || { count: 0, lockedUntil: 0 };
  if (f.lockedUntil && f.lockedUntil < Date.now()) { f.count = 0; f.lockedUntil = 0; }
  f.count++;
  if (f.count >= MAX_LOGIN_FAILURES) {
    f.lockedUntil = Date.now() + LOCK_MS;
    console.warn(`[securite] Adresse ${key} bloquée 15 min après ${f.count} échecs de connexion`);
  }
  loginFailures.set(key, f);
}
function clearFailures(req: express.Request) {
  loginFailures.delete(req.ip || '?');
}

// Appel interne du portail NDM (secret NDM_INTERNAL_SECRET, ≥ 24 caractères, comparaison à temps constant)
function isInternalCall(req: express.Request): boolean {
  const secret = process.env.NDM_INTERNAL_SECRET || '';
  const got = headerValue(req, 'x-ndm-internal') || '';
  if (secret.length < 24 || !got) return false;
  const a = crypto.createHash('sha256').update(secret).digest();
  const b = crypto.createHash('sha256').update(got).digest();
  return crypto.timingSafeEqual(a, b);
}

function revokeSessionsOf(role: SessionInfo['role'], id: string) {
  for (const [t, s] of sessions) if (s.role === role && s.id.toLowerCase() === id.toLowerCase()) sessions.delete(t);
}

// Contrôle d'accès par route
const PUBLIC_ROUTES = new Set([
  'GET /api/branding',
  'GET /api/classes',
  'GET /api/auth/status',
  'GET /api/rgpd/cahier-des-charges',
  'POST /api/auth/parent/register',
  'POST /api/auth/parent/login',
  'POST /api/auth/parent/forgot-password/question',
  'POST /api/auth/parent/forgot-password/reset',
  'POST /api/auth/admin/login',
  'POST /api/auth/logout',
]);
const PARENT_ROUTES = new Set([
  'POST /api/fiches',
  'GET /api/draft',
  'POST /api/draft',
  'DELETE /api/draft',
]);

app.use((req, res, next) => {
  const p = req.path.toLowerCase().replace(/\/+$/, '');
  if (!p.startsWith('/api')) return next();
  const key = `${req.method} ${p}`;
  if (PUBLIC_ROUTES.has(key)) return next();
  // Gestion centralisée : le portail NDM appelle par le réseau Docker interne avec le secret partagé
  // (la passerelle nginx supprime cet en-tête de toute requête venant de l'extérieur)
  if (isInternalCall(req)) {
    (req as any).auth = { role: 'staff', id: 'portail', label: 'Portail NDM (gestion centralisée)', expires: 0 } as SessionInfo;
    return next();
  }
  if (p.startsWith('/api/internal')) {
    return res.status(403).json({ success: false, error: 'Réservé au portail NDM.' });
  }
  const staff = staffSession(req);
  if (staff) {
    (req as any).auth = staff;
    return next();
  }
  if (PARENT_ROUTES.has(key)) {
    const parent = parentSession(req);
    if (parent) {
      (req as any).auth = parent;
      return next();
    }
  }
  return res.status(401).json({ success: false, error: 'Session expirée ou non autorisée. Veuillez vous reconnecter.', code: 'auth-required' });
});

// Résolution sûre d'un chemin relatif dans un dossier (anti « ../ »)
function safeResolve(baseDir: string, relPath: string): string | null {
  const base = path.resolve(baseDir);
  const abs = path.resolve(base, String(relPath).replace(/^[\/\\]+/, ''));
  return abs === base || abs.startsWith(base + path.sep) ? abs : null;
}

// Directories for local durable persistence on Debian 12 (Proxmox LXC)
const DATA_DIR = path.join(process.cwd(), 'data');
const FICHES_FILE = path.join(DATA_DIR, 'fiches.json');
const FICHES_ENC_FILE = path.join(DATA_DIR, 'fiches.enc');
const ACCOUNTS_ENC_FILE = path.join(DATA_DIR, 'accounts.enc');
const DRAFT_FILE = path.join(DATA_DIR, 'draft.json');
const DRAFT_ENC_FILE = path.join(DATA_DIR, 'draft.enc');
const KEY_FILE = path.join(DATA_DIR, '.master_encryption.key');
const ARCHIVES_DIR = path.join(DATA_DIR, 'archives');
const NEXTCLOUD_STORAGE_DIR = path.join(DATA_DIR, 'nextcloud_storage');
const CLASSES_FILE = path.join(DATA_DIR, 'classes.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const BRANDING_FILE = path.join(DATA_DIR, 'branding.json');

interface SchoolBranding {
  schoolName: string;
  subTitle: string;
  logoDataUrl?: string; // base64 / data URL or empty for default
}

const DEFAULT_BRANDING: SchoolBranding = {
  // Nom initial : ETABLISSEMENT_NOM du .env (ensuite : gestion centralisée du portail NDM ou « Identité & Logo »)
  schoolName: (process.env.ETABLISSEMENT_NOM || '').trim() || 'Ensemble Scolaire Notre-Dame des Missions',
  subTitle: "Sous-contrat d'Association avec l'État",
  logoDataUrl: '',
};

function getSchoolBranding(): SchoolBranding {
  try {
    if (fs.existsSync(BRANDING_FILE)) {
      const raw = fs.readFileSync(BRANDING_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_BRANDING, ...parsed };
    }
  } catch (err) {
    console.error('Error reading branding:', err);
  }
  return DEFAULT_BRANDING;
}

function saveSchoolBranding(branding: SchoolBranding) {
  fs.writeFileSync(BRANDING_FILE, JSON.stringify(branding, null, 2), 'utf-8');
}

const DEFAULT_CLASSES = [
  '6ème A', '6ème B', '6ème C', '6ème D',
  '5ème A', '5ème B', '5ème C', '5ème D',
  '4ème A', '4ème B', '4ème C', '4ème D',
  '3ème A', '3ème B', '3ème C', '3ème D',
  '2nde 1', '2nde 2', '2nde 3', '2nde 4',
  '1ère G1', '1ère G2', '1ère G3', '1ère STMG',
  'Tale G1', 'Tale G2', 'Tale G3', 'Tale STMG'
];

function getClasses(): string[] {
  try {
    if (!fs.existsSync(CLASSES_FILE)) {
      fs.writeFileSync(CLASSES_FILE, JSON.stringify(DEFAULT_CLASSES, null, 2), 'utf-8');
      return DEFAULT_CLASSES;
    }
    const raw = fs.readFileSync(CLASSES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_CLASSES;
  } catch {
    return DEFAULT_CLASSES;
  }
}

function saveClasses(classesList: string[]) {
  fs.writeFileSync(CLASSES_FILE, JSON.stringify(classesList, null, 2), 'utf-8');
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(ARCHIVES_DIR)) {
  fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
}
if (!fs.existsSync(NEXTCLOUD_STORAGE_DIR)) {
  fs.mkdirSync(NEXTCLOUD_STORAGE_DIR, { recursive: true });
}

// Ensure any existing files from nextcloud_storage mirror are consolidated into archives
try {
  const legacyDir = path.join(NEXTCLOUD_STORAGE_DIR, 'FICHES INFIRMERIE');
  const targetDir = path.join(ARCHIVES_DIR, 'FICHES INFIRMERIE');
  if (fs.existsSync(legacyDir) && !fs.existsSync(targetDir)) {
    fs.cpSync(legacyDir, targetDir, { recursive: true });
  }
} catch (e) {
  // Ignored
}

// Nextcloud credentials from env or config file
interface NextcloudConfig {
  url: string;
  username: string;
  appPassword: string;
  rootFolder: string;
  enabled: boolean;
  isCustomConfigured: boolean;
}

let nextcloudConfig: NextcloudConfig = {
  url: process.env.NEXTCLOUD_URL || '',
  username: process.env.NEXTCLOUD_USERNAME || '',
  appPassword: process.env.NEXTCLOUD_PASSWORD || '',
  rootFolder: process.env.NEXTCLOUD_ROOT_FOLDER || 'FICHES INFIRMERIE',
  enabled: true,
  isCustomConfigured: !!(process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_USERNAME),
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    nextcloudConfig = { ...nextcloudConfig, ...savedConfig };
  } catch (err) {
    console.error('Error reading nextcloud config:', err);
  }
}

// Seed initial fiches if file does not exist (including the examples from specs: DUPONT Jean 6A, MARTIN Emma 6A)
function initializeFiches() {
  if (!fs.existsSync(FICHES_FILE)) {
    const sampleFiches = [
      {
        id: 'fiche-dupont-jean-2026',
        schoolYear: '2026-2027',
        status: 'transmise_nextcloud',
        eleve: {
          classe: '6ème A',
          nom: 'DUPONT',
          prenom: 'Jean',
          dateNaissance: '2014-04-12',
          adresse: '14 Rue de la République',
          codePostal: '94220',
          ville: 'Charenton-le-Pont',
          nomMedecinTraitant: 'Garnier',
          telMedecinTraitant: '01 43 76 89 20',
        },
        responsableLegal: {
          nom: 'DUPONT Marc',
          statut: 'pere',
          telPersonnel: '06 12 34 56 78',
          telTravailMere: '01 45 23 89 00',
          telTravailMereNonConcerne: false,
          telTravailPere: '01 42 30 11 22',
          telTravailPereNonConcerne: false,
        },
        urgenceAccident: {
          nomPrenom: 'DUPONT Éléonore (Grand-mère)',
          telPersonnel: '06 98 76 54 32',
          telTravail: 'Non concerné',
          telTravailNonConcerne: true,
          adresse: '8 Avenue Victor Hugo, 94220 Charenton-le-Pont',
        },
        sante: {
          vaccinations: {
            antipoliomyelitique: { status: 'a_jour', date: '2024-05-10' },
            antidiphterique: { status: 'a_jour', date: '2024-05-10' },
            antitetanique: { status: 'a_jour', date: '2024-05-10' },
            anticoqueluche: { status: 'a_jour', date: '2024-05-10' },
            antituberculeux_bcg: { status: 'a_jour', date: '2016-09-15' },
          },
          carnetVaccinations: [
            {
              id: 'carnet-dupont-1',
              name: 'carnet_vaccinations_p1.jpg',
              type: 'image/jpeg',
              size: 245000,
              dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEfgHpqk8c9AAAAABJRU5ErkJggg==',
              uploadedAt: new Date().toISOString(),
            },
          ],
          allergiesDifficultesSante: 'Aucune allergie ou difficulté de santé à signaler.',
          aucuneAllergie: true,
        },
        autorisationParentale: {
          soussigneNomPrenom: 'DUPONT Marc',
          qualite: 'pere',
          nomEnfant: 'Jean DUPONT',
          accordPriseEnCharge: true,
          accordActesMedicaux: true,
          faitA: 'Charenton-le-Pont',
          faitLe: '15/09/2026',
          signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEfgHpqk8c9AAAAABJRU5ErkJggg==',
          mentionLuEtApprouve: true,
          signataireNomComplet: 'DUPONT Marc',
          dateHeureSignature: '2026-09-15T09:30:00.000Z',
        },
        consentementDonneesSante: {
          accepteCollecteEtTransmission: true,
          dateConsentement: '2026-09-15T09:30:00.000Z',
        },
        nextcloud: {
          status: 'transmis',
          dossierCible: 'FICHES INFIRMERIE/2026-2027/6A',
          fichierFicheNom: 'DUPONT_Jean_Fiche_infirmerie_2026-2027.pdf',
          fichierCarnetNom: 'DUPONT_Jean_Carnet_vaccinations_2026-2027.pdf',
          derniereTentative: '2026-09-15T09:30:04.000Z',
        },
        createdAt: '2026-09-15T09:20:00.000Z',
        updatedAt: '2026-09-15T09:30:04.000Z',
        historique: [
          { date: '2026-09-15T09:20:00.000Z', action: 'Création du formulaire' },
          { date: '2026-09-15T09:30:00.000Z', action: 'Signature électronique par le représentant légal' },
          { date: '2026-09-15T09:30:04.000Z', action: 'Transmission réussie vers Nextcloud dans /6A' },
        ],
      },
      {
        id: 'fiche-martin-emma-2026',
        schoolYear: '2026-2027',
        status: 'erreur_transmission',
        eleve: {
          classe: '6ème A',
          nom: 'MARTIN',
          prenom: 'Emma',
          dateNaissance: '2014-08-25',
          adresse: '22 Rue Pasteur',
          codePostal: '94220',
          ville: 'Charenton-le-Pont',
          nomMedecinTraitant: 'Lemoine',
          telMedecinTraitant: '01 43 96 12 34',
        },
        responsableLegal: {
          nom: 'MARTIN Sophie',
          statut: 'mere',
          telPersonnel: '06 55 44 33 22',
          telTravailMere: '01 48 00 22 11',
          telTravailMereNonConcerne: false,
          telTravailPere: 'Non concerné',
          telTravailPereNonConcerne: true,
        },
        urgenceAccident: {
          nomPrenom: 'BERNARD Luc (Oncle)',
          telPersonnel: '06 11 22 33 44',
          telTravail: 'Non concerné',
          telTravailNonConcerne: true,
          adresse: '5 Allée des Tilleuls, 94220 Charenton-le-Pont',
        },
        sante: {
          vaccinations: {
            antipoliomyelitique: { status: 'a_jour', date: '2024-03-12' },
            antidiphterique: { status: 'a_jour', date: '2024-03-12' },
            antitetanique: { status: 'a_jour', date: '2024-03-12' },
            anticoqueluche: { status: 'a_jour', date: '2024-03-12' },
            antituberculeux_bcg: { status: 'non_realise' },
          },
          carnetVaccinations: [
            {
              id: 'carnet-martin-1',
              name: 'carnet_emma.png',
              type: 'image/png',
              size: 180000,
              dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEfgHpqk8c9AAAAABJRU5ErkJggg==',
              uploadedAt: new Date().toISOString(),
            },
          ],
          allergiesDifficultesSante: 'Asthme à l effort. Ventoline à disposition dans le sac d école.',
          aucuneAllergie: false,
        },
        autorisationParentale: {
          soussigneNomPrenom: 'MARTIN Sophie',
          qualite: 'mere',
          nomEnfant: 'Emma MARTIN',
          accordPriseEnCharge: true,
          accordActesMedicaux: true,
          faitA: 'Charenton-le-Pont',
          faitLe: '16/09/2026',
          signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEfgHpqk8c9AAAAABJRU5ErkJggg==',
          mentionLuEtApprouve: true,
          signataireNomComplet: 'MARTIN Sophie',
          dateHeureSignature: '2026-09-16T14:15:00.000Z',
        },
        consentementDonneesSante: {
          accepteCollecteEtTransmission: true,
          dateConsentement: '2026-09-16T14:15:00.000Z',
        },
        nextcloud: {
          status: 'erreur',
          dossierCible: 'FICHES INFIRMERIE/2026-2027/6A',
          fichierFicheNom: 'MARTIN_Emma_Fiche_infirmerie_2026-2027.pdf',
          fichierCarnetNom: 'MARTIN_Emma_Carnet_vaccinations_2026-2027.pdf',
          derniereTentative: '2026-09-16T14:15:03.000Z',
          messageErreur: 'Nextcloud momentanément indisponible lors de la tentative initiale (sauvegardé en local)',
          retryCount: 1,
        },
        createdAt: '2026-09-16T14:00:00.000Z',
        updatedAt: '2026-09-16T14:15:03.000Z',
        historique: [
          { date: '2026-09-16T14:00:00.000Z', action: 'Création du formulaire' },
          { date: '2026-09-16T14:15:00.000Z', action: 'Signature électronique validée' },
          { date: '2026-09-16T14:15:03.000Z', action: 'Échec de transmission Nextcloud (sauvegarde sécurisée effectuée)' },
        ],
      },
    ];

    fs.writeFileSync(FICHES_FILE, JSON.stringify(sampleFiches, null, 2), 'utf-8');

    // Create folder structure in local mirror
    const dir6A = path.join(NEXTCLOUD_STORAGE_DIR, 'FICHES INFIRMERIE', '2026-2027', '6A');
    fs.mkdirSync(dir6A, { recursive: true });
    // Write sample text representation
    fs.writeFileSync(path.join(dir6A, 'DUPONT_Jean_Fiche_infirmerie_2026-2027.pdf'), 'PDF Fiche DUPONT Jean');
    fs.writeFileSync(path.join(dir6A, 'DUPONT_Jean_Carnet_vaccinations_2026-2027.pdf'), 'PDF Carnet DUPONT Jean');
  }
}

// ============================================================================
// --- 100% CRYPTAGE AES-256-GCM NATIVE POUR TOUTES LES DONNÉES SENSIBLES ---
// ============================================================================

function getMasterKey(): Buffer {
  if (fs.existsSync(KEY_FILE)) {
    const raw = fs.readFileSync(KEY_FILE);
    if (raw.length === 32) {
      return raw;
    }
    // If key file was text or corrupted in transfer (e.g. 54 bytes), derive strict 32 bytes via sha256
    return crypto.createHash('sha256').update(raw).digest();
  }
  const newKey = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, newKey, { mode: 0o600 });
  return newKey;
}

const MASTER_KEY = getMasterKey();

// AES-256-GCM encryption
function encryptData(obj: any): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const jsonStr = JSON.stringify(obj);
  let encrypted = cipher.update(jsonStr, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

// AES-256-GCM decryption
function decryptData(encryptedStr: string): any {
  const parts = encryptedStr.split(':');
  if (parts.length !== 3) {
    throw new Error('Format chiffré invalide');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return JSON.parse(decrypted);
}

// ============================================================================
// --- GESTION COMPTES PARENTS ET ADMIN (MOT DE PASSE & QUESTION SECRÈTE) ---
// ============================================================================

interface ParentAccount {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone: string;
  hash: string;
  salt: string;
  secretQuestion: string;
  secretAnswerHash: string;
  createdAt: string;
}

interface StaffAccount {
  username: string; // 'admin' | 'infirmerie'
  label: string;
  hash: string;
  salt: string;
  updatedAt: string;
}

interface AccountStore {
  staff: StaffAccount[];
  admin?: {
    username: string;
    hash: string;
    salt: string;
    updatedAt: string;
  };
  parents: ParentAccount[];
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const finalSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, finalSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: finalSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const calculated = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return calculated === hash;
}

// ----------------------------------------------------------------------------
// Comptes parents communs avec la Fiche Sanitaire (build parents-communs-20261011)
// Un compte parent créé dans l'une des deux applications est recopié dans l'autre par le portail NDM,
// SANS mot de passe en clair : les empreintes sont échangées sous forme « portable » :
//   pbkdf2-sha512$100000$<sel>$<hex>   (mot de passe Infirmerie)
//   pbkdf2a-sha256$50000$<sel>$<hex>   (réponse secrète Infirmerie)
//   scrypt$N$r$p$<sel b64>$<clé b64>   (format Fiche Sanitaire, vérifié ici tel quel)
// ----------------------------------------------------------------------------
function verifyScrypt(plain: string, stored: string): boolean {
  try {
    const [, N, r, p, salt, key] = stored.split('$');
    const exp = Buffer.from(key, 'base64');
    const got = crypto.scryptSync(plain, Buffer.from(salt, 'base64'), exp.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  } catch {
    return false;
  }
}

function verifyPortable(plain: string, stored: string, kind: 'password' | 'answer'): boolean {
  if (stored.startsWith('scrypt$')) {
    // Fiche Sanitaire : réponse secrète = minuscules + espaces retirés aux extrémités
    return verifyScrypt(kind === 'answer' ? plain.trim().toLowerCase() : plain, stored);
  }
  const [k, iter, salt, hex] = stored.split('$');
  try {
    const exp = Buffer.from(hex, 'hex');
    if (k === 'pbkdf2-sha512') {
      const got = crypto.pbkdf2Sync(plain, salt, Number(iter), 64, 'sha512');
      return got.length === exp.length && crypto.timingSafeEqual(got, exp);
    }
    if (k === 'pbkdf2a-sha256') {
      const norm = plain.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const got = crypto.pbkdf2Sync(norm, salt, Number(iter), 32, 'sha256');
      return got.length === exp.length && crypto.timingSafeEqual(got, exp);
    }
  } catch {
    /* format invalide */
  }
  return false;
}

function verifyParentPassword(p: ParentAccount, password: string): boolean {
  if (p.hash && p.hash.includes('$')) return verifyPortable(password, p.hash, 'password');
  return verifyPassword(password, p.hash, p.salt);
}

function verifyParentAnswer(p: ParentAccount, answer: string): boolean {
  if (p.secretAnswerHash && p.secretAnswerHash.includes('$')) return verifyPortable(answer, p.secretAnswerHash, 'answer');
  const a = Buffer.from(hashSecretAnswer(answer, p.salt), 'hex');
  const b = Buffer.from(p.secretAnswerHash || '', 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

/** Empreintes au format portable (pour la synchronisation) */
function portablePassword(p: ParentAccount): string | null {
  if (!p.hash) return null;
  return p.hash.includes('$') ? p.hash : `pbkdf2-sha512$100000$${p.salt}$${p.hash}`;
}
function portableAnswer(p: ParentAccount): string | null {
  if (!p.secretAnswerHash) return null;
  return p.secretAnswerHash.includes('$') ? p.secretAnswerHash : `pbkdf2a-sha256$50000$${p.salt}$${p.secretAnswerHash}`;
}

// Prévient le portail NDM qu'un compte a changé (regroupé sur 1,5 s, sans donnée)
let pingTimer: NodeJS.Timeout | null = null;
let pingSuspendu = false;
function pingSyncParents() {
  const secret = process.env.NDM_INTERNAL_SECRET || '';
  if (pingSuspendu || secret.length < 24 || pingTimer) return;
  pingTimer = setTimeout(() => {
    pingTimer = null;
    fetch((process.env.NDM_PORTAIL_INTERNAL_URL || 'http://portail:3020') + '/internal/parents/sync', {
      method: 'POST',
      headers: { 'X-Ndm-Internal': secret },
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }, 1500);
}

function hashSecretAnswer(answer: string, salt: string): string {
  const normalized = answer.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return crypto.pbkdf2Sync(normalized, salt, 50000, 32, 'sha256').toString('hex');
}

// Mot de passe INITIAL des comptes du personnel (création uniquement) — fixé par .env (INFIRMERIE_STAFF_PASSWORD)
const DEFAULT_STAFF_PASSWORD = process.env.INFIRMERIE_STAFF_PASSWORD || 'infirmerie2026!';

function getAccounts(): AccountStore {
  try {
    if (fs.existsSync(ACCOUNTS_ENC_FILE)) {
      const rawEnc = fs.readFileSync(ACCOUNTS_ENC_FILE, 'utf-8');
      const store: AccountStore = decryptData(rawEnc);

      // Ensure staff array exists with both 'admin' and 'infirmerie'
      let modified = false;
      if (!store.staff || !Array.isArray(store.staff)) {
        store.staff = [];
        modified = true;
      }

      const hasAdmin = store.staff.some((s) => s.username.toLowerCase() === 'admin');
      if (!hasAdmin) {
        if (store.admin) {
          store.staff.push({
            username: 'admin',
            label: 'Direction / Administrateur',
            hash: store.admin.hash,
            salt: store.admin.salt,
            updatedAt: store.admin.updatedAt || new Date().toISOString(),
          });
        } else {
          const creds = hashPassword(DEFAULT_STAFF_PASSWORD);
          store.staff.push({
            username: 'admin',
            label: 'Direction / Administrateur',
            hash: creds.hash,
            salt: creds.salt,
            updatedAt: new Date().toISOString(),
          });
        }
        modified = true;
      }

      const hasInfirmerie = store.staff.some((s) => s.username.toLowerCase() === 'infirmerie');
      if (!hasInfirmerie) {
        const creds = hashPassword(DEFAULT_STAFF_PASSWORD);
        store.staff.push({
          username: 'infirmerie',
          label: 'Service Infirmerie',
          hash: creds.hash,
          salt: creds.salt,
          updatedAt: new Date().toISOString(),
        });
        modified = true;
      }

      if (modified) {
        saveAccounts(store);
      }

      return store;
    }
  } catch (err) {
    console.error('Erreur lecture comptes chiffrés :', err);
  }

  // Initialisation des deux comptes d'administration par défaut
  const adminCreds = hashPassword(DEFAULT_STAFF_PASSWORD);
  const infirmerieCreds = hashPassword(DEFAULT_STAFF_PASSWORD);
  const defaultAccounts: AccountStore = {
    staff: [
      {
        username: 'admin',
        label: 'Direction / Administrateur',
        hash: adminCreds.hash,
        salt: adminCreds.salt,
        updatedAt: new Date().toISOString(),
      },
      {
        username: 'infirmerie',
        label: 'Service Infirmerie',
        hash: infirmerieCreds.hash,
        salt: infirmerieCreds.salt,
        updatedAt: new Date().toISOString(),
      },
    ],
    admin: {
      username: 'admin',
      hash: adminCreds.hash,
      salt: adminCreds.salt,
      updatedAt: new Date().toISOString(),
    },
    parents: [],
  };

  saveAccounts(defaultAccounts);
  return defaultAccounts;
}

function saveAccounts(store: AccountStore) {
  const encrypted = encryptData(store);
  fs.writeFileSync(ACCOUNTS_ENC_FILE, encrypted, 'utf-8');
  pingSyncParents();
}

// Initialise accounts on startup
getAccounts();

initializeFiches();

function getFiches(): any[] {
  try {
    if (fs.existsSync(FICHES_ENC_FILE)) {
      const rawEnc = fs.readFileSync(FICHES_ENC_FILE, 'utf-8');
      return decryptData(rawEnc);
    }
    // Migration from plaintext if fiches.json existed
    if (fs.existsSync(FICHES_FILE)) {
      const raw = fs.readFileSync(FICHES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      saveFiches(parsed);
      return parsed;
    }
  } catch (err) {
    console.error('Error reading fiches:', err);
  }
  return [];
}

function saveFiches(fiches: any[]) {
  const encrypted = encryptData(fiches);
  fs.writeFileSync(FICHES_ENC_FILE, encrypted, 'utf-8');
}

// Format directory from class (e.g. "6ème A" -> "6A")
function formatClassDirectory(classe: string): string {
  return (classe || 'AUTRE')
    .replace(/ème\s*/i, '')
    .replace(/\s+/g, '')
    .trim();
}

// Local server archival (pure on-disk storage on Debian 12 / Proxmox LXC)
function saveToLocalArchives(fiche: any, pdfFicheBase64?: string, pdfCarnetBase64?: string): { success: boolean; message: string; folder: string } {
  const rootFolder = 'FICHES INFIRMERIE';
  const schoolYear = fiche.schoolYear || '2026-2027';
  const classDir = formatClassDirectory(fiche.eleve?.classe || '6A');
  const targetFolder = `${rootFolder}/${schoolYear}/${classDir}`;

  const nom = (fiche.eleve?.nom || 'NOM').toUpperCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const prenom = (fiche.eleve?.prenom || 'Prenom').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const ficheFileName = `${nom}_${prenom}_Fiche_infirmerie_${schoolYear}.pdf`;
  const carnetFileName = `${nom}_${prenom}_Carnet_vaccinations_${schoolYear}.pdf`;

  // Write directly into local server archives folder
  const localTargetDir = path.join(ARCHIVES_DIR, rootFolder, schoolYear, classDir);
  fs.mkdirSync(localTargetDir, { recursive: true });

  if (pdfFicheBase64) {
    const ficheBuffer = Buffer.from(pdfFicheBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    fs.writeFileSync(path.join(localTargetDir, ficheFileName), ficheBuffer);
  }
  if (pdfCarnetBase64) {
    const carnetBuffer = Buffer.from(pdfCarnetBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    fs.writeFileSync(path.join(localTargetDir, carnetFileName), carnetBuffer);
  }

  // Also save copies in legacy NEXTCLOUD_STORAGE_DIR mirror so no existing path breaks
  try {
    const mirrorDir = path.join(NEXTCLOUD_STORAGE_DIR, rootFolder, schoolYear, classDir);
    fs.mkdirSync(mirrorDir, { recursive: true });
    if (pdfFicheBase64) {
      fs.writeFileSync(path.join(mirrorDir, ficheFileName), Buffer.from(pdfFicheBase64.replace(/^data:[^;]+;base64,/, ''), 'base64'));
    }
    if (pdfCarnetBase64) {
      fs.writeFileSync(path.join(mirrorDir, carnetFileName), Buffer.from(pdfCarnetBase64.replace(/^data:[^;]+;base64,/, ''), 'base64'));
    }
  } catch (e) {
    // Ignored
  }

  return {
    success: true,
    message: `Fichiers archivés et classés avec succès sur le disque local du serveur (${targetFolder})`,
    folder: targetFolder,
  };
}

async function syncToNextcloud(fiche: any, pdfFicheBase64?: string, pdfCarnetBase64?: string): Promise<{ success: boolean; message: string; folder: string }> {
  // 100% Local Autonomous Archival on the Debian 12 LXC Container
  return saveToLocalArchives(fiche, pdfFicheBase64, pdfCarnetBase64);
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Get school branding (name, subtitle, custom logo)
app.get('/api/branding', (req, res) => {
  res.json({ success: true, branding: getSchoolBranding() });
});

// Update school branding
app.post('/api/branding', (req, res) => {
  try {
    const { schoolName, subTitle, logoDataUrl } = req.body;
    const current = getSchoolBranding();
    const updated: SchoolBranding = {
      schoolName: (schoolName || current.schoolName).trim(),
      subTitle: subTitle !== undefined ? subTitle.trim() : current.subTitle,
      logoDataUrl: logoDataUrl !== undefined ? logoDataUrl : current.logoDataUrl,
    };
    saveSchoolBranding(updated);
    if (updated.schoolName !== current.schoolName) renommerDansCahier(current.schoolName, updated.schoolName);
    res.json({ success: true, branding: updated, message: 'Identité et logo mis à jour avec succès.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Nom de l'établissement dans le cahier des charges RGPD (build etablissement-central-20261011)
// Le modèle contient la variable {{ETABLISSEMENT}}, remplacée à l'affichage par le nom enregistré.
// Une version modifiée par l'administration (texte concret) est mise à jour lors d'un changement de nom.
// ---------------------------------------------------------------------------
const CAHIER_VAR = '{{ETABLISSEMENT}}';
const CAHIER_FILES = () => [path.join(process.cwd(), 'CAHIER_DES_CHARGES_RGPD.md'), path.join(process.cwd(), 'public', 'CAHIER_DES_CHARGES_RGPD.md')];

function renderCahier(md: string): string {
  return String(md || '').split(CAHIER_VAR).join(getSchoolBranding().schoolName);
}

function renommerDansCahier(ancien: string, nouveau: string) {
  if (!ancien || !nouveau || ancien === nouveau) return;
  for (const f of CAHIER_FILES()) {
    try {
      if (!fs.existsSync(f)) continue;
      const md = fs.readFileSync(f, 'utf-8');
      if (md.includes(ancien)) {
        fs.writeFileSync(f, md.split(ancien).join(nouveau), 'utf-8');
        console.log(`[etablissement] Cahier des charges RGPD : « ${ancien} » remplacé par « ${nouveau} » (${path.basename(path.dirname(f))})`);
      }
    } catch (e: any) {
      console.error('[etablissement] Cahier des charges non mis à jour :', e.message);
    }
  }
}

// Installation existante : l'ancien nom écrit en dur dans le cahier devient la variable (une seule fois)
(function migrerCahier() {
  const ANCIEN = 'Ensemble Scolaire Notre-Dame des Missions – Saint-Pierre';
  for (const f of CAHIER_FILES()) {
    try {
      if (!fs.existsSync(f)) continue;
      const md = fs.readFileSync(f, 'utf-8');
      if (!md.includes(ANCIEN)) continue;
      const neuf = md
        .split(`de l'${ANCIEN}`).join(`de l'établissement ${CAHIER_VAR}`)
        .split(`Pour l'${ANCIEN}`).join(`Pour l'établissement ${CAHIER_VAR}`)
        .split(ANCIEN).join(CAHIER_VAR);
      fs.writeFileSync(f, neuf, 'utf-8');
      console.log('[etablissement] Cahier des charges RGPD : nom en dur remplacé par la variable', CAHIER_VAR);
    } catch (e: any) {
      console.error('[etablissement] Migration du cahier impossible :', e.message);
    }
  }
})();

// Reset branding to default
app.post('/api/branding/reset', (req, res) => {
  try {
    const avant = getSchoolBranding().schoolName;
    saveSchoolBranding(DEFAULT_BRANDING);
    renommerDansCahier(avant, DEFAULT_BRANDING.schoolName);
    res.json({ success: true, branding: DEFAULT_BRANDING, message: 'Identité réinitialisée par défaut.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List all classes
app.get('/api/classes', (req, res) => {
  res.json({ success: true, classes: getClasses() });
});

// Create a new class
app.post('/api/classes', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Le nom de la classe est obligatoire.' });
    }
    const trimmed = name.trim();
    const current = getClasses();
    if (current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      return res.status(400).json({ success: false, error: `La classe "${trimmed}" existe déjà.` });
    }
    const updated = [...current, trimmed];
    saveClasses(updated);
    res.json({ success: true, classes: updated, message: `Classe "${trimmed}" créée avec succès.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rename a class (POST or PUT)
function performClassRename(oldNameRaw: string, newNameRaw: string, res: any) {
  try {
    const oldName = (oldNameRaw || '').trim();
    const newName = (newNameRaw || '').trim();

    if (!oldName || !newName) {
      return res.status(400).json({ success: false, error: 'L\'ancien et le nouveau nom de classe sont obligatoires.' });
    }

    const current = getClasses();
    const index = current.findIndex((c) => c.toLowerCase() === oldName.toLowerCase());
    if (index === -1) {
      return res.status(404).json({ success: false, error: `Classe "${oldName}" introuvable.` });
    }

    // Check collision if different name
    if (oldName.toLowerCase() !== newName.toLowerCase() && current.some((c) => c.toLowerCase() === newName.toLowerCase())) {
      return res.status(400).json({ success: false, error: `Une classe nommée "${newName}" existe déjà.` });
    }

    current[index] = newName;
    saveClasses(current);

    // Propagate class rename to student fiches
    const fiches = getFiches();
    let updatedCount = 0;
    fiches.forEach((f) => {
      if (f.eleve && f.eleve.classe && f.eleve.classe.trim().toLowerCase() === oldName.toLowerCase()) {
        f.eleve.classe = newName;
        f.updatedAt = new Date().toISOString();
        f.historique = f.historique || [];
        f.historique.push({
          date: new Date().toISOString(),
          action: `Classe mise à jour : "${oldName}" ➔ "${newName}"`,
        });
        updatedCount++;
      }
    });
    if (updatedCount > 0) {
      saveFiches(fiches);
    }

    res.json({
      success: true,
      classes: current,
      updatedCount,
      message: `Classe "${oldName}" renommée en "${newName}" (${updatedCount} élève(s) mis à jour).`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Delete a class (POST or DELETE)
function performClassDelete(nameRaw: string, res: any) {
  try {
    const targetName = (nameRaw || '').trim();
    if (!targetName) {
      return res.status(400).json({ success: false, error: 'Nom de la classe à supprimer obligatoire.' });
    }

    const current = getClasses();
    const updated = current.filter((c) => c.toLowerCase() !== targetName.toLowerCase());
    saveClasses(updated);

    // Reassign affected students to 'Non assignée' to avoid orphans
    const fiches = getFiches();
    let affectedCount = 0;
    fiches.forEach((f) => {
      if (f.eleve && f.eleve.classe && f.eleve.classe.trim().toLowerCase() === targetName.toLowerCase()) {
        f.eleve.classe = 'Non assignée';
        f.updatedAt = new Date().toISOString();
        f.historique = f.historique || [];
        f.historique.push({
          date: new Date().toISOString(),
          action: `Classe supprimée ("${targetName}") ➔ Élève basculé en "Non assignée"`,
        });
        affectedCount++;
      }
    });
    if (affectedCount > 0) {
      saveFiches(fiches);
    }

    res.json({
      success: true,
      classes: updated,
      affectedStudents: affectedCount,
      message: `Classe "${targetName}" supprimée avec succès (${affectedCount} élève(s) basculé(s) en "Non assignée").`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Rename class routes
app.post('/api/classes/rename', (req, res) => {
  const { oldName, newName } = req.body;
  performClassRename(oldName, newName, res);
});

app.put('/api/classes/:name', (req, res) => {
  const oldName = decodeURIComponent(req.params.name);
  const { newName } = req.body;
  performClassRename(oldName, newName, res);
});

// Delete class routes
app.post('/api/classes/delete', (req, res) => {
  const { name } = req.body;
  performClassDelete(name, res);
});

app.delete('/api/classes/:name', (req, res) => {
  const targetName = decodeURIComponent(req.params.name);
  performClassDelete(targetName, res);
});

// Modify single student's class
app.patch('/api/fiches/:id/classe', (req, res) => {
  try {
    const { classe } = req.body;
    if (!classe || typeof classe !== 'string' || !classe.trim()) {
      return res.status(400).json({ success: false, error: 'La nouvelle classe est obligatoire.' });
    }
    const trimmed = classe.trim();
    const fiches = getFiches();
    const fiche = fiches.find((f) => f.id === req.params.id);
    if (!fiche) {
      return res.status(404).json({ success: false, error: 'Fiche introuvable.' });
    }
    const prev = fiche.eleve?.classe || '-';
    if (!fiche.eleve) {
      fiche.eleve = {} as any;
    }
    fiche.eleve.classe = trimmed;
    fiche.updatedAt = new Date().toISOString();
    fiche.historique = fiche.historique || [];
    fiche.historique.push({
      date: new Date().toISOString(),
      action: `Modification de la classe de l'élève : "${prev}" ➔ "${trimmed}"`,
    });
    saveFiches(fiches);
    res.json({
      success: true,
      data: fiche,
      message: `Classe de l'élève mise à jour vers "${trimmed}".`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List all fiches
app.get('/api/fiches', (req, res) => {
  const fiches = getFiches();
  res.json({ success: true, count: fiches.length, data: fiches });
});

// Get single fiche
app.get('/api/fiches/:id', (req, res) => {
  const fiches = getFiches();
  const fiche = fiches.find((f) => f.id === req.params.id);
  if (!fiche) {
    return res.status(404).json({ success: false, error: 'Fiche non trouvée' });
  }
  res.json({ success: true, data: fiche });
});

// Save or submit fiche
app.post('/api/fiches', async (req, res) => {
  try {
    const payload = req.body;
    const { pdfFicheBase64, pdfCarnetBase64, ...formData } = payload;

    const fiches = getFiches();
    const id = formData.id || `fiche-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();

    const existingIndex = fiches.findIndex((f) => f.id === id);

    let currentFiche = existingIndex >= 0 ? fiches[existingIndex] : null;

    // Un parent ne peut créer que SES fiches et ne peut modifier que les fiches rattachées à son compte
    const auth = (req as any).auth as SessionInfo;
    if (auth.role === 'parent' && currentFiche && currentFiche.parentId !== auth.id) {
      console.warn(`[securite] Parent ${auth.label} : tentative de modification de la fiche ${id} d'un autre compte (refusée)`);
      return res.status(403).json({ success: false, error: "Cette fiche n'est pas rattachée à votre compte." });
    }
    const owner =
      auth.role === 'parent'
        ? { parentId: auth.id, parentEmail: auth.label }
        : { parentId: currentFiche?.parentId, parentEmail: currentFiche?.parentEmail };

    const isSigned = !!formData.autorisationParentale?.signatureDataUrl;

    const updatedFiche = {
      ...formData,
      ...owner,
      id,
      status: isSigned ? 'signee' : (formData.status || 'brouillon'),
      createdAt: currentFiche?.createdAt || now,
      updatedAt: now,
      historique: currentFiche?.historique || [
        { date: now, action: 'Création du formulaire' },
      ],
    };

    if (isSigned) {
      updatedFiche.historique.push({
        date: now,
        action: `Signature électronique par ${formData.autorisationParentale.signataireNomComplet || formData.responsableLegal?.nom}`,
      });

      // Synchronize with Nextcloud
      const syncResult = await syncToNextcloud(updatedFiche, pdfFicheBase64, pdfCarnetBase64);

      const nom = (updatedFiche.eleve?.nom || 'NOM').toUpperCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const prenom = (updatedFiche.eleve?.prenom || 'Prenom').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const schoolYear = updatedFiche.schoolYear || '2026-2027';

      updatedFiche.nextcloud = {
        status: syncResult.success ? 'transmis' : 'erreur',
        dossierCible: syncResult.folder,
        fichierFicheNom: `${nom}_${prenom}_Fiche_infirmerie_${schoolYear}.pdf`,
        fichierCarnetNom: `${nom}_${prenom}_Carnet_vaccinations_${schoolYear}.pdf`,
        derniereTentative: now,
        messageErreur: syncResult.success ? undefined : syncResult.message,
        retryCount: (currentFiche?.nextcloud?.retryCount || 0) + (syncResult.success ? 0 : 1),
      };

      updatedFiche.status = 'transmise_nextcloud';

      updatedFiche.historique.push({
        date: now,
        action: `Archivage local sécurisé réussi sur le serveur (${syncResult.folder})`,
      });
    }

    if (existingIndex >= 0) {
      fiches[existingIndex] = updatedFiche;
    } else {
      fiches.unshift(updatedFiche);
    }

    saveFiches(fiches);

    res.json({
      success: true,
      data: updatedFiche,
      message: 'Fiche enregistrée avec succès',
    });
  } catch (err: any) {
    console.error('Error saving fiche:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Retry Nextcloud transmission for a fiche
app.post('/api/fiches/:id/retry-sync', async (req, res) => {
  try {
    const fiches = getFiches();
    const fiche = fiches.find((f) => f.id === req.params.id);
    if (!fiche) {
      return res.status(404).json({ success: false, error: 'Fiche non trouvée' });
    }

    const { pdfFicheBase64, pdfCarnetBase64 } = req.body;
    const now = new Date().toISOString();

    const syncResult = await syncToNextcloud(fiche, pdfFicheBase64, pdfCarnetBase64);

    fiche.nextcloud = {
      ...fiche.nextcloud,
      status: syncResult.success ? 'transmis' : 'erreur',
      derniereTentative: now,
      messageErreur: syncResult.success ? undefined : syncResult.message,
      retryCount: (fiche.nextcloud?.retryCount || 0) + 1,
    };

    fiche.status = syncResult.success ? 'transmise_nextcloud' : 'erreur_transmission';
    fiche.updatedAt = now;
    fiche.historique.push({
      date: now,
      action: syncResult.success
        ? `Nouvelle tentative Nextcloud réussie (${syncResult.folder})`
        : `Échec nouvelle tentative Nextcloud : ${syncResult.message}`,
    });

    saveFiches(fiches);

    res.json({
      success: true,
      fiche,
      message: syncResult.success ? 'Synchronisation Nextcloud réussie !' : syncResult.message,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete single fiche
app.delete('/api/fiches/:id', (req, res) => {
  try {
    const fiches = getFiches();
    const index = fiches.findIndex((f) => f.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Fiche non trouvée' });
    }
    const removed = fiches.splice(index, 1)[0];
    saveFiches(fiches);
    res.json({ success: true, message: `Fiche de ${removed.eleve?.nom || ''} supprimée avec succès.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Purge all fiches
app.post('/api/fiches/purge', (req, res) => {
  try {
    saveFiches([]);
    res.json({ success: true, message: 'Toutes les fiches infirmerie ont été purgées avec succès.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// --- AUTHENTICATION API ROUTES (PARENTS & ADMIN - 100% CRYPTÉES) ---
// ============================================================================

// 1. Parent Registration
app.post('/api/auth/parent/register', (req, res) => {
  try {
    const { nom, prenom, email, telephone, password, secretQuestion, secretAnswer } = req.body;

    if (!nom || !prenom || !email || !telephone || !password || !secretAnswer) {
      return res.status(400).json({ success: false, error: 'Tous les champs obligatoires doivent être renseignés.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'Adresse email invalide.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter au moins 6 caractères.' });
    }

    const store = getAccounts();
    const existing = store.parents.find((p) => p.email === cleanEmail);
    if (existing) {
      return res.status(409).json({ success: false, error: "Un compte parent existe déjà avec cette adresse email (le compte est commun à la Fiche Sanitaire et à la Fiche Infirmerie) : connectez-vous avec le même mot de passe, ou utilisez « Mot de passe oublié »." });
    }

    const { hash, salt } = hashPassword(password);
    const secretAnswerHash = hashSecretAnswer(secretAnswer, salt);

    const newParent: ParentAccount = {
      id: `parent-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      email: cleanEmail,
      nom: nom.trim().toUpperCase(),
      prenom: prenom.trim(),
      telephone: telephone.trim(),
      hash,
      salt,
      secretQuestion: secretQuestion || 'Quel est le nom de votre premier animal de compagnie ?',
      secretAnswerHash,
      createdAt: new Date().toISOString(),
    };

    store.parents.push(newParent);
    saveAccounts(store);

    res.json({
      success: true,
      token: createSession('parent', newParent.id, newParent.email),
      parent: {
        id: newParent.id,
        email: newParent.email,
        nom: newParent.nom,
        prenom: newParent.prenom,
        telephone: newParent.telephone,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Parent Login
app.post('/api/auth/parent/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
    }

    const locked = isLocked(req);
    if (locked) {
      return res.status(429).json({ success: false, error: `Trop d'essais infructueux. Réessayez dans ${locked} min.` });
    }

    const cleanEmail = email.trim().toLowerCase();
    const store = getAccounts();
    const parent = store.parents.find((p) => p.email === cleanEmail);

    if (!parent) {
      recordFailure(req);
      return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect.' });
    }

    const isValid = verifyParentPassword(parent, password);
    if (!isValid) {
      recordFailure(req);
      return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect.' });
    }
    clearFailures(req);

    res.json({
      success: true,
      token: createSession('parent', parent.id, parent.email),
      parent: {
        id: parent.id,
        email: parent.email,
        nom: parent.nom,
        prenom: parent.prenom,
        telephone: parent.telephone,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Parent Forgot Password - Retrieve Secret Question
app.post('/api/auth/parent/forgot-password/question', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Adresse email requise.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const store = getAccounts();
    const parent = store.parents.find((p) => p.email === cleanEmail);

    if (!parent) {
      return res.status(404).json({ success: false, error: 'Aucun compte parent associé à cette adresse email.' });
    }

    res.json({
      success: true,
      secretQuestion: parent.secretQuestion,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Parent Forgot Password - Reset with Secret Answer
app.post('/api/auth/parent/forgot-password/reset', (req, res) => {
  try {
    const { email, secretAnswer, newPassword } = req.body;
    if (!email || !secretAnswer || !newPassword) {
      return res.status(400).json({ success: false, error: 'Tous les champs sont requis.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const store = getAccounts();
    const parent = store.parents.find((p) => p.email === cleanEmail);

    if (!parent) {
      return res.status(404).json({ success: false, error: 'Compte introuvable.' });
    }

    const locked = isLocked(req);
    if (locked) {
      return res.status(429).json({ success: false, error: `Trop d'essais infructueux. Réessayez dans ${locked} min.` });
    }
    if (!verifyParentAnswer(parent, secretAnswer)) {
      recordFailure(req);
      return res.status(401).json({ success: false, error: 'La réponse à la question secrète est incorrecte.' });
    }
    clearFailures(req);

    // Reset password with fresh salt
    const { hash, salt } = hashPassword(newPassword);
    parent.hash = hash;
    parent.salt = salt;
    // Re-hash the secret answer with the new salt so it stays valid
    parent.secretAnswerHash = hashSecretAnswer(secretAnswer, salt);

    saveAccounts(store);

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Staff / Admin Login (Supports 'admin' and 'infirmerie')
app.post('/api/auth/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Identifiant et mot de passe requis.' });
    }

    const locked = isLocked(req);
    if (locked) {
      return res.status(429).json({ success: false, error: `Trop d'essais infructueux. Réessayez dans ${locked} min.` });
    }

    const store = getAccounts();
    const cleanUsername = username.trim().toLowerCase();

    const staffMember = store.staff.find((s) => s.username.toLowerCase() === cleanUsername);

    if (!staffMember) {
      recordFailure(req);
      return res.status(401).json({ success: false, error: 'Identifiant ou mot de passe incorrect.' });
    }

    // Seul le mot de passe enregistré (empreinte PBKDF2) est accepté : plus aucun mot de passe codé en dur
    const isValid = verifyPassword(password, staffMember.hash, staffMember.salt);
    if (!isValid) {
      recordFailure(req);
      return res.status(401).json({ success: false, error: 'Identifiant ou mot de passe incorrect.' });
    }
    clearFailures(req);
    const token = createSession('staff', staffMember.username, staffMember.label);
    console.log(`[securite] Connexion personnel : ${staffMember.username} (${req.ip})`);

    res.json({
      success: true,
      token,
      mustChangePassword: verifyPassword(DEFAULT_STAFF_PASSWORD, staffMember.hash, staffMember.salt),
      admin: {
        username: staffMember.username,
        label: staffMember.label,
        role: staffMember.username,
      },
      message: `Session "${staffMember.label}" connectée avec succès.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Staff / Admin Change Password (for either 'admin' or 'infirmerie')
app.post('/api/auth/admin/change-password', (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Identifiant, mot de passe actuel et nouveau mot de passe requis.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' });
    }

    const store = getAccounts();
    const cleanUsername = username.trim().toLowerCase();
    const staffMember = store.staff.find((s) => s.username.toLowerCase() === cleanUsername);

    if (!staffMember) {
      return res.status(404).json({ success: false, error: `Session "${username}" introuvable.` });
    }

    // Un compte ne peut modifier que son propre mot de passe (sauf la direction « admin »)
    const auth = (req as any).auth as SessionInfo | undefined;
    if (!auth || auth.role !== 'staff' || (auth.id.toLowerCase() !== cleanUsername && auth.id.toLowerCase() !== 'admin')) {
      return res.status(403).json({ success: false, error: 'Vous ne pouvez modifier que le mot de passe de votre propre session.' });
    }

    const isValid = verifyPassword(currentPassword, staffMember.hash, staffMember.salt);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Le mot de passe actuel est incorrect.' });
    }

    const { hash, salt } = hashPassword(newPassword);
    staffMember.hash = hash;
    staffMember.salt = salt;
    staffMember.updatedAt = new Date().toISOString();

    // Synchronize legacy store.admin if admin modified
    if (staffMember.username === 'admin') {
      store.admin = {
        username: 'admin',
        hash,
        salt,
        updatedAt: staffMember.updatedAt,
      };
    }

    saveAccounts(store);

    res.json({
      success: true,
      message: `Mot de passe du compte "${staffMember.label}" modifié avec succès.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Security Status
app.get('/api/auth/status', (req, res) => {
  res.json({
    success: true,
    encryption: {
      enabled: true,
      algorithm: 'AES-256-GCM',
      keyLength: 256,
      storageMode: 'Local Encrypted Vault (Zero Client Storage)',
      files: ['fiches.enc', 'accounts.enc', 'draft.enc'],
    },
  });
});

// 7bis. GESTION CENTRALISÉE (portail NDM uniquement — routes /api/internal/*)
app.get('/api/internal/accounts', (req, res) => {
  try {
    const store = getAccounts();
    res.json({
      success: true,
      staff: store.staff.map((s) => ({
        username: s.username,
        label: s.label,
        updatedAt: s.updatedAt,
        motDePasseInitial: verifyPassword(DEFAULT_STAFF_PASSWORD, s.hash, s.salt),
      })),
      parents: store.parents.map((p) => ({
        id: p.id,
        email: p.email,
        nom: p.nom,
        prenom: p.prenom,
        telephone: p.telephone,
        createdAt: p.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/internal/set-password', (req, res) => {
  try {
    const { kind, id, password } = req.body || {};
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter au moins 8 caractères.' });
    }
    const store = getAccounts();
    const { hash, salt } = hashPassword(password);
    if (kind === 'staff') {
      const s = store.staff.find((x) => x.username.toLowerCase() === String(id || '').toLowerCase());
      if (!s) return res.status(404).json({ success: false, error: 'Compte du personnel introuvable.' });
      s.hash = hash;
      s.salt = salt;
      s.updatedAt = new Date().toISOString();
      if (s.username === 'admin') store.admin = { username: 'admin', hash, salt, updatedAt: s.updatedAt };
      saveAccounts(store);
      revokeSessionsOf('staff', s.username);
      console.log(`[securite] Mot de passe du compte personnel « ${s.username} » redéfini par le portail NDM`);
      return res.json({ success: true, message: `Mot de passe de « ${s.label} » modifié.` });
    }
    if (kind === 'parent') {
      const p = store.parents.find((x) => x.id === id);
      if (!p) return res.status(404).json({ success: false, error: 'Compte parent introuvable.' });
      // La réponse secrète est hachée avec le sel du mot de passe : elle est conservée telle quelle
      // en réutilisant l'ancien sel pour le nouveau mot de passe.
      const sel = p.salt || crypto.randomBytes(16).toString('hex');
      p.hash = hashPassword(password, sel).hash;
      p.salt = sel;
      saveAccounts(store);
      revokeSessionsOf('parent', p.id);
      console.log(`[securite] Mot de passe du parent « ${p.email} » redéfini par le portail NDM`);
      return res.json({ success: true, email: p.email, message: `Mot de passe de ${p.prenom} ${p.nom} (${p.email}) modifié.` });
    }
    return res.status(400).json({ success: false, error: 'Type de compte inconnu.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7ter. COMPTES PARENTS COMMUNS (synchronisation orchestrée par le portail NDM)
app.get('/api/internal/parents', (req, res) => {
  const store = getAccounts();
  res.json({
    parents: store.parents.map((p) => ({
      email: String(p.email || '').trim().toLowerCase(),
      nom: p.nom,
      prenom: p.prenom,
      telephone: p.telephone,
      passwordHash: portablePassword(p),
      secretQuestion: p.secretQuestion,
      secretAnswerHash: portableAnswer(p),
    })),
  });
});

app.post('/api/internal/parents/import', (req, res) => {
  const { parent: src, mode } = req.body || {};
  if (!src || !src.email || !src.passwordHash) return res.status(400).json({ success: false, error: 'parent invalide' });
  const email = String(src.email).trim().toLowerCase();
  pingSuspendu = true; // une importation venant du portail ne relance pas une synchronisation
  try {
    const store = getAccounts();
    const existant = store.parents.find((p) => p.email === email);
    if (mode === 'create') {
      if (existant) return res.status(409).json({ success: false, error: 'email-exists' });
      store.parents.push({
        id: `parent-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        email,
        nom: String(src.nom || '').trim().toUpperCase() || email,
        prenom: String(src.prenom || '').trim(),
        telephone: String(src.telephone || '').trim(),
        hash: String(src.passwordHash),
        salt: crypto.randomBytes(16).toString('hex'),
        secretQuestion: src.secretQuestion || 'Quel est le nom de votre premier animal de compagnie ?',
        secretAnswerHash: src.secretAnswerHash ? String(src.secretAnswerHash) : '',
        createdAt: new Date().toISOString(),
      } as ParentAccount);
      saveAccounts(store);
      console.log(`[parents-communs] compte parent ${email} créé depuis la Fiche Sanitaire`);
      return res.json({ success: true });
    }
    if (mode === 'password') {
      if (!existant) return res.status(404).json({ success: false, error: 'no-account' });
      existant.hash = String(src.passwordHash);
      if (src.secretAnswerHash) {
        existant.secretAnswerHash = String(src.secretAnswerHash);
        if (src.secretQuestion) existant.secretQuestion = src.secretQuestion;
      }
      saveAccounts(store);
      revokeSessionsOf('parent', existant.id);
      console.log(`[parents-communs] mot de passe du parent ${email} aligné sur la Fiche Sanitaire`);
      return res.json({ success: true });
    }
    return res.status(400).json({ success: false, error: 'mode invalide' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    pingSuspendu = false;
  }
});

// 8. Déconnexion : le jeton est détruit côté serveur
app.post('/api/auth/logout', (req, res) => {
  for (const t of [headerValue(req, 'x-staff-token'), headerValue(req, 'x-parent-token')]) {
    if (t) sessions.delete(t);
  }
  res.json({ success: true });
});

// (Les routes du cahier des charges RGPD sont plus bas : GET /api/rgpd/cahier-des-charges renvoie
//  { markdown, config } au format JSON attendu par l'écran « Conformité RGPD ».)

// 100% Server Draft Storage - AES-256 Encrypted, nothing stored in client cache or localStorage
// Un brouillon PAR COMPTE (data/drafts/<empreinte du compte>.enc) : un parent ne voit jamais le brouillon d'un autre.
const DRAFTS_DIR = path.join(DATA_DIR, 'drafts');
fs.mkdirSync(DRAFTS_DIR, { recursive: true });
// L'ancien brouillon unique (partagé entre tous les visiteurs) est supprimé : il exposait les données du dernier saisi
for (const legacy of [DRAFT_ENC_FILE, DRAFT_FILE]) {
  try {
    if (fs.existsSync(legacy)) {
      fs.unlinkSync(legacy);
      console.log('[securite] Ancien brouillon partagé supprimé :', path.basename(legacy));
    }
  } catch {}
}

function draftFileFor(req: express.Request): string {
  const auth = (req as any).auth as SessionInfo;
  const key = crypto.createHash('sha256').update(`${auth.role}:${auth.id}`).digest('hex');
  return path.join(DRAFTS_DIR, `${key}.enc`);
}

app.get('/api/draft', (req, res) => {
  try {
    const file = draftFileFor(req);
    if (fs.existsSync(file)) {
      const draft = decryptData(fs.readFileSync(file, 'utf-8'));
      return res.json({ success: true, draft });
    }
    res.json({ success: true, draft: null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/draft', (req, res) => {
  try {
    const enc = encryptData(req.body);
    fs.writeFileSync(draftFileFor(req), enc, 'utf-8');
    res.json({ success: true, message: 'Brouillon crypté sauvegardé sur le serveur' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/draft', (req, res) => {
  try {
    const file = draftFileFor(req);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    res.json({ success: true, message: 'Brouillon supprimé du serveur' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Seed & Reset endpoint fulfilling all specs from cahier des charges
app.post('/api/seed', (req, res) => {
  try {
    if (fs.existsSync(FICHES_FILE)) {
      fs.unlinkSync(FICHES_FILE);
    }
    initializeFiches();
    res.json({ success: true, message: 'Données réinitialisées avec succès selon le cahier des charges.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Tree browser for local server archives:
// FICHES INFIRMERIE -> 2026-2027 -> 6A, 6B, etc. -> files
app.get('/api/nextcloud/tree', (req, res) => {
  function readFolderTree(dirPath: string, relativePath = ''): any {
    if (!fs.existsSync(dirPath)) return [];

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      const rel = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        return {
          name: entry.name,
          path: rel,
          type: 'folder',
          children: readFolderTree(fullPath, rel),
        };
      } else {
        const stats = fs.statSync(fullPath);
        return {
          name: entry.name,
          path: rel,
          type: 'file',
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
        };
      }
    });
  }

  const rootFolder = 'FICHES INFIRMERIE';
  let rootPath = path.join(ARCHIVES_DIR, rootFolder);
  if (!fs.existsSync(rootPath)) {
    rootPath = path.join(NEXTCLOUD_STORAGE_DIR, rootFolder);
  }
  if (!fs.existsSync(rootPath)) {
    fs.mkdirSync(rootPath, { recursive: true });
  }

  const tree = {
    name: rootFolder,
    path: rootFolder,
    type: 'folder',
    children: readFolderTree(rootPath, rootFolder),
  };

  res.json({
    success: true,
    storageType: 'local_server',
    storagePath: path.join(ARCHIVES_DIR, rootFolder),
    tree,
  });
});

app.get('/api/archives/tree', (req, res) => {
  res.redirect('/api/nextcloud/tree');
});

// Nextcloud config endpoint
app.get('/api/nextcloud/config', (req, res) => {
  res.json({
    success: true,
    data: {
      url: nextcloudConfig.url,
      username: nextcloudConfig.username,
      rootFolder: nextcloudConfig.rootFolder,
      enabled: nextcloudConfig.enabled,
      isCustomConfigured: nextcloudConfig.isCustomConfigured,
    },
  });
});

app.post('/api/nextcloud/config', async (req, res) => {
  const { url, username, appPassword, rootFolder, testConnection } = req.body;

  nextcloudConfig = {
    url: url || '',
    username: username || '',
    appPassword: appPassword !== undefined ? appPassword : nextcloudConfig.appPassword,
    rootFolder: rootFolder || 'FICHES INFIRMERIE',
    enabled: true,
    isCustomConfigured: !!(url && username),
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(nextcloudConfig, null, 2), 'utf-8');

  let testResult: { success: boolean; message: string } = {
    success: true,
    message: 'Configuration sauvegardée. Mode miroir local actif.',
  };

  if (testConnection && nextcloudConfig.isCustomConfigured && nextcloudConfig.appPassword) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${nextcloudConfig.username}:${nextcloudConfig.appPassword}`).toString('base64');
      const response = await fetch(nextcloudConfig.url, {
        method: 'PROPFIND',
        headers: {
          Authorization: authHeader,
          Depth: '0',
        },
      });

      if (response.ok || response.status === 207) {
        testResult = {
          success: true,
          message: 'Connexion WebDAV Nextcloud vérifiée avec succès !',
        };
      } else {
        testResult = {
          success: false,
          message: `Le serveur a répondu avec le code HTTP ${response.status} (${response.statusText})`,
        };
      }
    } catch (e: any) {
      testResult = {
        success: false,
        message: `Impossible de joindre le serveur : ${e.message}`,
      };
    }
  }

  res.json({ success: true, config: nextcloudConfig, testResult });
});

// Download physical file from local server archives
app.get('/api/download-file', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).send('Chemin manquant');
  }

  // Prevent path traversal : le fichier doit rester DANS les dossiers d'archives
  let absolutePath = safeResolve(ARCHIVES_DIR, filePath);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    absolutePath = safeResolve(NEXTCLOUD_STORAGE_DIR, filePath);
  }

  if (!absolutePath || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return res.status(404).send('Fichier introuvable sur le serveur');
  }

  res.download(absolutePath);
});

// Purge all generated archive files and folders on server
app.post('/api/archives/purge', (req, res) => {
  try {
    const rootFolder = 'FICHES INFIRMERIE';
    const p1 = path.join(ARCHIVES_DIR, rootFolder);
    const p2 = path.join(NEXTCLOUD_STORAGE_DIR, rootFolder);

    if (fs.existsSync(p1)) {
      fs.rmSync(p1, { recursive: true, force: true });
      fs.mkdirSync(p1, { recursive: true });
    }
    if (fs.existsSync(p2)) {
      fs.rmSync(p2, { recursive: true, force: true });
      fs.mkdirSync(p2, { recursive: true });
    }

    res.json({ success: true, message: 'Tous les fichiers PDF archivés ont été purgés du serveur avec succès.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a single archive file
app.delete('/api/archives/file', (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Chemin manquant' });
    }

    const p1 = safeResolve(ARCHIVES_DIR, filePath);
    const p2 = safeResolve(NEXTCLOUD_STORAGE_DIR, filePath);

    let deleted = false;
    if (p1 && fs.existsSync(p1) && fs.statSync(p1).isFile()) {
      fs.unlinkSync(p1);
      deleted = true;
    }
    if (p2 && fs.existsSync(p2) && fs.statSync(p2).isFile()) {
      fs.unlinkSync(p2);
      deleted = true;
    }

    if (deleted) {
      res.json({ success: true, message: 'Fichier supprimé avec succès.' });
    } else {
      res.status(404).json({ success: false, error: 'Fichier introuvable sur le serveur.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stats for dashboard
app.get('/api/stats', (req, res) => {
  const fiches = getFiches();
  const total = fiches.length;
  const transmises = fiches.filter((f) => f.status === 'transmise_nextcloud').length;
  const erreurs = fiches.filter((f) => f.status === 'erreur_transmission').length;
  const signees = fiches.filter((f) => f.status === 'signee' || f.status === 'transmise_nextcloud').length;
  const carnetComplets = fiches.filter((f) => f.sante?.carnetVaccinations?.length > 0).length;

  res.json({
    success: true,
    stats: {
      total,
      transmises,
      erreurs,
      signees,
      carnetComplets,
    },
  });
});

// Serve RGPD specifications document
app.get('/CAHIER_DES_CHARGES_RGPD.md', (req, res) => {
  // Le nom de l'établissement est inséré à la volée (variable {{ETABLISSEMENT}})
  for (const f of CAHIER_FILES()) {
    if (fs.existsSync(f)) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(renderCahier(fs.readFileSync(f, 'utf-8')));
    }
  }
  res.status(404).send('Document introuvable');
});

const RGPD_CONFIG_PATH = path.join(process.cwd(), 'data', 'rgpd_config.json');

app.get('/api/rgpd/cahier-des-charges', (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'CAHIER_DES_CHARGES_RGPD.md');
    let markdown = '';
    if (fs.existsSync(filePath)) {
      markdown = fs.readFileSync(filePath, 'utf-8');
    } else {
      const publicPath = path.join(process.cwd(), 'public', 'CAHIER_DES_CHARGES_RGPD.md');
      if (fs.existsSync(publicPath)) {
        markdown = fs.readFileSync(publicPath, 'utf-8');
      }
    }

    let config = null;
    if (fs.existsSync(RGPD_CONFIG_PATH)) {
      try {
        config = JSON.parse(fs.readFileSync(RGPD_CONFIG_PATH, 'utf-8'));
      } catch (err) {
        console.error('Error reading rgpd_config.json:', err);
      }
    }

    // Nom de l'établissement : toujours celui de l'identité enregistrée (gestion centralisée)
    if (config && typeof config === 'object') (config as any).etablissement = getSchoolBranding().schoolName;
    return res.json({ success: true, markdown: renderCahier(markdown), config });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/rgpd/cahier-des-charges', (req, res) => {
  try {
    const { markdown, config } = req.body;
    if (typeof markdown !== 'string') {
      return res.status(400).json({ success: false, error: 'Markdown invalide' });
    }

    const filePath = path.join(process.cwd(), 'CAHIER_DES_CHARGES_RGPD.md');
    const publicPath = path.join(process.cwd(), 'public', 'CAHIER_DES_CHARGES_RGPD.md');

    fs.writeFileSync(filePath, markdown, 'utf-8');
    try {
      fs.writeFileSync(publicPath, markdown, 'utf-8');
    } catch {}

    if (config && typeof config === 'object') {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(RGPD_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    }

    return res.json({ success: true, message: 'Cahier des charges RGPD mis à jour avec succès' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/rgpd/cahier-des-charges/reset', (req, res) => {
  try {
    const defaultPath = path.join(process.cwd(), 'CAHIER_DES_CHARGES_RGPD_DEFAULT.md');
    if (!fs.existsSync(defaultPath)) {
      return res.status(404).json({ success: false, error: 'Modèle par défaut introuvable' });
    }

    const defaultContent = fs.readFileSync(defaultPath, 'utf-8');
    const filePath = path.join(process.cwd(), 'CAHIER_DES_CHARGES_RGPD.md');
    const publicPath = path.join(process.cwd(), 'public', 'CAHIER_DES_CHARGES_RGPD.md');

    fs.writeFileSync(filePath, defaultContent, 'utf-8');
    try {
      fs.writeFileSync(publicPath, defaultContent, 'utf-8');
    } catch {}

    // Reset config file if present
    if (fs.existsSync(RGPD_CONFIG_PATH)) {
      try {
        fs.unlinkSync(RGPD_CONFIG_PATH);
      } catch {}
    }

    return res.json({ success: true, markdown: renderCahier(defaultContent), message: 'Réinitialisation au modèle officiel effectuée' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Vite dev middleware vs production static handler
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
