import { FicheInfirmerieData } from '../types';
import { SignaturePad } from './SignaturePad';
import { useSchoolName } from '../utils/branding';
import { FileCheck, Shield, CheckCircle2 } from 'lucide-react';

interface AuthorizationSectionProps {
  data: FicheInfirmerieData;
  onChange: (updater: (prev: FicheInfirmerieData) => FicheInfirmerieData) => void;
  onNext: () => void;
  onPrev: () => void;
  errors: Record<string, string>;
}

export function AuthorizationSection({ data, onChange, onNext, onPrev, errors }: AuthorizationSectionProps) {
  const nomEtab = useSchoolName();
  const updateAuth = (field: keyof FicheInfirmerieData['autorisationParentale'], value: any) => {
    onChange((prev) => ({
      ...prev,
      autorisationParentale: { ...prev.autorisationParentale, [field]: value },
    }));
  };

  const updateConsent = (checked: boolean) => {
    onChange((prev) => ({
      ...prev,
      consentementDonneesSante: {
        accepteCollecteEtTransmission: checked,
        dateConsentement: new Date().toISOString(),
      },
    }));
  };

  return (
    <div id="section-autorisation-signature" className="space-y-8">
      {/* 5. Autorisation parentale & Prise en charge d'urgence */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5 text-blue-950">
            <FileCheck className="w-5 h-5 text-blue-900" />
            <h2 className="text-base font-bold uppercase tracking-wide">
              5. Autorisation parentale de prise en charge
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reprise intégrale du texte officiel d'autorisation de l'établissement ({nomEtab}).
          </p>
        </div>

        {/* Déclarant */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Je, soussigné(e) (Nom et Prénom) <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={data.autorisationParentale.soussigneNomPrenom || data.responsableLegal.nom}
              onChange={(e) => updateAuth('soussigneNomPrenom', e.target.value)}
              placeholder="Ex: DUPONT Marc"
              className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                errors.soussigne ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
              }`}
            />
            {errors.soussigne && <p className="text-[11px] text-rose-600 mt-1">{errors.soussigne}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Qualité du soussigné <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'pere', label: 'Père' },
                { id: 'mere', label: 'Mère' },
                { id: 'autres', label: 'Autre' },
              ].map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => updateAuth('qualite', q.id)}
                  className={`py-2 px-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                    data.autorisationParentale.qualite === q.id
                      ? 'bg-blue-900 text-white border-blue-950 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Agissant en qualité de rep. légal de <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              readOnly
              value={`${data.eleve.prenom} ${data.eleve.nom}`.trim() || "L'élève"}
              className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-medium focus:outline-none cursor-not-allowed"
            />
          </div>
        </div>

        {data.autorisationParentale.qualite === 'autres' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Précision sur la qualité (Tuteur, Mandataire, etc.) <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={data.autorisationParentale.autreQualitePrecision || ''}
              onChange={(e) => updateAuth('autreQualitePrecision', e.target.value)}
              placeholder="Ex: Tuteur légal désigné par décision de justice"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none"
            />
          </div>
        )}

        {/* Legal Authorizations box */}
        <div className="p-4 sm:p-5 bg-blue-50/50 border border-blue-200 rounded-xl space-y-4 text-xs text-slate-800 leading-relaxed">
          <p className="font-bold text-blue-950 text-sm">AUTORISE EXPRESSÉMENT :</p>

          <div className="space-y-3 pl-1">
            <div className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-900 mt-2 shrink-0"></span>
              <p>
                <strong>{nomEtab}</strong> à prendre, le cas échéant, toutes mesures (visite médicale, hospitalisation, transport en voiture, intervention des secours – pompiers ou SAMU) rendues nécessaires par l'état de santé de mon enfant.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-900 mt-2 shrink-0"></span>
              <p>
                <strong>Le praticien</strong> à pratiquer tout examen médical ou chirurgical nécessaire à l'établissement d'un diagnostic, et toute intervention médicale ou chirurgicale y compris avec phase d'anesthésie-réanimation que nécessiterait l'état de santé de mon enfant.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-blue-200/70 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer bg-white p-3 rounded-lg border border-blue-200 shadow-2xs">
              <input
                type="checkbox"
                checked={data.autorisationParentale.accordPriseEnCharge}
                onChange={(e) => updateAuth('accordPriseEnCharge', e.target.checked)}
                className="mt-0.5 rounded text-blue-900 focus:ring-blue-900 w-4 h-4"
              />
              <span className="text-xs font-bold text-slate-900">
                Je valide expressément l'autorisation de prise en charge d'urgence et d'interventions médicales pour mon enfant. <span className="text-rose-600">*</span>
              </span>
            </label>
            {errors.accordPriseEnCharge && (
              <p className="text-[11px] text-rose-600 font-semibold">{errors.accordPriseEnCharge}</p>
            )}
          </div>
        </div>

        {/* Fait à et le */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Fait à <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={data.autorisationParentale.faitA}
              onChange={(e) => updateAuth('faitA', e.target.value)}
              placeholder="Ex: Charenton-le-Pont"
              className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                errors.faitA ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
              }`}
            />
            {errors.faitA && <p className="text-[11px] text-rose-600 mt-1">{errors.faitA}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Date du jour <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={data.autorisationParentale.faitLe || new Date().toLocaleDateString('fr-FR')}
              onChange={(e) => updateAuth('faitLe', e.target.value)}
              placeholder="JJ/MM/AAAA"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Signature Pad */}
        <div className="pt-2">
          <SignaturePad
            value={data.autorisationParentale.signatureDataUrl}
            signerName={data.autorisationParentale.soussigneNomPrenom || data.responsableLegal.nom}
            onChange={(dataUrl) => {
              updateAuth('signatureDataUrl', dataUrl);
              updateAuth('dateHeureSignature', new Date().toISOString());
              updateAuth('signataireNomComplet', data.autorisationParentale.soussigneNomPrenom || data.responsableLegal.nom);
              updateAuth('mentionLuEtApprouve', true);
            }}
          />
          {errors.signature && (
            <p className="text-xs text-rose-600 font-semibold mt-1.5">{errors.signature}</p>
          )}
        </div>
      </div>

      {/* 6. Informations relatives aux données de santé & Consentement RGPD */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 text-blue-950 pb-2 border-b border-slate-100">
          <Shield className="w-5 h-5 text-blue-900" />
          <h2 className="text-base font-bold uppercase tracking-wide">
            6. Informations relatives aux données de santé & Consentement (RGPD)
          </h2>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs text-slate-700 leading-relaxed">
          <p>
            Les données de santé figurant sur le présent document sont recueillies par l'établissement afin, notamment, de répondre aux demandes des services médicaux d'urgence.
          </p>
          <p className="font-semibold text-slate-800">Elles sont susceptibles d'être transmises :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>aux services médicaux d'urgence,</li>
            <li>en tant que de besoin aux membres de l'équipe éducative de l'établissement directement concernés,</li>
            <li>et, dans le cadre des projets d'accompagnement spécifique (PAI, PPS,...) : aux partenaires mentionnés dans ces projets (MDPH, Praticiens médicaux et para-médicaux,...).</li>
          </ul>
          <p>
            Vous consentez expressément à ce que l'établissement traite ces informations dans le cadre de la scolarisation de l'élève au sein de l'établissement dans les modalités définies au PAI ou au titre du PPS dont il bénéficie. Pour ces données vous disposez du droit de retirer votre consentement à leur collecte et à leur traitement.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition-colors">
          <input
            type="checkbox"
            checked={data.consentementDonneesSante.accepteCollecteEtTransmission}
            onChange={(e) => updateConsent(e.target.checked)}
            className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-600 w-4 h-4"
          />
          <div className="text-xs">
            <span className="font-bold text-emerald-950 block">
              Consentement exprès pour le traitement des données de santé <span className="text-rose-600">*</span>
            </span>
            <span className="text-slate-600">
              Je consens expressément à la collecte, au traitement et à la transmission éventuelle de ces données médicales dans le respect strict des finalités d'urgence et de scolarisation mentionnées ci-dessus.
            </span>
          </div>
        </label>
        {errors.consentement && (
          <p className="text-xs text-rose-600 font-semibold">{errors.consentement}</p>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors"
        >
          ← Retour à l'Urgence & Santé
        </button>

        <button
          type="button"
          onClick={onNext}
          className="px-6 py-3 bg-blue-900 text-white rounded-xl font-bold text-sm shadow-xs hover:bg-blue-800 transition-colors flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          Vérifier et relire avant transmission →
        </button>
      </div>
    </div>
  );
}
