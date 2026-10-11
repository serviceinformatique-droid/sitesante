import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
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

  // Gestion centralisée : appel du portail NDM par le réseau Docker interne (secret partagé NDM_INTERNAL_SECRET ;
  // la passerelle nginx supprime l'en-tête X-Ndm-Internal de toute requête venant de l'extérieur)
  const isInternalCall = (req: Request): boolean => {
    const secret = process.env.NDM_INTERNAL_SECRET || '';
    const got = headerStr(req, 'x-ndm-internal') || '';
    if (secret.length < 24 || !got) return false;
    const a = crypto.createHash('sha256').update(secret).digest();
    const b = crypto.createHash('sha256').update(got).digest();
    return crypto.timingSafeEqual(a, b);
  };

  const rolesFromRequest = (req: Request): Set<string> => {
    const roles = new Set<string>();
    if (isInternalCall(req)) roles.add('admin');
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

  // Nom de l'établissement (public : affiché dans l'en-tête et le pied de page)
  app.get('/api/settings/public', (req: Request, res: Response) => {
    res.json({ success: true, etablissement: db.getEtablissement() });
  });

  // --- Gestion centralisée (portail NDM uniquement) ---
  app.post('/api/internal/set-admin-password', (req: Request, res: Response) => {
    if (!isInternalCall(req)) return res.status(403).json({ success: false, message: 'Réservé au portail NDM' });
    const pwd = String(req.body?.password || '').trim();
    if (pwd.length < 8) return res.status(400).json({ success: false, message: 'Au moins 8 caractères' });
    db.setAdminPassword(pwd);
    console.log('[securite] Mot de passe administrateur redéfini par le portail NDM');
    res.json({ success: true, message: 'Mot de passe administrateur modifié' });
  });

  app.post('/api/internal/etablissement', (req: Request, res: Response) => {
    if (!isInternalCall(req)) return res.status(403).json({ success: false, message: 'Réservé au portail NDM' });
    const nom = String(req.body?.nom || '').trim();
    if (nom.length < 3 || nom.length > 150) return res.status(400).json({ success: false, message: 'Nom invalide (3 à 150 caractères)' });
    const n = db.setEtablissement(nom);
    res.json({ success: true, message: `Nom de l'établissement mis à jour (${n} voyage(s) mis à jour)`, etablissement: nom });
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
