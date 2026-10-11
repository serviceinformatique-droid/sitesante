import { useEffect, useState } from 'react';

/** Nom de l'établissement, géré de façon centralisée depuis le portail NDM (GET /api/settings/public) */
export const ETABLISSEMENT_DEFAUT = "L'établissement scolaire Notre Dame des Missions";

let cache: string | null = null;
let pending: Promise<string> | null = null;

export function chargerEtablissement(): Promise<string> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = fetch('/api/settings/public', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        cache = (d && typeof d.etablissement === 'string' && d.etablissement.trim()) || ETABLISSEMENT_DEFAUT;
        return cache;
      })
      .catch(() => ETABLISSEMENT_DEFAUT)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

export function useEtablissement(): string {
  const [nom, setNom] = useState<string>(cache || ETABLISSEMENT_DEFAUT);
  useEffect(() => {
    let actif = true;
    chargerEtablissement().then((n) => actif && setNom(n));
    return () => {
      actif = false;
    };
  }, []);
  return nom;
}
