/**
 * Accès sécurisé à sessionStorage.
 * Dans une iframe (surtout cross-site, Safari / navigateurs en mode strict) l'accès au stockage peut lever une exception :
 * on bascule alors sur une mémoire de secours pour que l'application continue de fonctionner.
 */
const memory = new Map<string, string>();

function getStore(): Storage | null {
  try {
    const s = window.sessionStorage;
    const k = '__ndm_test__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export const safeSession = {
  getItem(key: string): string | null {
    const store = getStore();
    if (store) {
      try {
        return store.getItem(key);
      } catch {
        /* repli mémoire */
      }
    }
    return memory.has(key) ? (memory.get(key) as string) : null;
  },
  setItem(key: string, value: string): void {
    memory.set(key, value);
    const store = getStore();
    if (store) {
      try {
        store.setItem(key, value);
      } catch {
        /* repli mémoire */
      }
    }
  },
  removeItem(key: string): void {
    memory.delete(key);
    const store = getStore();
    if (store) {
      try {
        store.removeItem(key);
      } catch {
        /* ignoré */
      }
    }
  },
};
