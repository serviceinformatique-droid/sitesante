import { FicheInfirmerieData } from '../types';
import { FileText, User, Users, PhoneCall, HeartPulse, ShieldCheck, Edit3, Send, CheckCircle2 } from 'lucide-react';

interface ReviewModalOrStepProps {
  data: FicheInfirmerieData;
  onEditSection: (stepIndex: number) => void;
  onFinalSubmit: () => void;
  isSubmitting: boolean;
}

export function ReviewModalOrStep({
  data,
  onEditSection,
  onFinalSubmit,
  isSubmitting,
}: ReviewModalOrStepProps) {
  const getVacLabel = (status: string) => {
    switch (status) {
      case 'a_jour':
        return 'À jour';
      case 'non':
        return 'Non à jour';
      case 'non_realise':
        return 'Non réalisé';
      default:
        return 'Inconnu';
    }
  };

  return (
    <div id="recapitulatif-validation" className="space-y-6">
      {/* Banner */}
      <div className="bg-blue-950 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-blue-300">
            Étape 4 sur 4 • Vérification préalable
          </span>
          <h2 className="text-lg font-bold mt-0.5">
            Récapitulatif et validation de la fiche infirmerie
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Veuillez relire attentivement l'intégralité des éléments. Dès la confirmation, la fiche sera verrouillée, signée numériquement et enregistrée à l'infirmerie.
          </p>
        </div>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={onFinalSubmit}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Génération & Transmission...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Confirmer & Signer définitivement</span>
            </>
          )}
        </button>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Section 1 : Élève */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs relative">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wide flex items-center gap-2">
              <User className="w-4 h-4 text-blue-900" /> 1. Identité de l'élève
            </h3>
            <button
              type="button"
              onClick={() => onEditSection(0)}
              className="text-xs text-blue-900 hover:underline flex items-center gap-1 font-semibold"
            >
              <Edit3 className="w-3.5 h-3.5" /> Modifier
            </button>
          </div>

          <dl className="text-xs grid grid-cols-2 gap-y-2 text-slate-700">
            <div>
              <dt className="text-slate-400">Classe :</dt>
              <dd className="font-bold text-slate-900">{data.eleve.classe || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Nom & Prénom :</dt>
              <dd className="font-bold text-slate-900">{data.eleve.nom} {data.eleve.prenom}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Date de naissance :</dt>
              <dd className="font-medium text-slate-800">{data.eleve.dateNaissance || '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Ville & Code postal :</dt>
              <dd className="font-medium text-slate-800">{data.eleve.codePostal} {data.eleve.ville}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">Adresse :</dt>
              <dd className="font-medium text-slate-800">{data.eleve.adresse || '-'}</dd>
            </div>
            <div className="col-span-2 pt-1 border-t border-slate-100">
              <dt className="text-slate-400">Médecin traitant :</dt>
              <dd className="font-semibold text-slate-900">Dr {data.eleve.nomMedecinTraitant} — {data.eleve.telMedecinTraitant}</dd>
            </div>
          </dl>
        </div>

        {/* Section 2 : Responsables */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs relative">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wide flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-900" /> 2. Responsables légaux
            </h3>
            <button
              type="button"
              onClick={() => onEditSection(0)}
              className="text-xs text-blue-900 hover:underline flex items-center gap-1 font-semibold"
            >
              <Edit3 className="w-3.5 h-3.5" /> Modifier
            </button>
          </div>

          <dl className="text-xs grid grid-cols-2 gap-y-2 text-slate-700">
            <div>
              <dt className="text-slate-400">Responsable :</dt>
              <dd className="font-bold text-slate-900">{data.responsableLegal.nom}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Qualité :</dt>
              <dd className="font-medium text-slate-800 capitalize">{data.responsableLegal.statut.replace('_', ' ')}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">Tél. personnel :</dt>
              <dd className="font-semibold text-slate-900">{data.responsableLegal.telPersonnel}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Tél. pro mère :</dt>
              <dd className="font-medium text-slate-800">
                {data.responsableLegal.telTravailMereNonConcerne ? 'Non concerné' : data.responsableLegal.telTravailMere || 'Non concerné'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Tél. pro père :</dt>
              <dd className="font-medium text-slate-800">
                {data.responsableLegal.telTravailPereNonConcerne ? 'Non concerné' : data.responsableLegal.telTravailPere || 'Non concerné'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Section 3 : Contact en cas d'accident */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs relative">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wide flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-blue-900" /> 3. Contact en cas d'accident
            </h3>
            <button
              type="button"
              onClick={() => onEditSection(1)}
              className="text-xs text-blue-900 hover:underline flex items-center gap-1 font-semibold"
            >
              <Edit3 className="w-3.5 h-3.5" /> Modifier
            </button>
          </div>

          <dl className="text-xs space-y-1.5 text-slate-700">
            <div>
              <dt className="text-slate-400">Personne à appeler :</dt>
              <dd className="font-bold text-slate-900">{data.urgenceAccident.nomPrenom}</dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-slate-400">Tél. personnel :</dt>
                <dd className="font-semibold text-slate-900">{data.urgenceAccident.telPersonnel}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Tél. travail :</dt>
                <dd className="font-medium text-slate-800">
                  {data.urgenceAccident.telTravailNonConcerne ? 'Non concerné' : data.urgenceAccident.telTravail || 'Non concerné'}
                </dd>
              </div>
            </div>
            <div>
              <dt className="text-slate-400">Adresse du contact :</dt>
              <dd className="font-medium text-slate-800">{data.urgenceAccident.adresse}</dd>
            </div>
          </dl>
        </div>

        {/* Section 4 : Vaccinations & Carnet */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs relative">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wide flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-blue-900" /> 4. Vaccinations & Carnet
            </h3>
            <button
              type="button"
              onClick={() => onEditSection(1)}
              className="text-xs text-blue-900 hover:underline flex items-center gap-1 font-semibold"
            >
              <Edit3 className="w-3.5 h-3.5" /> Modifier
            </button>
          </div>

          <div className="text-xs space-y-2">
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <span className="text-slate-600">Polio : <strong>{getVacLabel(data.sante.vaccinations.antipoliomyelitique.status)}</strong></span>
              <span className="text-slate-600">Diphtérie : <strong>{getVacLabel(data.sante.vaccinations.antidiphterique.status)}</strong></span>
              <span className="text-slate-600">Tétanos : <strong>{getVacLabel(data.sante.vaccinations.antitetanique.status)}</strong></span>
              <span className="text-slate-600">Coqueluche : <strong>{getVacLabel(data.sante.vaccinations.anticoqueluche.status)}</strong></span>
              <span className="text-slate-600">BCG : <strong>{getVacLabel(data.sante.vaccinations.antituberculeux_bcg.status)}</strong></span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-slate-500">Carnet de vaccinations :</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ✓ {data.sante.carnetVaccinations.length} document(s) joint(s)
              </span>
            </div>

            <div className="pt-1">
              <span className="text-slate-400 block">Allergies / Difficultés :</span>
              <p className="font-medium text-slate-800 text-[11px] bg-slate-50 p-2 rounded-lg mt-0.5">
                {data.sante.allergiesDifficultesSante}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5 : Signature & Accord */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wide flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> 5. Autorisation & Signature électronique certifiée
          </h3>
          <button
            type="button"
            onClick={() => onEditSection(2)}
            className="text-xs text-blue-900 hover:underline flex items-center gap-1 font-semibold"
          >
            <Edit3 className="w-3.5 h-3.5" /> Modifier
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="text-xs space-y-1.5 text-slate-700">
            <p>
              Signataire : <strong>{data.autorisationParentale.soussigneNomPrenom || data.responsableLegal.nom}</strong>
            </p>
            <p>
              Fait à : <strong>{data.autorisationParentale.faitA}</strong>, le <strong>{data.autorisationParentale.faitLe}</strong>
            </p>
            <div className="flex items-center gap-2 text-emerald-700 font-semibold pt-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Autorisation de soins & consentement RGPD cochés</span>
            </div>
          </div>

          <div className="flex flex-col items-center sm:items-end justify-center">
            <div className="border border-slate-300 rounded-xl p-2 bg-slate-50 inline-block text-center">
              {data.autorisationParentale.signatureDataUrl ? (
                <img
                  src={data.autorisationParentale.signatureDataUrl}
                  alt="Signature électronique"
                  className="h-16 w-44 object-contain bg-white rounded-lg border border-slate-200"
                />
              ) : (
                <div className="h-16 w-44 flex items-center justify-center text-xs text-slate-400 bg-white rounded-lg border">
                  Aucune signature
                </div>
              )}
              <span className="text-[11px] font-serif italic text-blue-950 block mt-1">
                « Lu et approuvé »
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Submit Action */}
      <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onEditSection(2)}
          className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors w-full sm:w-auto text-center"
        >
          ← Revenir aux autorisations
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={onFinalSubmit}
          className="px-8 py-3.5 bg-blue-950 hover:bg-blue-900 disabled:bg-slate-600 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Traitement en cours...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4 text-emerald-400" />
              <span>Valider définitivement et transmettre le dossier</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
