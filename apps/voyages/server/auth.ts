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
