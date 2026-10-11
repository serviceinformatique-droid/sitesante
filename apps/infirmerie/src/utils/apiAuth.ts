/**
 * Authentification côté navigateur (build securite-20261011)
 * - Les jetons de session sont gardés EN MÉMOIRE uniquement (rien dans localStorage / sessionStorage / cookies) :
 *   un rechargement de la page demande une nouvelle connexion.
 * - Ils sont récupérés automatiquement dans les réponses de connexion / inscription,
 *   puis joints à chaque appel /api (en-têtes X-Staff-Token / X-Parent-Token).
 * - Une réponse 401 « auth-required » déclenche l'événement 'infirmerie:session-expiree'.
 */
let staffToken: string | null = null;
let parentToken: string | null = null;

export const SESSION_EXPIRED_EVENT = 'infirmerie:session-expiree';

export function getStaffToken(): string | null {
  return staffToken;
}

export function clearSession(role: 'staff' | 'parent'): void {
  const token = role === 'staff' ? staffToken : parentToken;
  if (role === 'staff') staffToken = null;
  else parentToken = null;
  if (token) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    headers[role === 'staff' ? 'X-Staff-Token' : 'X-Parent-Token'] = token;
    window.fetch('/api/auth/logout', { method: 'POST', headers }).catch(() => {});
  }
}

/** Lien de téléchargement direct (<a href>) : le jeton du personnel passe dans l'URL */
export function withStaffToken(url: string): string {
  if (!staffToken) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(staffToken)}`;
}

export function installApiAuth(): void {
  if ((window as any).__infirmerieApiAuth) return;
  (window as any).__infirmerieApiAuth = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    let pathname = url;
    try {
      pathname = new URL(url, window.location.origin).pathname;
    } catch {
      /* chemin relatif */
    }
    if (!pathname.startsWith('/api/')) return originalFetch(input, init);

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (staffToken && !headers.has('X-Staff-Token')) headers.set('X-Staff-Token', staffToken);
    if (parentToken && !headers.has('X-Parent-Token')) headers.set('X-Parent-Token', parentToken);

    const res = await originalFetch(input, { ...init, headers, cache: 'no-store' });

    // Récupération des jetons émis à la connexion / l'inscription
    const isStaffLogin = pathname === '/api/auth/admin/login';
    const isParentLogin = pathname === '/api/auth/parent/login' || pathname === '/api/auth/parent/register';
    if ((isStaffLogin || isParentLogin) && res.ok) {
      try {
        const data = await res.clone().json();
        if (data && data.success && data.token) {
          if (isStaffLogin) staffToken = data.token;
          else parentToken = data.token;
        }
      } catch {
        /* ignoré */
      }
    }

    if (res.status === 401 && !pathname.startsWith('/api/auth/')) {
      try {
        const data = await res.clone().json();
        if (data && data.code === 'auth-required') {
          window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
        }
      } catch {
        /* ignoré */
      }
    }
    return res;
  };
}
