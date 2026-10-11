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
