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
      return { message: `Mot de passe de ${u.name || u.email} (${u.email}) modifié dans la Fiche Sanitaire.`, parentEmail: u.role === 'parent' ? String(u.email || '').trim().toLowerCase() : null, source: 'fichesanitaire' };
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
    return { message: r.message || 'Mot de passe modifié dans la Fiche Infirmerie.', parentEmail: type === 'parent' ? r.email || null : null, source: 'infirmerie' };
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
