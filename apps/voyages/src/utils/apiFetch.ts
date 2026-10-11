import { safeSession } from './storage.js';

/**
 * Ajoute automatiquement les jetons de session et les mots de passe de voyage déverrouillés
 * à tous les appels /api du portail (même origine). Le serveur vérifie ensuite les droits.
 */
export function installApiAuth(): void {
  if ((window as any).__ndmApiAuthInstalled) return;
  (window as any).__ndmApiAuthInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const isApi = url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`);
      if (isApi) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        const adminToken = safeSession.getItem('ndm_admin_token');
        const consultationToken = safeSession.getItem('ndm_consultation_token');
        if (adminToken) headers.set('x-admin-token', adminToken);
        else if (headers.get('x-admin-token') && !isRealToken(headers.get('x-admin-token'))) headers.delete('x-admin-token');
        if (consultationToken) headers.set('x-consultation-token', consultationToken);
        else if (headers.get('x-consultation-token') && !isRealToken(headers.get('x-consultation-token')))
          headers.delete('x-consultation-token');

        const unlocked = safeSession.getItem('ndm_unlocked_voyages');
        if (unlocked && !headers.has('x-voyage-passwords')) {
          headers.set('x-voyage-passwords', encodeURIComponent(unlocked));
        }
        return originalFetch(input, { ...init, headers, cache: 'no-store' });
      }
    } catch {
      /* en cas de souci, on laisse passer l'appel d'origine */
    }
    return originalFetch(input, init);
  };
}

function isRealToken(t: string | null): boolean {
  return Boolean(t && t.includes('.'));
}

/** URL du document signé, avec les droits nécessaires (le lien s'ouvre dans un nouvel onglet, sans en-têtes) */
export function documentUrl(inscriptionId: string, voyageId?: string): string {
  const qs = authQuery(voyageId);
  return `/api/inscriptions/${encodeURIComponent(inscriptionId)}/document${qs ? `?${qs}` : ''}`;
}

/** URL d'une pièce jointe stockée sur le serveur (index dans inscription.pieces_jointes) */
export function pieceUrl(inscriptionId: string, index: number, voyageId?: string, download = false): string {
  const params = new URLSearchParams(authQuery(voyageId));
  if (download) params.set('download', '1');
  const qs = params.toString();
  return `/api/inscriptions/${encodeURIComponent(inscriptionId)}/pieces/${index}${qs ? `?${qs}` : ''}`;
}

/** URL du ZIP des pièces jointes d'une classe ("Toutes" = tout le voyage), rangées par élève */
export function piecesZipUrl(voyageId: string, classe: string): string {
  const params = new URLSearchParams(authQuery(voyageId));
  params.set('classe', classe || 'Toutes');
  return `/api/voyages/${encodeURIComponent(voyageId)}/pieces/zip?${params.toString()}`;
}

function authQuery(voyageId?: string): string {
  const params = new URLSearchParams();
  const adminToken = safeSession.getItem('ndm_admin_token');
  const consultationToken = safeSession.getItem('ndm_consultation_token');
  if (adminToken) params.set('adminToken', adminToken);
  else if (consultationToken) params.set('consultationToken', consultationToken);
  else if (voyageId) {
    try {
      const map = JSON.parse(safeSession.getItem('ndm_unlocked_voyages') || '{}');
      if (map[voyageId]) params.set('password', map[voyageId]);
    } catch {
      /* ignoré */
    }
  }
  return params.toString();
}
