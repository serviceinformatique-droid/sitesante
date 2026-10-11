export type TripStatus = 'preparation' | 'inscriptions_ouvertes' | 'inscriptions_fermees' | 'termine';
export type SyncConnectionStatus = 'connected' | 'error' | 'testing' | 'untested';
export type InscriptionStatus = 'COMPLET' | 'A_FINALISER' | 'NON_SIGNE';

export interface SignataireInfo {
  nom: string;
  email: string;
  telephone?: string;
  statut: 'signed' | 'pending' | 'not_sent';
  date_signature?: string;
  submitter_id?: string;
  slug?: string;
}

export interface Inscription {
  id: string;
  voyage_id: string;
  eleve_nom: string;
  eleve_prenom: string;
  classe: string;
  docuseal_submission_id: string;
  date_creation: string;
  date_derniere_synchronisation: string;
  parent1: SignataireInfo;
  parent2: SignataireInfo;
  nombre_signatures: 0 | 1 | 2;
  statut: InscriptionStatus;
  document_url?: string;
  derniere_relance?: string;
  remarques?: string;
  classe_modifiee_manuellement?: boolean;

  // Pièces jointes téléversées par les parents dans DocuSeal (copiées sur le serveur après signature)
  pieces_jointes?: PieceJointe[];
  pieces_submitters_traites?: string[]; // submitters DocuSeal signés dont les fichiers ont déjà été récupérés
}

/** Identifiant de la pièce demandée (ex. 'carte_identite', 'fiche_sanitaire'…) ou 'autre' (champ Fichier non prévu) */
export type PieceType = string;

/** Pièce jointe demandée aux parents pour un voyage (configurable voyage par voyage) */
export interface PieceRequise {
  id: string;            // identifiant stable (ex. "carte_identite")
  libelle: string;       // libellé affiché et nom conseillé du champ Fichier DocuSeal
  suffixe?: string;      // suffixe du nom de fichier (sinon calculé depuis le libellé)
  mots_cles?: string[];  // autres noms de champ DocuSeal reconnus
}

export interface PieceJointe {
  type: PieceType;
  libelle: string;        // libellé lisible (ex : "Carte d'identité")
  champ_docuseal: string; // nom du champ "Fichier" dans le modèle DocuSeal
  fichier: string;        // nom du fichier sur le serveur (NOM_Prenom_Piece.ext)
  chemin: string;         // chemin relatif au dossier PIECES_DIR (Voyage/Classe/fichier)
  taille: number;         // octets
  mime: string;
  submitter_id: string;
  date_recuperation: string;
  index?: number;         // rang du fichier si plusieurs fichiers dans le même champ
}

export interface Voyage {
  id: string;
  nom: string;
  description: string;
  destination: string;
  date_depart: string;
  date_retour: string;
  etablissement: string;
  classes_concernees: string[];
  statut: TripStatus;
  
  // DocuSeal configuration
  docuseal_instance_name: string;
  docuseal_url: string;
  docuseal_api_key_masked?: string;
  docuseal_api_key?: string; // Stored server-side only
  docuseal_template_id: string;

  // Pièces jointes demandées aux parents (absent = 3 pièces historiques, [] = aucune)
  pieces_requises?: PieceRequise[];

  // Sync state
  connection_status: SyncConnectionStatus;
  last_test_at?: string;
  last_test_message?: string;
  last_sync_at?: string;
  last_sync_message?: string;
  
  // Access control
  mot_de_passe?: string; // Stored server-side, visible to admin only
  has_password?: boolean; // Exposed to public so UI knows if password is required

  // Stats
  total_inscrits: number;
  total_complets: number;
  total_a_finaliser: number;
  total_doublons?: number;
  total_non_signes: number;
  
  created_at: string;
  updated_at: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  voyage_id: string;
  voyage_nom: string;
  type: 'manual_sync' | 'auto_sync' | 'webhook' | 'connection_test' | 'pieces_jointes';
  status: 'success' | 'warning' | 'error';
  message: string;
  inscriptions_count?: number;
  new_signatures?: number;
  new_inscriptions?: number;
}

export type SyncLog = SyncLogEntry;

export interface UserSession {
  role: 'admin' | 'professeur' | 'consultation';
  nom: string;
  email: string;
  isAdmin: boolean;
  isConsultation?: boolean;
}
