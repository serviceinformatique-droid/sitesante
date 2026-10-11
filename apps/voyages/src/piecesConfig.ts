/**
 * Pièces jointes demandées aux parents — configurables VOYAGE PAR VOYAGE.
 * Partagé entre le serveur (server/attachments.ts) et l'interface.
 *
 * Chaque voyage possède sa liste `pieces_requises` (Administration → Modifier le voyage → « Pièces jointes demandées »).
 * - liste absente (anciens voyages) : on reprend les 3 pièces historiques (préréglage « Voyage dans l'Union européenne ») ;
 * - liste vide : aucune pièce obligatoire (les champs Fichier éventuels sont quand même récupérés, en « Autres fichiers »).
 * Le nom du champ « Fichier » dans DocuSeal est rapproché du libellé de la pièce (ou de ses mots-clés).
 */
import type { PieceRequise, Voyage } from './types.js';

export const PIECE_CARTE_IDENTITE: PieceRequise = {
  id: 'carte_identite',
  libelle: "Carte d'identité",
  suffixe: 'Carte-Identite',
  mots_cles: ["carte d'identité", 'carte identite', 'identite', 'cni', "pièce d'identité"],
};
export const PIECE_PASSEPORT: PieceRequise = {
  id: 'passeport',
  libelle: 'Passeport',
  suffixe: 'Passeport',
  mots_cles: ['passeport', 'passport'],
};
export const PIECE_AST: PieceRequise = {
  id: 'autorisation_sortie_territoire',
  libelle: 'Autorisation de sortie du territoire',
  suffixe: 'Autorisation-Sortie-Territoire',
  mots_cles: ['sortie du territoire', 'sortie de territoire', 'sortie territoire', 'autorisation de sortie', 'ast', 'cerfa 15646'],
};
export const PIECE_CEAM: PieceRequise = {
  id: 'carte_mutuelle_europeenne',
  libelle: 'Carte de mutuelle européenne',
  suffixe: 'Carte-Mutuelle-Europeenne',
  mots_cles: ['mutuelle', 'ceam', 'carte europeenne', "carte européenne d'assurance maladie", 'europeenne'],
};

/** Liste historique (anciens voyages sans configuration) */
export const PIECES_PAR_DEFAUT: PieceRequise[] = [PIECE_CARTE_IDENTITE, PIECE_AST, PIECE_CEAM];

/** Préréglages proposés dans le formulaire du voyage (modifiables ensuite librement) */
export const PRESETS_PIECES: Array<{ nom: string; pieces: PieceRequise[] }> = [
  { nom: "Voyage dans l'Union européenne", pieces: [PIECE_CARTE_IDENTITE, PIECE_AST, PIECE_CEAM] },
  {
    nom: "Voyage hors Union européenne",
    pieces: [
      PIECE_PASSEPORT,
      PIECE_AST,
      { id: 'assurance_rapatriement', libelle: 'Attestation assurance rapatriement', mots_cles: ['rapatriement', 'assistance', 'assurance voyage'] },
    ],
  },
  {
    nom: 'Sortie / séjour en France',
    pieces: [
      { id: 'assurance_scolaire', libelle: 'Attestation assurance scolaire', mots_cles: ['assurance scolaire', 'responsabilite civile', 'attestation d assurance'] },
      { id: 'fiche_sanitaire', libelle: 'Fiche sanitaire', mots_cles: ['sanitaire', 'fiche medicale', 'vaccin'] },
    ],
  },
  { nom: 'Aucune pièce jointe', pieces: [] },
];

