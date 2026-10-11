export type SchoolClass = 
  | '6ème A' | '6ème B' | '6ème C' | '6ème D'
  | '5ème A' | '5ème B' | '5ème C' | '5ème D'
  | '4ème A' | '4ème B' | '4ème C' | '4ème D'
  | '3ème A' | '3ème B' | '3ème C' | '3ème D'
  | '2nde 1' | '2nde 2' | '2nde 3' | '2nde 4'
  | '1ère G1' | '1ère G2' | '1ère G3' | '1ère STMG'
  | 'Tale G1' | 'Tale G2' | 'Tale G3' | 'Tale STMG';

export const SCHOOL_CLASSES: SchoolClass[] = [
  '6ème A', '6ème B', '6ème C', '6ème D',
  '5ème A', '5ème B', '5ème C', '5ème D',
  '4ème A', '4ème B', '4ème C', '4ème D',
  '3ème A', '3ème B', '3ème C', '3ème D',
  '2nde 1', '2nde 2', '2nde 3', '2nde 4',
  '1ère G1', '1ère G2', '1ère G3', '1ère STMG',
  'Tale G1', 'Tale G2', 'Tale G3', 'Tale STMG'
];

export const SCHOOL_YEARS = ['2025-2026', '2026-2027', '2027-2028'];

export type VaccinationStatus = 'a_jour' | 'non' | 'non_realise' | 'inconnu';

export interface VaccinationDetail {
  status: VaccinationStatus;
  date?: string;
  comment?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string; // base64
  uploadedAt: string;
}

export interface FicheInfirmerieData {
  id?: string;
  schoolYear: string;
  status: 'brouillon' | 'complete' | 'signee' | 'transmise_nextcloud' | 'erreur_transmission';

  // Section 1 - Identité de l'élève
  eleve: {
    classe: SchoolClass | string;
    nom: string;
    prenom: string;
    dateNaissance: string;
    adresse: string;
    codePostal: string;
    ville: string;
    nomMedecinTraitant: string;
    telMedecinTraitant: string;
  };

  // Section 2 - Personnes responsables
  responsableLegal: {
    nom: string;
    statut: 'pere' | 'mere' | 'responsable_tuteur';
    telPersonnel: string;
    telTravailMere: string;
    telTravailMereNonConcerne: boolean;
    telTravailPere: string;
    telTravailPereNonConcerne: boolean;
  };

  // Section 3 - Personne accident
  urgenceAccident: {
    nomPrenom: string;
    telPersonnel: string;
    telTravail: string;
    telTravailNonConcerne: boolean;
    adresse: string;
  };

  // Section 4 - Santé & Vaccinations
  sante: {
    vaccinations: {
      antipoliomyelitique: VaccinationDetail;
      antidiphterique: VaccinationDetail;
      antitetanique: VaccinationDetail;
      anticoqueluche: VaccinationDetail;
      antituberculeux_bcg: VaccinationDetail;
    };
    carnetVaccinations: UploadedFile[];
    allergiesDifficultesSante: string;
    aucuneAllergie: boolean;
  };

  // Section 5 - Autorisation parentale
  autorisationParentale: {
    soussigneNomPrenom: string;
    qualite: 'pere' | 'mere' | 'autres';
    autreQualitePrecision?: string;
    nomEnfant: string;
    accordPriseEnCharge: boolean;
    accordActesMedicaux: boolean;
    faitA: string;
    faitLe: string;
    signatureDataUrl: string;
    mentionLuEtApprouve: boolean;
    signataireNomComplet: string;
    dateHeureSignature: string;
  };

  // Section 6 - Consentement données de santé (RGPD)
  consentementDonneesSante: {
    accepteCollecteEtTransmission: boolean;
    dateConsentement: string;
  };

  // Nextcloud & Storage Metadata
  nextcloud?: {
    status: 'en_attente' | 'transmis' | 'erreur';
    dossierCible?: string;
    fichierFicheNom?: string;
    fichierCarnetNom?: string;
    urlFiche?: string;
    urlCarnet?: string;
    derniereTentative?: string;
    messageErreur?: string;
    retryCount?: number;
  };

  createdAt: string;
  updatedAt: string;
  historique: Array<{
    date: string;
    action: string;
    details?: string;
  }>;
}

export interface NextcloudConfig {
  url: string;
  username: string;
  appPassword: string;
  rootFolder: string;
  enabled: boolean;
  isCustomConfigured: boolean;
}

export interface NextcloudFileNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  size?: number;
  updatedAt?: string;
  children?: NextcloudFileNode[];
}

export interface ParentProfile {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone: string;
}

export interface AdminProfile {
  username: string;
  label?: string;
  role?: string;
}

export interface StaffProfile {
  username: 'admin' | 'infirmerie' | string;
  label: string;
  role: 'admin' | 'infirmerie';
}

export const SECRET_QUESTIONS = [
  'Quel est le nom de votre premier animal de compagnie ?',
  'Dans quelle ville êtes-vous né(e) ?',
  'Quel est le prénom de votre grand-mère maternelle ?',
  'Quel était le nom de votre école primaire ?',
  'Quel est votre lieu de vacances préféré d\'enfance ?',
] as const;

export const INITIAL_FICHE_DATA: FicheInfirmerieData = {
  schoolYear: '2026-2027',
  status: 'brouillon',
  eleve: {
    classe: '',
    nom: '',
    prenom: '',
    dateNaissance: '',
    adresse: '',
    codePostal: '',
    ville: '',
    nomMedecinTraitant: '',
    telMedecinTraitant: '',
  },
  responsableLegal: {
    nom: '',
    statut: 'pere',
    telPersonnel: '',
    telTravailMere: '',
    telTravailMereNonConcerne: false,
    telTravailPere: '',
    telTravailPereNonConcerne: false,
  },
  urgenceAccident: {
    nomPrenom: '',
    telPersonnel: '',
    telTravail: '',
    telTravailNonConcerne: false,
    adresse: '',
  },
  sante: {
    vaccinations: {
      antipoliomyelitique: { status: 'a_jour' },
      antidiphterique: { status: 'a_jour' },
      antitetanique: { status: 'a_jour' },
      anticoqueluche: { status: 'a_jour' },
      antituberculeux_bcg: { status: 'a_jour' },
    },
    carnetVaccinations: [],
    allergiesDifficultesSante: '',
    aucuneAllergie: false,
  },
  autorisationParentale: {
    soussigneNomPrenom: '',
    qualite: 'pere',
    nomEnfant: '',
    accordPriseEnCharge: false,
    accordActesMedicaux: false,
    faitA: '',
    faitLe: new Date().toLocaleDateString('fr-FR'),
    signatureDataUrl: '',
    mentionLuEtApprouve: false,
    signataireNomComplet: '',
    dateHeureSignature: '',
  },
  consentementDonneesSante: {
    accepteCollecteEtTransmission: false,
    dateConsentement: '',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  historique: [
    {
      date: new Date().toISOString(),
      action: 'Initialisation de la fiche',
    },
  ],
};

export interface SchoolBranding {
  schoolName: string;
  subTitle: string;
  logoDataUrl?: string;
}

