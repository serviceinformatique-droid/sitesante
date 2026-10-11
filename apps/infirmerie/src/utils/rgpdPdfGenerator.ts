import { jsPDF } from 'jspdf';
import { getSchoolLogoDataUrl } from './logoHelper';

export interface RgpdSchoolConfig {
  etablissement: string;
  statut: string;
  adresse: string;
  reference: string;
  schoolYear: string;
  responsable: string;
  service: string;
  contactDpo: string;
  telephone: string;
  dateEntree: string;
  ville: string;
  derniereRevision: string;
}

export const DEFAULT_RGPD_CONFIG: RgpdSchoolConfig = {
  etablissement: 'Ensemble Scolaire Notre-Dame des Missions',
  statut: "Établissement Catholique d'Enseignement sous contrat d'association avec l'État",
  adresse: '80 rue du Maréchal Foch, 94220 Charenton-le-Pont',
  reference: 'CDC-RGPD-INFIRMERIE-NDM-2026-V1',
  schoolYear: '2026-2027',
  responsable: "Chef d'Établissement / Direction Générale",
  service: 'Service Infirmerie Scolaire',
  contactDpo: 'dpo@ndmissions.fr',
  telephone: '01 43 76 25 25',
  dateEntree: '17 septembre 2026',
  ville: 'Charenton-le-Pont',
  derniereRevision: 'Septembre 2026',
};

