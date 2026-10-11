import { useEffect, useState } from 'react';

/**
 * Nom de l'établissement — source UNIQUE pour tous les écrans et tous les PDF de la Fiche Infirmerie
 * (build etablissement-central-20261011). Il vient de GET /api/branding, lui-même mis à jour par la
 * gestion centralisée du portail NDM ou par le bouton « Identité & Logo » du tableau de bord.
 */
export const NOM_PAR_DEFAUT = 'Ensemble Scolaire Notre-Dame des Missions';

let nomCourant = NOM_PAR_DEFAUT;
const abonnes = new Set<(n: string) => void>();

export function getSchoolName(): string {
  return nomCourant;
}

/** Version en majuscules (en-têtes officiels, PDF) */
export function getSchoolNameUpper(): string {
  return nomCourant.toLocaleUpperCase('fr-FR');
}

export function setSchoolName(nom: string | undefined | null): void {
  const n = (nom || '').trim();
  if (!n || n === nomCourant) return;
  nomCourant = n;
  document.title = `Fiche Infirmerie Numérique – ${n}`;
  abonnes.forEach((f) => f(n));
}

export function useSchoolName(): string {
  const [nom, setNom] = useState(nomCourant);
  useEffect(() => {
    abonnes.add(setNom);
    setNom(nomCourant);
    return () => {
      abonnes.delete(setNom);
    };
  }, []);
  return nom;
}
