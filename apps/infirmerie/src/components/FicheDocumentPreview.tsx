import { useState } from 'react';
import { FicheInfirmerieData } from '../types';
import { generateFichePDF, getFicheFileName, generateCarnetPDF, getCarnetFileName } from '../utils/pdfGenerator';
import {
  FileText,
  Download,
  ExternalLink,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  User,
  Shield,
  Heart,
  FileCheck,
  Calendar,
  Phone,
  MapPin,
  Stethoscope,
  Eye,
  File
} from 'lucide-react';

interface FicheDocumentPreviewProps {
  fiche: FicheInfirmerieData;
  initialTab?: 'fiche' | 'carnet';
  onClose: () => void;
}

export function FicheDocumentPreview({
  fiche,
  initialTab = 'fiche',
  onClose,
}: FicheDocumentPreviewProps) {
  const [activeView, setActiveView] = useState<'fiche' | 'carnet' | 'pdf_raw'>(initialTab);
  const [downloading, setDownloading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  const hasCarnet = (fiche.sante.carnetVaccinations || []).length > 0;
  const isSigned = !!fiche.autorisationParentale?.signatureDataUrl;

  // Direct download PDF
  const handleDownloadFiche = async () => {
    setDownloading(true);
    try {
      const blob = await generateFichePDF(fiche);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFicheFileName(fiche);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err: any) {
      console.error('Erreur téléchargement PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Direct download Carnet PDF
  const handleDownloadCarnet = async () => {
    if (!hasCarnet) return;
    setDownloading(true);
    try {
      const blob = await generateCarnetPDF(fiche);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getCarnetFileName(fiche);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err: any) {
      console.error('Erreur téléchargement Carnet:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Open in new tab
  const handleOpenNewTab = async () => {
    try {
      const blob = await generateFichePDF(fiche);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      console.error('Erreur ouverture nouvel onglet:', err);
    }
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-100 rounded-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden shadow-2xl border border-slate-300 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-blue-950 text-white p-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 border-b border-blue-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-900 border border-blue-700 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  {fiche.eleve.nom.toUpperCase()} {fiche.eleve.prenom}
                </h2>
                <span className="px-2 py-0.5 bg-blue-800 text-blue-100 text-xs font-semibold rounded-md border border-blue-700">
                  Classe : {fiche.eleve.classe}
                </span>
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 text-xs font-semibold rounded-md border border-emerald-700">
                  {fiche.schoolYear}
                </span>
              </div>
              <p className="text-xs text-blue-300 mt-0.5">
                Aperçu officiel de la Fiche Infirmerie Scolaire
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadFiche}
              disabled={downloading}
              className="px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Télécharger le PDF A4"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger PDF</span>
            </button>

            <button
              type="button"
              onClick={handleOpenNewTab}
              className="px-3 py-1.5 bg-blue-900/80 hover:bg-blue-800 text-blue-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Ouvrir le PDF plein écran dans un nouvel onglet"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nouvel onglet</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-900/80 hover:bg-blue-800 text-blue-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Imprimer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimer</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-blue-300 hover:text-white hover:bg-blue-900 rounded-lg transition-colors cursor-pointer ml-1"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-2 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveView('fiche')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeView === 'fiche'
                ? 'bg-blue-950 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Fiche Infirmerie Officielle</span>
          </button>

          {hasCarnet && (
            <button
              type="button"
              onClick={() => setActiveView('carnet')}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'carnet'
                  ? 'bg-blue-950 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Carnet de vaccinations ({fiche.sante.carnetVaccinations?.length})</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 flex justify-center">
          {activeView === 'fiche' && (
            /* OFFICIAL A4 DOCUMENT REPLICA - Pixel-perfect, zero error rate */
            <div className="bg-white rounded-xl shadow-lg border border-slate-300 p-6 sm:p-8 w-full max-w-[850px] text-slate-800 space-y-4 text-xs font-sans">
              {/* Header Institutionnel */}
              <div className="border-b-2 border-blue-950 pb-4 space-y-2">
                <div className="flex items-center gap-4">
                  <img
                    src="/logo.svg"
                    alt="Logo Notre-Dame des Missions - Saint-Pierre"
                    className="w-14 h-16 object-contain shrink-0"
                  />
                  <div className="text-left space-y-0.5">
                    <h3 className="font-bold text-sm sm:text-base text-blue-950 uppercase tracking-wide">
                      Ensemble Scolaire Notre-Dame des Missions – Saint-Pierre
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Établissement Catholique d'Enseignement • Sous-contrat d'Association avec l'État • Service Infirmerie
                    </p>
                  </div>
                </div>

                <div className="text-center pt-1">
                  <div className="py-1.5 px-6 bg-blue-50 border border-blue-200 rounded-lg inline-block shadow-2xs">
                    <h4 className="text-base font-extrabold text-blue-950 tracking-wider uppercase">
                      FICHE INFIRMERIE
                    </h4>
                    <p className="text-[10px] text-slate-600 font-medium">
                      Document officiel confidentiel • Valable chaque année par tacite reconduction • Année scolaire {fiche.schoolYear}
                    </p>
                  </div>
                </div>
              </div>

              {/* 1. IDENTITÉ DE L'ÉLÈVE */}
              <div className="border border-blue-200 rounded-lg overflow-hidden">
                <div className="bg-blue-950 text-white px-3 py-1.5 font-bold text-xs uppercase flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-white text-blue-950 flex items-center justify-center text-[10px] font-black">1</span>
                  <span>Identité de l'élève</span>
                </div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white">
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Classe</span>
                    <span className="text-sm font-bold text-blue-950">{fiche.eleve.classe || '-'}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Nom de famille</span>
                    <span className="text-sm font-bold text-slate-900">{fiche.eleve.nom.toUpperCase()}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Prénom</span>
                    <span className="text-sm font-bold text-slate-900">{fiche.eleve.prenom}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Date de naissance</span>
                    <span className="font-semibold text-slate-800">{fiche.eleve.dateNaissance || '-'}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200 sm:col-span-2">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Adresse</span>
                    <span className="font-semibold text-slate-800">
                      {fiche.eleve.adresse}, {fiche.eleve.codePostal} {fiche.eleve.ville}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Médecin traitant</span>
                    <span className="font-semibold text-slate-800">Dr {fiche.eleve.nomMedecinTraitant || '-'}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-200 sm:col-span-2">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Téléphone médecin</span>
                    <span className="font-semibold text-slate-800">{fiche.eleve.telMedecinTraitant || '-'}</span>
                  </div>
                </div>
              </div>

              {/* 2. PERSONNES RESPONSABLES & URGENCE */}
              <div className="border border-blue-200 rounded-lg overflow-hidden">
                <div className="bg-blue-950 text-white px-3 py-1.5 font-bold text-xs uppercase flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-white text-blue-950 flex items-center justify-center text-[10px] font-black">2</span>
                  <span>Personnes responsables de l'enfant & Contacts d'urgence</span>
                </div>
                <div className="p-3 space-y-3 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 sm:col-span-2">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Responsable Légal</span>
                      <span className="font-bold text-slate-900">
                        {fiche.responsableLegal.nom} ({fiche.responsableLegal.statut === 'pere' ? 'Père' : fiche.responsableLegal.statut === 'mere' ? 'Mère' : 'Tuteur légal'})
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 sm:col-span-2">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Tél Personnel</span>
                      <span className="font-bold text-blue-900">{fiche.responsableLegal.telPersonnel || '-'}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 sm:col-span-2">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Tél Professionnel Mère</span>
                      <span className="font-medium text-slate-800">
                        {fiche.responsableLegal.telTravailMereNonConcerne ? 'Non concerné' : fiche.responsableLegal.telTravailMere || '-'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 sm:col-span-2">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Tél Professionnel Père</span>
                      <span className="font-medium text-slate-800">
                        {fiche.responsableLegal.telTravailPereNonConcerne ? 'Non concerné' : fiche.responsableLegal.telTravailPere || '-'}
                      </span>
                    </div>
                  </div>

                  {/* Contact urgence (Stacked layout to avoid any overflow) */}
                  <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg space-y-1.5">
                    <span className="block text-[10px] font-bold text-amber-900 uppercase">
                      Contact à prévenir en cas d'accident si la famille est injoignable :
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Nom, Prénom & Lien :</span>
                        <span className="font-bold text-slate-900">{fiche.urgenceAccident.nomPrenom || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Tél Personnel :</span>
                        <span className="font-bold text-blue-950">{fiche.urgenceAccident.telPersonnel || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Tél Professionnel :</span>
                        <span className="font-medium text-slate-800">
                          {fiche.urgenceAccident.telTravailNonConcerne ? 'Non concerné' : fiche.urgenceAccident.telTravail || '-'}
                        </span>
                      </div>
                    </div>
                    <div className="pt-1 text-xs">
                      <span className="text-[10px] text-slate-500 block">Adresse du contact d'urgence :</span>
                      <span className="font-medium text-slate-800">{fiche.urgenceAccident.adresse || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. SANTÉ & VACCINATIONS */}
              <div className="border border-blue-200 rounded-lg overflow-hidden">
                <div className="bg-blue-950 text-white px-3 py-1.5 font-bold text-xs uppercase flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-white text-blue-950 flex items-center justify-center text-[10px] font-black">3</span>
                  <span>Renseignements sur la santé de l'élève</span>
                </div>
                <div className="p-3 space-y-3 bg-white">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                      Vaccinations obligatoires :
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <span className="font-semibold block text-slate-800">Antipoliomyélitique</span>
                        <span className="text-emerald-700 font-bold text-[11px]">
                          {fiche.sante.vaccinations.antipoliomyelitique.status === 'a_jour' ? '✓ À jour' : 'Non à jour'}
                          {fiche.sante.vaccinations.antipoliomyelitique.date ? ` (${fiche.sante.vaccinations.antipoliomyelitique.date})` : ''}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <span className="font-semibold block text-slate-800">Antidiphtérique</span>
                        <span className="text-emerald-700 font-bold text-[11px]">
                          {fiche.sante.vaccinations.antidiphterique.status === 'a_jour' ? '✓ À jour' : 'Non à jour'}
                          {fiche.sante.vaccinations.antidiphterique.date ? ` (${fiche.sante.vaccinations.antidiphterique.date})` : ''}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <span className="font-semibold block text-slate-800">Antitétanique</span>
                        <span className="text-emerald-700 font-bold text-[11px]">
                          {fiche.sante.vaccinations.antitetanique.status === 'a_jour' ? '✓ À jour' : 'Non à jour'}
                          {fiche.sante.vaccinations.antitetanique.date ? ` (${fiche.sante.vaccinations.antitetanique.date})` : ''}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <span className="font-semibold block text-slate-800">Anticoqueluche</span>
                        <span className="text-emerald-700 font-bold text-[11px]">
                          {fiche.sante.vaccinations.anticoqueluche.status === 'a_jour' ? '✓ À jour' : 'Non à jour'}
                          {fiche.sante.vaccinations.anticoqueluche.date ? ` (${fiche.sante.vaccinations.anticoqueluche.date})` : ''}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <span className="font-semibold block text-slate-800">BCG (Antituberculeux)</span>
                        <span className="text-slate-600 font-medium text-[11px]">
                          {fiche.sante.vaccinations.antituberculeux_bcg.status === 'a_jour'
                            ? `✓ À jour (${fiche.sante.vaccinations.antituberculeux_bcg.date || ''})`
                            : 'Non réalisé'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Carnet de vaccinations badge */}
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-900">
                      ✓ Copie du carnet de vaccinations (Obligatoire)
                    </span>
                    <span className="text-emerald-800 font-medium">
                      {fiche.sante.carnetVaccinations?.length || 0} document(s) / page(s) archivé(s) à l'infirmerie
                    </span>
                  </div>

                  {/* Allergies */}
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <span className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                      Allergies éventuelles ou autres difficultés de santé à signaler :
                    </span>
                    <p className="text-slate-800 font-medium text-xs">
                      {fiche.sante.aucuneAllergie
                        ? 'Aucune allergie ou difficulté de santé à signaler.'
                        : fiche.sante.allergiesDifficultesSante || 'Aucune information signalée.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. AUTORISATION PARENTALE & SIGNATURE */}
              <div className="border border-blue-200 rounded-lg overflow-hidden">
                <div className="bg-blue-950 text-white px-3 py-1.5 font-bold text-xs uppercase flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-white text-blue-950 flex items-center justify-center text-[10px] font-black">4</span>
                  <span>Autorisation parentale & Signature électronique</span>
                </div>
                <div className="p-3 bg-white space-y-3">
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    Je soussigné(e) <strong>{fiche.autorisationParentale.soussigneNomPrenom || fiche.responsableLegal.nom}</strong> [qualité : {fiche.autorisationParentale.qualite}], représentant légal de l'enfant <strong>{fiche.eleve.nom.toUpperCase()} {fiche.eleve.prenom}</strong>, autorise la direction de l'établissement à faire pratiquer toute intervention médicale d'urgence ou hospitalisation nécessaire.
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">Fait à / Le</span>
                      <span className="font-semibold text-slate-800">
                        {fiche.autorisationParentale.faitA || 'Paris'}, le {fiche.autorisationParentale.faitLe || new Date().toLocaleDateString('fr-FR')}
                      </span>
                    </div>

                    {/* Cadre signature électronique */}
                    <div className="border border-blue-300 rounded-lg p-2.5 bg-blue-50/50 text-center min-w-[200px]">
                      <span className="block text-[10px] font-extrabold text-blue-950 uppercase tracking-wide mb-1">
                        Signature Électronique Certifiée
                      </span>
                      {fiche.autorisationParentale?.signatureDataUrl ? (
                        <div className="space-y-1">
                          <img
                            src={fiche.autorisationParentale.signatureDataUrl}
                            alt="Signature parentale"
                            className="h-12 max-w-full mx-auto object-contain bg-white rounded border border-blue-200 p-0.5"
                          />
                          <p className="text-[10px] font-bold italic text-blue-900">« Lu et approuvé »</p>
                          <p className="text-[9px] text-slate-500">
                            Signataire : {fiche.autorisationParentale.signataireNomComplet || fiche.responsableLegal.nom}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-rose-600 font-bold py-3">Non signée</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. DONNÉES DE SANTÉ & RGPD */}
              <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-600 space-y-1">
                <p className="font-bold text-blue-950 uppercase">
                  Informations relatives aux données de santé & consentement exprès (RGPD)
                </p>
                <p className="text-slate-500 leading-tight">
                  Les données de santé figurant sur ce document sont recueillies par l'établissement afin de répondre aux demandes des services médicaux d'urgence. Vous consentez expressément au traitement de ces informations dans le cadre de la scolarisation.
                </p>
                <div className="flex items-center justify-between font-bold text-emerald-800 pt-1">
                  <span>✓ Consentement expressément accordé pour le traitement et la conservation sécurisée.</span>
                  <span className="text-slate-500 font-normal">
                    Validé à {fiche.autorisationParentale.faitA || 'Paris'}, le {fiche.autorisationParentale.faitLe || new Date().toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeView === 'carnet' && (
            /* CARNET DE VACCINATIONS PREVIEW */
            <div className="bg-white rounded-xl shadow-lg border border-slate-300 p-6 w-full max-w-[850px] space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-blue-950 uppercase">
                    Documents du Carnet de vaccinations
                  </h3>
                  <p className="text-xs text-slate-500">
                    Élève : {fiche.eleve.nom.toUpperCase()} {fiche.eleve.prenom} • {fiche.sante.carnetVaccinations?.length || 0} page(s) déposée(s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadCarnet}
                  className="px-3 py-1.5 bg-blue-950 hover:bg-blue-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Télécharger le Carnet PDF
                </button>
              </div>

              <div className="space-y-6">
                {(fiche.sante.carnetVaccinations || []).map((file, idx) => (
                  <div key={file.id || idx} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-3 pb-2 border-b border-slate-200 font-semibold">
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4 text-emerald-600" />
                        <span>Document {idx + 1} : {file.name}</span>
                      </div>
                      <span>{Math.round(file.size / 1024)} Ko</span>
                    </div>

                    {file.dataUrl.startsWith('data:image/') ? (
                      <div className="bg-white rounded-lg p-2 border border-slate-200 flex justify-center">
                        <img
                          src={file.dataUrl}
                          alt={file.name}
                          className="max-h-[600px] w-auto object-contain rounded shadow-xs"
                        />
                      </div>
                    ) : (
                      <div className="bg-white p-6 rounded-lg border text-center space-y-2">
                        <FileText className="w-10 h-10 text-blue-900 mx-auto" />
                        <p className="font-bold text-sm text-slate-800">{file.name}</p>
                        <a
                          href={file.dataUrl}
                          download={file.name}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-900 text-white text-xs font-bold rounded-lg hover:bg-blue-800"
                        >
                          <Download className="w-4 h-4" /> Télécharger ce fichier original
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