/** Normalisation : minuscules, sans accents, mots séparés par un espace, entouré d'espaces */
export function normPiece(s: string): string {
  return ` ${String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

/** Nom de fichier / dossier sûr : sans accents, sans espaces, sans caractères spéciaux */
export function safeName(s: string, fallback = 'Inconnu'): string {
  const out = String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return out || fallback;
}

const PETITS_MOTS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'a', 'au', 'aux', 'en', 'pour', 'd', 'l', 'un', 'une']);

/** Suffixe de nom de fichier : "Attestation d'assurance scolaire" → "Attestation-Assurance-Scolaire" */
export function suffixePiece(p: Pick<PieceRequise, 'libelle' | 'suffixe'>): string {
  if (p.suffixe) return p.suffixe;
  const mots = normPiece(p.libelle)
    .trim()
    .split(' ')
    .filter((m) => m && !PETITS_MOTS.has(m))
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1));
  return safeName(mots.join('-'), 'Piece').slice(0, 60);
}

/** Identifiant stable à partir du libellé */
export function idPiece(libelle: string): string {
  return normPiece(libelle).trim().replace(/ /g, '_').slice(0, 60) || 'piece';
}

/** Pièces demandées pour un voyage */
export function piecesDuVoyage(voyage?: Pick<Voyage, 'pieces_requises'> | null): PieceRequise[] {
  if (!voyage || !Array.isArray(voyage.pieces_requises)) return PIECES_PAR_DEFAUT;
  return voyage.pieces_requises;
}

/** Retrouve la pièce correspondant au nom d'un champ DocuSeal */
export function detecterPiece(pieces: PieceRequise[], nomChamp: string): PieceRequise | undefined {
  const n = normPiece(nomChamp);
  if (n.trim() === '') return undefined;
  // 1) libellé identique  2) le champ contient le libellé  3) mots-clés (dans l'ordre de la liste)
  return (
    pieces.find((p) => normPiece(p.libelle) === n) ||
    pieces.find((p) => n.includes(normPiece(p.libelle))) ||
    pieces.find((p) => (p.mots_cles || []).some((m) => n.includes(normPiece(m))))
  );
}

/**
 * Texte du formulaire ↔ liste. Une pièce par ligne, mots-clés facultatifs après « | » :
 *   Carte d'identité
 *   Fiche sanitaire | sanitaire, vaccins
 */
export function piecesVersTexte(pieces: PieceRequise[]): string {
  const connues = [PIECE_CARTE_IDENTITE, PIECE_PASSEPORT, PIECE_AST, PIECE_CEAM];
  return pieces
    .map((p) => {
      const isConnue = connues.some((c) => c.id === p.id && c.libelle === p.libelle);
      return !isConnue && p.mots_cles && p.mots_cles.length ? `${p.libelle} | ${p.mots_cles.join(', ')}` : p.libelle;
    })
    .join('\n');
}

export function texteVersPieces(texte: string): PieceRequise[] {
  const connues = [PIECE_CARTE_IDENTITE, PIECE_PASSEPORT, PIECE_AST, PIECE_CEAM];
  const vus = new Set<string>();
  const out: PieceRequise[] = [];
  for (const ligne of String(texte || '').split(/\r?\n/)) {
    const [lib, mots] = ligne.split('|');
    const libelle = (lib || '').trim().slice(0, 120);
    if (!libelle) continue;
    const motsCles = (mots || '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
      .slice(0, 20);
    // Pièce connue (même libellé ou reconnue par ses mots-clés) : on reprend sa définition complète
    const connue = connues.find((c) => normPiece(c.libelle) === normPiece(libelle)) || (motsCles.length ? undefined : detecterPiece(connues, libelle));
    const piece: PieceRequise = connue
      ? { ...connue, libelle, mots_cles: [...new Set([...(connue.mots_cles || []), ...motsCles])] }
      : { id: idPiece(libelle), libelle, mots_cles: motsCles.length ? motsCles : undefined };
    if (vus.has(piece.id)) piece.id = `${piece.id}_${out.length + 1}`;
    vus.add(piece.id);
    out.push(piece);
  }
  return out.slice(0, 20);
}

/** Validation d'une liste reçue de l'interface (API) */
export function nettoyerPieces(input: unknown): PieceRequise[] | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input === 'string') return texteVersPieces(input);
  if (!Array.isArray(input)) return undefined;
  return texteVersPieces(
    input
      .map((p: any) => (typeof p === 'string' ? p : p && typeof p.libelle === 'string' ? `${p.libelle}${Array.isArray(p.mots_cles) && p.mots_cles.length ? ` | ${p.mots_cles.join(', ')}` : ''}` : ''))
      .join('\n')
  );
}
