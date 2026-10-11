// ============================================================================
//  Portail NDM — COMPTES PARENTS COMMUNS Fiche Sanitaire <-> Fiche Infirmerie
//  (build parents-communs-20261011)
//
//  Un parent = UNE adresse e-mail = UN compte valable dans les deux applications.
//  - Compte présent d'un seul côté                 -> créé de l'autre côté (identité + empreintes)
//  - Mot de passe changé d'un côté                 -> recopié de l'autre côté
//  - Mots de passe différents des deux côtés sans
//    historique commun (comptes créés séparément)  -> CONFLIT signalé dans la console centrale
//  - Compte supprimé d'un côté après synchronisation -> NON recréé (suppression respectée)
//  Aucune donnée en clair : seules les empreintes (formats compris par les deux applications) circulent,
//  sur le réseau Docker interne. État de synchronisation : table portail_parents_sync (empreinte SHA-256
//  de l'empreinte commune, jamais l'empreinte elle-même).
//  Déclenchement : signal des applications à chaque modification de comptes (1,5 s), toutes les 5 min,
//  bouton « Synchroniser maintenant » de la console centrale.
// ============================================================================
const crypto = require('crypto');

const SECRET = process.env.NDM_INTERNAL_SECRET || '';
const FS_URL = process.env.INTERNAL_URL_FICHESANITAIRE || 'http://fichesanitaire:3000';
const INF_URL = process.env.INTERNAL_URL_INFIRMERIE || 'http://infirmerie:3001';

const fp = (h) => (h ? crypto.createHash('sha256').update(String(h)).digest('hex') : null);

async function api(base, header, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', [header]: SECRET },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  let data = null;
  try { data = await res.json(); } catch { /* vide */ }
  if (!res.ok) throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
  return data;
}
const fsApi = (m, p, b) => api(FS_URL, 'X-Local-Tool', m, p, b);
const infApi = (m, p, b) => api(INF_URL, 'X-Ndm-Internal', m, p, b);

