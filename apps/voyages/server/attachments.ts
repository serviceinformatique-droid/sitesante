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