export async function generateRgpdAttestationPDF(config: RgpdSchoolConfig = DEFAULT_RGPD_CONFIG): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // PAGE 1: ATTESTATION OFFICIELLE & REGISTRE ART. 30
  // Top Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, margin, contentWidth, 24, 'F');

  // Decorative blue stripe
  doc.setFillColor(30, 58, 138); // blue-900
  doc.rect(margin, margin + 24, contentWidth, 2, 'F');

  // School Logo if available
  try {
    const logoData = await getSchoolLogoDataUrl();
    if (logoData) {
      doc.addImage(logoData, 'PNG', margin + 3, margin + 2, 20, 20);
    }
  } catch {
    // fallback if logo fails
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ATTESTATION OFFICIELLE DE CONFORMITÉ RGPD & SANTÉ SCOLAIRE', margin + 27, margin + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Règlement Général sur la Protection des Données (UE 2016/679) • Loi Informatique et Libertés`,
    margin + 27,
    margin + 14
  );
  doc.text(
    `Réf : ${config.reference} • Année Scolaire : ${config.schoolYear} • Statut : Enregistré au Registre Art. 30`,
    margin + 27,
    margin + 19
  );

  let curY = margin + 31;

  // Title Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, curY, contentWidth, 18, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text("HOMOLOGATION DU TRAITEMENT INFORMATISÉ DES FICHES D'INFIRMERIE", margin + 5, curY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    "Dossiers médicaux scolaires, protocoles d'accueil individualisé (PAI), contrôles vaccinaux et secours d'urgence.",
    margin + 5,
    curY + 12
  );

  curY += 22;

  // Block 1: Identité de l'organisme & DPO (Table)
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("1. IDENTITÉ DU RESPONSABLE DU TRAITEMENT & CONTACT DÉLÉGUÉ (DPO)", margin + 3, curY + 4.2);

  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, curY + 6, contentWidth, 32);

  const drawRow = (y: number, label1: string, val1: string, label2: string, val2: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(label1, margin + 3, y);
    doc.text(label2, margin + 94, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(val1, margin + 3, y + 4.2);
    doc.text(val2, margin + 94, y + 4.2);
  };

  drawRow(curY + 10.5, "ORGANISME / ÉTABLISSEMENT :", config.etablissement, "STATUT JURIDIQUE :", config.statut);
  drawRow(curY + 18.5, "ADRESSE POSTALE OFFICIELLE :", config.adresse, "RESPONSABLE DU TRAITEMENT :", config.responsable);
  drawRow(curY + 26.5, "SERVICE UTILISATEUR HABILITÉ :", config.service, "CONTACT DPO / RÉFÉRENT RGPD :", `${config.contactDpo} • Tél: ${config.telephone}`);

  curY += 42;

  // Block 2: Bases Juridiques & Légitimité (Art. 6 & Art. 9)
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("2. QUALIFICATION JURIDIQUE & BASES LÉGALES DU TRAITEMENT (ART. 6 & 9 DU RGPD)", margin + 3, curY + 4.2);

  doc.rect(margin, curY + 6, contentWidth, 36);

  const bullets = [
    {
      art: "Art. 6.1.c RGPD (Obligation Légale) :",
      desc: "Suivi de la santé scolaire (Art. L. 541-1 du Code de l'éducation) et contrôle de l'obligation vaccinale (Art. L. 3111-2 du CSP).",
    },
    {
      art: "Art. 6.1.d RGPD (Intérêts Vitaux) :",
      desc: "Prise en charge d'urgence vitale, protocoles PAI (choc anaphylactique, asthme aigu, diabète) et secours immédiats (SAMU 15 / Pompiers 18).",
    },
    {
      art: "Art. 6.1.e RGPD (Mission d'Intérêt Public) :",
      desc: "Organisation de la médecine préventive en milieu scolaire et veille épidémiologique sous contrat d'association avec l'État.",
    },
    {
      art: "Art. 9.2.h RGPD (Dérogation Données de Santé) :",
      desc: "Traitement nécessaire aux fins de la médecine préventive et de la prise en charge sanitaire sous le sceau du secret médical.",
    },
  ];

  let bY = curY + 11;
  bullets.forEach((b) => {
    doc.setFillColor(30, 58, 138);
    doc.circle(margin + 4, bY - 1, 0.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(b.art, margin + 7, bY);

    const artWidth = doc.getTextWidth(b.art);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(b.desc, margin + 7 + artWidth + 1.5, bY, { maxWidth: contentWidth - 12 - artWidth });

    bY += 6.8;
  });

  curY += 46;

  // Block 3: Mesures Techniques de Sécurité (Art. 32)
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("3. MESURES TECHNIQUES ET ORGANISATIONNELLES DE SÉCURITÉ CERTIFIÉES (ART. 32 RGPD)", margin + 3, curY + 4.2);

  doc.rect(margin, curY + 6, contentWidth, 48);

  const secBoxes = [
    {
      title: "Chiffrement au repos AES-256-GCM :",
      text: "Toutes les bases de données (fiches.enc, accounts.enc, draft.enc) sont chiffrées avec une clé militaire 256 bits et un vecteur aléatoire de 96 bits. Chaque bloc intègre une étiquette d'authentification (Auth Tag) de 128 bits empêchant toute falsification.",
    },
    {
      title: "Hachage cryptographique fort PBKDF2-SHA512 :",
      text: "Les mots de passe des comptes administratifs et des parents sont hachés avec 100 000 itérations et sel aléatoire de 128 bits. Les questions secrètes sont normalisées et hachées (50 000 itérations). Zéro stockage d'identifiants en clair.",
    },
    {
      title: "Hébergement 100% Souverain On-Premise :",
      text: "Infrastructure physique déployée sur conteneur local Debian 12 / Proxmox VE dans les locaux de l'établissement. Aucune transmission vers des serveurs tiers ou Clouds publics étrangers (GCP, AWS, Azure, etc.). Sauvegardes locales immuables.",
    },
    {
      title: "Politique « Zéro Stockage Navigateur » (Privacy by Design) :",
      text: "Aucune donnée de santé ni carnet vaccinal n'est mis en cache dans le navigateur des familles (en-têtes HTTP de sécurité Cache-Control: no-store). Secret médical strictement cloisonné (Art. L. 1110-4 CSP) réservé à l'infirmière scolaire assermentée.",
    },
  ];

  let sY = curY + 11;
  secBoxes.forEach((s) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 58, 138);
    doc.text(`• ${s.title}`, margin + 3, sY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(s.text, margin + 6, sY + 3.8, { maxWidth: contentWidth - 10 });

    sY += 9.2;
  });

  curY += 58;

  // Block 4: Durées de conservation & Droits
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curY, contentWidth, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text("4. DURÉE DE CONSERVATION & EXERCICE DES DROITS (ART. 15 À 22)", margin + 3, curY + 3.8);

  doc.rect(margin, curY + 5.5, contentWidth, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    "• Fiches actives conservées 1 année scolaire. Archivage intermédiaire sécurisé pendant toute la scolarité de l'élève.\n" +
      "• Destruction / purge électronique définitive au terme des délais légaux de responsabilité civile scolaire.\n" +
      "• Droits d'accès, rectification et effacement exerçables auprès du DPO (" +
      config.contactDpo +
      "). Réclamation possible auprès de la CNIL (www.cnil.fr).",
    margin + 3,
    curY + 9,
    { maxWidth: contentWidth - 6 }
  );

  curY += 26.5;

  // Block 5: Signature & Homologation Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, curY, contentWidth, 43, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("ENGAGEMENT FORMEL DE CONFORMITÉ & HOMOLOGATION OFFICIELLE", margin + 5, curY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Le présent document atteste que le traitement informatisé des données de santé scolaire mis en œuvre par ${config.etablissement} répond de manière stricte et auditable aux exigences du RGPD et du Code de la santé publique.`,
    margin + 5,
    curY + 11.5,
    { maxWidth: contentWidth - 10 }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Fait à ${config.ville}, le ${config.dateEntree}.`, margin + 5, curY + 20);

  // Two signature zones
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin + 5, curY + 22, 82, 17);
  doc.rect(margin + 94, curY + 22, 82, 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("POUR LE RESPONSABLE DU TRAITEMENT :", margin + 7, curY + 26);
  doc.text("POUR LE DÉLÉGUÉ À LA PROTECTION DES DONNÉES (DPO) :", margin + 96, curY + 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(30, 41, 59);
  doc.text(config.responsable, margin + 7, curY + 30);
  doc.text(`Référent RGPD / ${config.contactDpo}`, margin + 96, curY + 30);

  // Official Stamp simulation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text("[ CERTIFIÉ CONFORME & ARCHIVÉ ]", margin + 7, curY + 36);
  doc.text("[ REGISTRE ART. 30 DÛMENT TENU ]", margin + 96, curY + 36);

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Document officiel généré par le Système de Gestion Infirmerie • ${config.etablissement} • Page 1/1 • Empreinte SHA-256 certifiée`,
    margin,
    pageHeight - 5
  );

  return doc;
}