async function migrate(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS portail_parents_sync (
      email       VARCHAR(200) PRIMARY KEY,
      last_fp     VARCHAR(64),
      in_fs       BOOLEAN NOT NULL DEFAULT FALSE,
      in_inf      BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

let enCours = null;
let relancer = false;
let dernier = { date: null, rapport: null, erreur: null };

/**
 * Synchronise les comptes parents. prefer = { email, source: 'fichesanitaire'|'infirmerie' } force
 * l'alignement d'un compte en conflit sur l'application choisie.
 */
async function synchroniser(db, prefer) {
  if (enCours) {
    if (!prefer) { relancer = true; return enCours; }
    await enCours.catch(() => {});
  }
  enCours = (async () => {
    const rapport = { creesFs: [], creesInf: [], alignesFs: [], alignesInf: [], conflits: [], ignores: [], communs: 0, synchronises: 0, totalFs: 0, totalInf: 0 };
    try {
      if (!SECRET || SECRET.length < 24) throw new Error('NDM_INTERNAL_SECRET absent du .env');
      const [fsRes, infRes, st] = await Promise.all([
        fsApi('GET', '/api/internal/parents'),
        infApi('GET', '/api/internal/parents'),
        db.query('SELECT * FROM portail_parents_sync'),
      ]);
      const fsMap = new Map((fsRes.parents || []).filter((p) => p.email).map((p) => [p.email, p]));
      const infMap = new Map((infRes.parents || []).filter((p) => p.email).map((p) => [p.email, p]));
      const etat = new Map(st.rows.map((r) => [r.email, r]));
      rapport.totalFs = fsMap.size;
      rapport.totalInf = infMap.size;

      const save = (email, lastFp, inFs, inInf) =>
        db.query(
          `INSERT INTO portail_parents_sync (email, last_fp, in_fs, in_inf, updated_at) VALUES ($1,$2,$3,$4,NOW())
           ON CONFLICT (email) DO UPDATE SET last_fp=$2, in_fs=$3, in_inf=$4, updated_at=NOW()`,
          [email, lastFp, inFs, inInf]
        );

      const emails = new Set([...fsMap.keys(), ...infMap.keys()]);
      for (const email of emails) {
        const a = fsMap.get(email);
        const b = infMap.get(email);
        const s = etat.get(email);
        try {
          if (a && b) {
            rapport.communs++;
            const fa = fp(a.passwordHash);
            const fb = fp(b.passwordHash);
            if (!fa || !fb) { rapport.ignores.push({ email, raison: 'mot de passe ancien format (synchronisé après la prochaine connexion)' }); continue; }
            if (fa === fb) { rapport.synchronises++; if (!s || s.last_fp !== fa || !s.in_fs || !s.in_inf) await save(email, fa, true, true); continue; }
            let source = null;
            if (prefer && prefer.email === email) source = prefer.source;
            else if (s && s.last_fp === fb) source = 'fichesanitaire'; // l'Infirmerie n'a pas bougé : la Fiche Sanitaire a changé
            else if (s && s.last_fp === fa) source = 'infirmerie';
            if (!source) { rapport.conflits.push({ email, nom: `${b.prenom || a.prenom || ''} ${b.nom || a.nom || ''}`.trim() }); continue; }
            if (source === 'fichesanitaire') {
              await infApi('POST', '/api/internal/parents/import', { mode: 'password', parent: a });
              rapport.alignesInf.push(email);
              await save(email, fa, true, true);
            } else {
              await fsApi('POST', '/api/internal/parents/import', { mode: 'password', parent: b });
              rapport.alignesFs.push(email);
              await save(email, fb, true, true);
            }
            rapport.synchronises++;
          } else if (a && !b) {
            if (s && s.in_inf) { await save(email, s.last_fp, true, false); rapport.ignores.push({ email, raison: 'supprimé de la Fiche Infirmerie : non recréé' }); continue; }
            if (!a.passwordHash) { rapport.ignores.push({ email, raison: 'mot de passe ancien format' }); continue; }
            await infApi('POST', '/api/internal/parents/import', { mode: 'create', parent: a });
            rapport.creesInf.push(email);
            await save(email, fp(a.passwordHash), true, true);
          } else if (b && !a) {
            if (s && s.in_fs) { await save(email, s.last_fp, false, true); rapport.ignores.push({ email, raison: 'supprimé de la Fiche Sanitaire : non recréé' }); continue; }
            if (!b.passwordHash) { rapport.ignores.push({ email, raison: 'mot de passe absent' }); continue; }
            try {
              await fsApi('POST', '/api/internal/parents/import', { mode: 'create', parent: b });
            } catch (e) {
              if (/email-exists/.test(e.message)) { rapport.ignores.push({ email, raison: 'adresse déjà utilisée par un compte du personnel de la Fiche Sanitaire' }); continue; }
              throw e;
            }
            rapport.creesFs.push(email);
            await save(email, fp(b.passwordHash), true, true);
          }
        } catch (e) {
          rapport.ignores.push({ email, raison: 'erreur : ' + e.message });
        }
      }
      dernier = { date: new Date(), rapport, erreur: null };
      const n = rapport.creesFs.length + rapport.creesInf.length + rapport.alignesFs.length + rapport.alignesInf.length;
      if (n) console.log(`[parents-communs] ${rapport.creesInf.length} créé(s) Infirmerie, ${rapport.creesFs.length} créé(s) Fiche Sanitaire, ${rapport.alignesInf.length + rapport.alignesFs.length} mot(s) de passe aligné(s), ${rapport.conflits.length} conflit(s)`);
      return rapport;
    } catch (e) {
      dernier = { date: new Date(), rapport: null, erreur: e.message };
      throw e;
    }
  })();
  try {
    return await enCours;
  } finally {
    enCours = null;
    if (relancer) {
      relancer = false;
      setTimeout(() => synchroniser(db).catch(() => {}), 500);
    }
  }
}

function demarrer(db) {
  // 1re synchronisation 20 s après le démarrage (applications prêtes), puis toutes les 5 minutes
  setTimeout(() => synchroniser(db).catch((e) => console.error('[parents-communs]', e.message)), 20000);
  setInterval(() => synchroniser(db).catch((e) => console.error('[parents-communs]', e.message)), 5 * 60000).unref();
}

module.exports = { migrate, synchroniser, demarrer, etat: () => dernier };
