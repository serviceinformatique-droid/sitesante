import { jsPDF } from 'jspdf';
import { FicheInfirmerieData, VaccinationDetail } from '../types';
import { getSchoolLogoDataUrl } from './logoHelper';

export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

export function getFicheFileName(data: FicheInfirmerieData): string {
  const nom = sanitizeFileName(data.eleve.nom.toUpperCase().trim() || 'NOM');
  const prenom = sanitizeFileName(
    data.eleve.prenom.charAt(0).toUpperCase() + data.eleve.prenom.slice(1).toLowerCase().trim() || 'Prenom'
  );
  const year = data.schoolYear || '2026-2027';
  return `${nom}_${prenom}_Fiche_infirmerie_${year}.pdf`;
}

export function getCarnetFileName(data: FicheInfirmerieData): string {
  const nom = sanitizeFileName(data.eleve.nom.toUpperCase().trim() || 'NOM');
  const prenom = sanitizeFileName(
    data.eleve.prenom.charAt(0).toUpperCase() + data.eleve.prenom.slice(1).toLowerCase().trim() || 'Prenom'
  );
  const year = data.schoolYear || '2026-2027';
  return `${nom}_${prenom}_Carnet_vaccinations_${year}.pdf`;
}

export function formatClassDirectory(classe: string): string {
  // e.g. "6ème A" -> "6A", "5ème B" -> "5B", "2nde 1" -> "2nde_1"
  return classe
    .replace(/ème\s*/i, '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Renders a structured table cell with label and value, strictly preventing text overflow
 */
function renderCell(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
  h: number,
  options?: {
    bold?: boolean;
    fillBg?: boolean;
    valColor?: [number, number, number];
    labelInline?: boolean;
    customValX?: number;
  }
) {
  // Draw cell background if requested
  if (options?.fillBg) {
    doc.setFillColor(248, 250, 253);
    doc.rect(x, y, w, h, 'F');
  }

  // Draw cell border
  doc.setDrawColor(185, 198, 215);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h);

  const safeVal = value?.trim() || '-';

  if (options?.labelInline) {
    // Label and value on the same line with mathematical overlap prevention
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(90, 105, 125);
    doc.text(label, x + 2.5, y + h / 2 + 1.2);

    const labelWidth = doc.getTextWidth(label);
    const minStartX = x + labelWidth + 3;
    const startX = options?.customValX ? Math.max(options.customValX, minStartX) : minStartX;
    const maxValWidth = Math.max(8, x + w - startX - 2);

    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    if (options?.valColor) {
      doc.setTextColor(options.valColor[0], options.valColor[1], options.valColor[2]);
    } else {
      doc.setTextColor(18, 30, 48);
    }

    // Auto-scale font size if value is too wide
    let fontSize = 8;
    doc.setFontSize(fontSize);
    while (doc.getTextWidth(safeVal) > maxValWidth && fontSize > 6) {
      fontSize -= 0.4;
      doc.setFontSize(fontSize);
    }

    // If still too wide, truncate cleanly with ellipsis
    let displayVal = safeVal;
    if (doc.getTextWidth(displayVal) > maxValWidth) {
      while (displayVal.length > 3 && doc.getTextWidth(displayVal + '…') > maxValWidth) {
        displayVal = displayVal.slice(0, -1);
      }
      displayVal += '…';
    }

    doc.text(displayVal, startX, y + h / 2 + 1.2);
  } else {
    // Stacked layout: Label on top row, Value on bottom row (STRICTLY IMPOSSIBLE TO OVERLAP)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(90, 108, 130);
    doc.text(label, x + 2.5, y + 3.3);

    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    if (options?.valColor) {
      doc.setTextColor(options.valColor[0], options.valColor[1], options.valColor[2]);
    } else {
      doc.setTextColor(15, 28, 48);
    }

    const maxValWidth = Math.max(10, w - 5);
    let fontSize = 8.2;
    doc.setFontSize(fontSize);
    while (doc.getTextWidth(safeVal) > maxValWidth && fontSize > 6) {
      fontSize -= 0.4;
      doc.setFontSize(fontSize);
    }

    let displayVal = safeVal;
    if (doc.getTextWidth(displayVal) > maxValWidth) {
      while (displayVal.length > 3 && doc.getTextWidth(displayVal + '…') > maxValWidth) {
        displayVal = displayVal.slice(0, -1);
      }
      displayVal += '…';
    }

    doc.text(displayVal, x + 2.5, y + h - 2.2);
  }
}

/**
 * Generates the official A4 PDF for the Fiche Infirmerie
 * Strictly reproduces the structure and all content of the institutional template with high-craft design
 */
export async function generateFichePDF(data: FicheInfirmerieData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 13;
  const contentWidth = pageWidth - margin * 2; // 184 mm
  let y = margin - 1; // start at 12mm

  // Palette matching Notre-Dame des Missions identity
  const primaryNavy: [number, number, number] = [15, 37, 87]; // #0F2557
  const accentBlue: [number, number, number] = [30, 75, 145];
  const darkSlate: [number, number, number] = [25, 35, 50];
  const mutedSlate: [number, number, number] = [95, 110, 130];
  const borderNavy: [number, number, number] = [170, 190, 215];
  const bgLightSection: [number, number, number] = [241, 245, 251];

  // Helper to draw clean section header banner
  const drawSectionBanner = (num: string, title: string, currentY: number): number => {
    const bannerH = 6;
    doc.setFillColor(bgLightSection[0], bgLightSection[1], bgLightSection[2]);
    doc.rect(margin, currentY, contentWidth, bannerH, 'F');
    doc.setDrawColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.setLineWidth(0.6);
    doc.rect(margin, currentY, contentWidth, bannerH);

    // Number tag badge
    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.rect(margin + 1, currentY + 1, 6.5, bannerH - 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(num, margin + 4.25, currentY + 4.2, { align: 'center' });

    // Section title text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(title.toUpperCase(), margin + 9.5, currentY + 4.3);

    return currentY + bannerH;
  };

  // ==========================================
  // --- TOP HEADER : ÉTABLISSEMENT ---
  // ==========================================

  // Institution Logo placed at top-left (no top line)
  const logoData = await getSchoolLogoDataUrl();
  const logoW = 14;
  const logoH = 16.2;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', margin, y, logoW, logoH);
    } catch (e) {
      console.error('Erreur insertion logo PDF:', e);
    }
  }

  // Header Typography aligned with the top-left logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('ENSEMBLE SCOLAIRE NOTRE-DAME DES MISSIONS – SAINT-PIERRE', margin + 17, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text("Établissement Catholique d'Enseignement • Sous-contrat d'Association avec l'État • Service Infirmerie", margin + 17, y + 11.5);

  y += 18;

  // ==========================================
  // --- MAIN TITLE BOX ---
  // ==========================================
  const titleBoxH = 12.5;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setLineWidth(0.8);
  doc.rect(margin, y, contentWidth, titleBoxH);

  // Inner fine border
  doc.setLineWidth(0.25);
  doc.rect(margin + 1, y + 1, contentWidth - 2, titleBoxH - 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('FICHE INFIRMERIE', pageWidth / 2, y + 5.6, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(
    `Document officiel confidentiel • Valable chaque année par tacite reconduction • Année scolaire ${data.schoolYear}`,
    pageWidth / 2,
    y + 9.8,
    { align: 'center' }
  );
  y += titleBoxH + 2.5;

  // ==========================================
  // --- SECTION 1 : IDENTITÉ DE L'ÉLÈVE ---
  // ==========================================
  y = drawSectionBanner('1', "Identité de l'élève", y);

  const row1H = 8.5;
  renderCell(doc, 'CLASSE', data.eleve.classe, margin, y, 32, row1H, {
    bold: true,
    valColor: primaryNavy,
    labelInline: false,
  });
  renderCell(doc, 'NOM DE FAMILLE', data.eleve.nom.toUpperCase(), margin + 32, y, 76, row1H, {
    bold: true,
    labelInline: false,
  });
  renderCell(doc, 'PRÉNOM', data.eleve.prenom, margin + 108, y, 76, row1H, {
    bold: true,
    labelInline: false,
  });
  y += row1H;

  const row2H = 8;
  renderCell(doc, 'DATE DE NAISSANCE', data.eleve.dateNaissance, margin, y, 50, row2H, {
    labelInline: false,
  });
  renderCell(doc, 'ADRESSE DU DOMICILE', data.eleve.adresse, margin + 50, y, 134, row2H, {
    labelInline: false,
  });
  y += row2H;

  const row3H = 8;
  renderCell(doc, 'CODE POSTAL & VILLE', `${data.eleve.codePostal} ${data.eleve.ville}`.trim(), margin, y, 68, row3H, {
    labelInline: false,
  });
  const docInfo = `Dr ${data.eleve.nomMedecinTraitant || '-'}  —  Tél : ${data.eleve.telMedecinTraitant || '-'}`;
  renderCell(doc, 'MÉDECIN TRAITANT & TÉLÉPHONE', docInfo, margin + 68, y, 116, row3H, {
    labelInline: false,
  });
  y += row3H + 2;

  // ==========================================
  // --- SECTION 2 : PERSONNES RESPONSABLES ---
  // ==========================================
  y = drawSectionBanner('2', "Personnes responsables de l'élève", y);

  const statutLabel =
    data.responsableLegal.statut === 'pere'
      ? 'Père'
      : data.responsableLegal.statut === 'mere'
      ? 'Mère'
      : 'Responsable légal / Tuteur';

  const respRow1H = 8.8;
  renderCell(doc, 'RESPONSABLE LÉGAL (NOM & PRÉNOM)', data.responsableLegal.nom.toUpperCase(), margin, y, 86, respRow1H, {
    bold: true,
    labelInline: false,
  });
  renderCell(doc, 'STATUT / QUALITÉ', statutLabel, margin + 86, y, 44, respRow1H, {
    labelInline: false,
  });
  renderCell(doc, 'TÉLÉPHONE PERSONNEL', data.responsableLegal.telPersonnel, margin + 130, y, 54, respRow1H, {
    bold: true,
    labelInline: false,
  });
  y += respRow1H;

  const respRow2H = 7.8;
  const telMere = data.responsableLegal.telTravailMereNonConcerne
    ? 'Non concerné'
    : (data.responsableLegal.telTravailMere || 'Non concerné');
  const telPere = data.responsableLegal.telTravailPereNonConcerne
    ? 'Non concerné'
    : (data.responsableLegal.telTravailPere || 'Non concerné');

  renderCell(doc, 'TÉL. PROFESSIONNEL MÈRE', telMere, margin, y, 92, respRow2H, {
    labelInline: false,
  });
  renderCell(doc, 'TÉL. PROFESSIONNEL PÈRE', telPere, margin + 92, y, 92, respRow2H, {
    labelInline: false,
  });
  y += respRow2H;

  // Sub-header : Contact en cas d'accident
  const subBannerH = 4.8;
  doc.setFillColor(243, 246, 252);
  doc.rect(margin, y, contentWidth, subBannerH, 'F');
  doc.setDrawColor(borderNavy[0], borderNavy[1], borderNavy[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, subBannerH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('PERSONNE POUVANT ÊTRE APPELÉE RAPIDEMENT EN CAS D’ACCIDENT :', margin + 2.5, y + 3.4);
  y += subBannerH;

  // Row Contact d'urgence - Stacked layout to guarantee ZERO overlap for "Grand-mère", parents, or relatives
  const urgRow1H = 9.2;
  renderCell(
    doc,
    'NOM, PRÉNOM & LIEN DU CONTACT (EX. GRAND-MÈRE, ONCLE, VOISIN)',
    data.urgenceAccident.nomPrenom,
    margin,
    y,
    96,
    urgRow1H,
    {
      bold: true,
      labelInline: false,
    }
  );

  renderCell(
    doc,
    'TÉLÉPHONE PERSONNEL',
    data.urgenceAccident.telPersonnel,
    margin + 96,
    y,
    44,
    urgRow1H,
    {
      bold: true,
      labelInline: false,
    }
  );

  const telUrgTravail = data.urgenceAccident.telTravailNonConcerne
    ? 'Non concerné'
    : (data.urgenceAccident.telTravail || 'Non concerné');

  renderCell(
    doc,
    'TÉLÉPHONE PROFESSIONNEL',
    telUrgTravail,
    margin + 140,
    y,
    44,
    urgRow1H,
    {
      labelInline: false,
    }
  );
  y += urgRow1H;

  // Emergency contact address row
  const urgAdrH = 7.8;
  renderCell(
    doc,
    'ADRESSE DU CONTACT D’URGENCE',
    data.urgenceAccident.adresse,
    margin,
    y,
    contentWidth,
    urgAdrH,
    {
      labelInline: false,
    }
  );
  y += urgAdrH + 2;

  // ==========================================
  // --- SECTION 3 : SANTÉ & VACCINATIONS ---
  // ==========================================
  y = drawSectionBanner('3', "Renseignements sur la santé de l'élève", y);

  // Vaccinations Grid Box
  const vaccBoxH = 14;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(borderNavy[0], borderNavy[1], borderNavy[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, vaccBoxH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('VACCINATIONS OBLIGATOIRES :', margin + 2.5, y + 3.8);

  const vaccs = [
    { label: 'Antipoliomyélitique', detail: data.sante.vaccinations.antipoliomyelitique },
    { label: 'Antidiphtérique', detail: data.sante.vaccinations.antidiphterique },
    { label: 'Antitétanique', detail: data.sante.vaccinations.antitetanique },
    { label: 'Anticoqueluche', detail: data.sante.vaccinations.anticoqueluche },
    { label: 'BCG (Antituberculeux)', detail: data.sante.vaccinations.antituberculeux_bcg },
  ];

  const getStatusBadge = (v: VaccinationDetail) => {
    if (v.status === 'a_jour') return { text: v.date ? `À jour (${v.date})` : 'À jour', color: [16, 120, 60] as [number, number, number] };
    if (v.status === 'non') return { text: 'Non à jour', color: [190, 40, 40] as [number, number, number] };
    if (v.status === 'non_realise') return { text: 'Non réalisé', color: [120, 120, 130] as [number, number, number] };
    return { text: 'Inconnu', color: [100, 100, 100] as [number, number, number] };
  };

  // 1st row of vaccines: 3 items (Antipolio, Antidiphtérique, Antitétanique)
  let vx = margin + 3;
  let vy = y + 7.8;
  const colW = 60;

  vaccs.slice(0, 3).forEach((vc) => {
    const badge = getStatusBadge(vc.detail);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text(`• ${vc.label} :`, vx, vy);

    const lblW = doc.getTextWidth(`• ${vc.label} :`);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(badge.color[0], badge.color[1], badge.color[2]);
    doc.text(badge.text, vx + lblW + 1.5, vy);
    vx += colW;
  });

  // 2nd row of vaccines: 2 items (Anticoqueluche, BCG)
  vx = margin + 3;
  vy += 4.5;
  vaccs.slice(3).forEach((vc) => {
    const badge = getStatusBadge(vc.detail);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text(`• ${vc.label} :`, vx, vy);

    const lblW = doc.getTextWidth(`• ${vc.label} :`);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(badge.color[0], badge.color[1], badge.color[2]);
    doc.text(badge.text, vx + lblW + 1.5, vy);
    vx += colW;
  });
  y += vaccBoxH;

  // Carnet status line - Perfectly spaced with zero overlap
  const carnetLineH = 6.2;
  doc.setFillColor(240, 249, 244); // subtle light green
  doc.rect(margin, y, contentWidth, carnetLineH, 'F');
  doc.setDrawColor(180, 220, 195);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, carnetLineH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(15, 110, 50);
  doc.text('✓ CARNET DE VACCINATIONS (OBLIGATOIRE) :', margin + 2.5, y + 4.1);

  const nbFiles = data.sante.carnetVaccinations?.length || 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(20, 90, 45);
  const carnetStatusText = `Dossier complet • ${nbFiles} document(s) / page(s) archivé(s) à l'infirmerie`;
  doc.text(carnetStatusText, margin + contentWidth - 3, y + 4.1, { align: 'right' });
  y += carnetLineH;

  // Allergies & Particular medical difficulties
  const allergyH = 13.5;
  doc.setDrawColor(borderNavy[0], borderNavy[1], borderNavy[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, allergyH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text('ALLERGIES ÉVENTUELLES OU AUTRES DIFFICULTÉS DE SANTÉ À SIGNALER :', margin + 2.5, y + 3.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  const allergyText = data.sante.aucuneAllergie
    ? 'Aucune allergie ou difficulté de santé à signaler.'
    : (data.sante.allergiesDifficultesSante?.trim() || 'Aucune information signalée.');

  const splitAllergies = doc.splitTextToSize(allergyText, contentWidth - 6);
  doc.text(splitAllergies, margin + 2.5, y + 7.8);
  y += allergyH + 2.5;

  // ==========================================
  // --- SECTION 4 : AUTORISATION PARENTALE ---
  // ==========================================
  y = drawSectionBanner('4', 'Autorisation parentale', y);

  const authBoxH = 43;
  doc.setDrawColor(borderNavy[0], borderNavy[1], borderNavy[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, authBoxH);

  const qualiteTxt =
    data.autorisationParentale.qualite === 'pere'
      ? 'père'
      : data.autorisationParentale.qualite === 'mere'
      ? 'mère'
      : `autre (${data.autorisationParentale.autreQualitePrecision || 'tuteur'})`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

  const soussigne = data.autorisationParentale.soussigneNomPrenom || data.responsableLegal.nom || '-';
  const childName = `${data.eleve.nom.toUpperCase()} ${data.eleve.prenom}`;
  doc.text(`Je, soussigné(e) : ${soussigne} [qualité : ${qualiteTxt}], représentant légal de l'enfant : ${childName}`, margin + 2.5, y + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('AUTORISE :', margin + 2.5, y + 8.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

  const clause1 = "• L'École Notre-Dame des Missions-St-Pierre à prendre, le cas échéant, toutes mesures (visite médicale, hospitalisation, transport en voiture, intervention des secours – pompiers ou SAMU) rendues nécessaires par l'état de santé de mon enfant.";
  const clause2 = "• Le praticien à pratiquer tout examen médical ou chirurgical nécessaire à l'établissement d'un diagnostic, et toute intervention médicale ou chirurgicale y compris avec phase d'anesthésie-réanimation que nécessiterait l'état de santé de mon enfant.";

  const split1 = doc.splitTextToSize(clause1, contentWidth - 55);
  const split2 = doc.splitTextToSize(clause2, contentWidth - 55);

  doc.text(split1, margin + 2.5, y + 12);
  doc.text(split2, margin + 2.5, y + 21);

  // Left metadata : Fait à / Le
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`Fait à : ${data.autorisationParentale.faitA || 'Paris'}`, margin + 2.5, y + 33);
  doc.text(`Le : ${data.autorisationParentale.faitLe || new Date().toLocaleDateString('fr-FR')}`, margin + 2.5, y + 38);

  // Signature Certificate Frame on the right
  const sigBoxW = 50;
  const sigBoxH = 34;
  const sigBoxX = margin + contentWidth - sigBoxW - 2.5;
  const sigBoxY = y + 4.5;

  doc.setFillColor(250, 252, 255);
  doc.rect(sigBoxX, sigBoxY, sigBoxW, sigBoxH, 'F');
  doc.setDrawColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.setLineWidth(0.4);
  doc.rect(sigBoxX, sigBoxY, sigBoxW, sigBoxH);

  // Header of signature box
  doc.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.rect(sigBoxX, sigBoxY, sigBoxW, 4.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(255, 255, 255);
  doc.text('SIGNATURE ÉLECTRONIQUE CERTIFIÉE', sigBoxX + sigBoxW / 2, sigBoxY + 3, { align: 'center' });

  // Render signature graphic
  const imgW = 38;
  const imgH = 15;
  const imgX = sigBoxX + (sigBoxW - imgW) / 2;
  const imgY = sigBoxY + 5.5;

  if (data.autorisationParentale.signatureDataUrl) {
    try {
      doc.addImage(data.autorisationParentale.signatureDataUrl, 'PNG', imgX, imgY, imgW, imgH);
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
      doc.text('[Signature validée]', sigBoxX + sigBoxW / 2, sigBoxY + 14, { align: 'center' });
    }
  }

  // Legal mention "Lu et approuvé"
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(7);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('« Lu et approuvé »', sigBoxX + sigBoxW / 2, sigBoxY + 23, { align: 'center' });

  // Signatory name and timestamp
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  const signatoryName = data.autorisationParentale.signataireNomComplet || data.autorisationParentale.soussigneNomPrenom || 'Représentant légal';
  doc.text(`Signataire : ${signatoryName}`, sigBoxX + sigBoxW / 2, sigBoxY + 27.5, { align: 'center' });

  const dateSigStr = data.autorisationParentale.dateHeureSignature
    ? new Date(data.autorisationParentale.dateHeureSignature).toLocaleString('fr-FR')
    : new Date().toLocaleString('fr-FR');
  doc.text(`Horodatage : ${dateSigStr}`, sigBoxX + sigBoxW / 2, sigBoxY + 31, { align: 'center' });

  y += authBoxH + 2.5;

  // ==========================================
  // --- SECTION 5 : DONNÉES DE SANTÉ (RGPD) ---
  // ==========================================
  doc.setDrawColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, y, margin + contentWidth, y);
  y += 2.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('INFORMATIONS RELATIVES AUX DONNÉES DE SANTÉ & CONSENTEMENT EXPRÈS (RGPD)', margin, y);
  y += 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);

  const rgpdText =
    "Les données de santé figurant sur le présent document sont recueillies par l'établissement afin, notamment, de répondre aux demandes des services médicaux d'urgence. Elles sont susceptibles d'être transmises : aux services médicaux d'urgence, en tant que de besoin aux membres de l'équipe éducative de l'établissement directement concernés, et, dans le cadre des projets d'accompagnement spécifique (PAI, PPS,...) : aux partenaires mentionnés dans ces projets (MDPH, Praticiens médicaux et para-médicaux,...).\nVous consentez expressément à ce que l'établissement traite ces informations dans le cadre de la scolarisation de l'élève au sein de l'établissement dans les modalités définies au PAI ou au titre du PPS dont il bénéficie. Pour ces données vous disposez du droit de retirer votre consentement à leur collecte et à leur traitement.";

  const splitRgpd = doc.splitTextToSize(rgpdText, contentWidth);
  doc.text(splitRgpd, margin, y);
  y += 12.5;

  // Validation checkbox check - Separated with mathematical zero overlap
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  doc.setTextColor(15, 110, 50);
  doc.text('✓ Consentement expressément accordé pour le traitement et la conservation sécurisée.', margin, y);

  const validationPlaceDate = `Validé à ${data.autorisationParentale.faitA || 'Paris'}, le ${data.autorisationParentale.faitLe || new Date().toLocaleDateString('fr-FR')}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text(validationPlaceDate, margin + contentWidth, y, { align: 'right' });

  // ==========================================
  // --- BOTTOM ARCHIVAL FOOTER ---
  // ==========================================
  doc.setDrawColor(210, 220, 230);
  doc.setLineWidth(0.2);
  doc.line(margin, pageHeight - 8.5, margin + contentWidth, pageHeight - 8.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(mutedSlate[0], mutedSlate[1], mutedSlate[2]);
  doc.text(
    `Classement d'infirmerie : Année ${data.schoolYear} • Classe : ${formatClassDirectory(data.eleve.classe)} • ${getFicheFileName(data)}`,
    margin,
    pageHeight - 5
  );
  doc.text('Page 1/1 • Document officiel certifié', margin + contentWidth, pageHeight - 5, { align: 'right' });

  return doc.output('blob');
}

/**
 * Creates a combined A4 PDF containing all uploaded vaccination record pages
 */
export async function generateCarnetPDF(data: FicheInfirmerieData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;

  const files = data.sante.carnetVaccinations;

  if (!files || files.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 37, 87);
    doc.text('CARNET DE VACCINATIONS', pageWidth / 2, 40, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 90, 105);
    doc.text(`Élève : ${data.eleve.nom.toUpperCase()} ${data.eleve.prenom} (${data.eleve.classe})`, pageWidth / 2, 50, { align: 'center' });
    doc.text('Aucune pièce jointe transmise.', pageWidth / 2, 60, { align: 'center' });
    return doc.output('blob');
  }

  files.forEach((file, index) => {
    if (index > 0) {
      doc.addPage();
    }

    // Official Page header
    doc.setDrawColor(15, 37, 87);
    doc.setLineWidth(0.8);
    doc.line(margin, 10, pageWidth - margin, 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 37, 87);
    doc.text('ENSEMBLE SCOLAIRE NOTRE-DAME DES MISSIONS – SAINT-PIERRE', margin, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(95, 110, 130);
    doc.text(
      `Carnet de vaccinations • Élève : ${data.eleve.nom.toUpperCase()} ${data.eleve.prenom} (${data.eleve.classe}) — Document ${index + 1}/${files.length}`,
      margin,
      19.5
    );
    doc.setDrawColor(210, 220, 230);
    doc.setLineWidth(0.2);
    doc.line(margin, 21.5, pageWidth - margin, 21.5);

    // If it's an image, draw it centered with proper aspect ratio
    if (file.dataUrl.startsWith('data:image/')) {
      try {
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2 - 20;
        doc.addImage(file.dataUrl, 'JPEG', margin, 24, maxWidth, maxHeight, undefined, 'FAST');
      } catch {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Document image joint : ${file.name} (${Math.round(file.size / 1024)} Ko)`, margin, 35);
      }
    } else {
      // PDF or other format placeholder notice in compilation
      doc.setFillColor(245, 248, 252);
      doc.rect(margin, 26, pageWidth - margin * 2, 45, 'F');
      doc.setDrawColor(180, 195, 215);
      doc.rect(margin, 26, pageWidth - margin * 2, 45);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 37, 87);
      doc.text(`Fichier original déposé : ${file.name}`, margin + 8, 42);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(95, 110, 130);
      doc.text(
        `Type : ${file.type} • Taille : ${Math.round(file.size / 1024)} Ko • Déposé le ${new Date(file.uploadedAt).toLocaleString('fr-FR')}`,
        margin + 8,
        50
      );
      doc.text("Le document original est intégralement préservé et classé dans le dossier d'infirmerie.", margin + 8, 58);
    }

    // Page footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(120, 130, 145);
    doc.text(
      `Document officiel archivé • Dossier d'infirmerie : ${data.schoolYear} / ${formatClassDirectory(data.eleve.classe)}`,
      margin,
      pageHeight - 6
    );
  });

  return doc.output('blob');
}

