import { FicheInfirmerieData, VaccinationStatus } from '../types';
import { VaccinationUpload } from './VaccinationUpload';
import { AlertTriangle, ShieldCheck, HeartPulse, PhoneCall, MapPin, CheckCircle2 } from 'lucide-react';

interface HealthFormSectionProps {
  data: FicheInfirmerieData;
  onChange: (updater: (prev: FicheInfirmerieData) => FicheInfirmerieData) => void;
  onNext: () => void;
  onPrev: () => void;
  errors: Record<string, string>;
}

export function HealthFormSection({ data, onChange, onNext, onPrev, errors }: HealthFormSectionProps) {
  const updateUrg = (field: keyof FicheInfirmerieData['urgenceAccident'], value: any) => {
    onChange((prev) => ({
      ...prev,
      urgenceAccident: { ...prev.urgenceAccident, [field]: value },
    }));
  };

  const updateVaccination = (
    vacKey: keyof FicheInfirmerieData['sante']['vaccinations'],
    status: VaccinationStatus,
    date?: string
  ) => {
    onChange((prev) => ({
      ...prev,
      sante: {
        ...prev.sante,
        vaccinations: {
          ...prev.sante.vaccinations,
          [vacKey]: {
            ...prev.sante.vaccinations[vacKey],
            status,
            ...(date !== undefined ? { date } : {}),
          },
        },
      },
    }));
  };

  const setAllergies = (text: string, aucune: boolean) => {
    onChange((prev) => ({
      ...prev,
      sante: {
        ...prev.sante,
        allergiesDifficultesSante: aucune ? 'Aucune allergie ou difficulté de santé à signaler.' : text,
        aucuneAllergie: aucune,
      },
    }));
  };

  const vaccList = [
    { key: 'antipoliomyelitique', label: 'Antipoliomyélitique (Polio)' },
    { key: 'antidiphterique', label: 'Antidiphtérique (Diphtérie)' },
    { key: 'antitetanique', label: 'Antitétanique (Tétanos)' },
    { key: 'anticoqueluche', label: 'Anticoqueluche (Coqueluche)' },
    { key: 'antituberculeux_bcg', label: 'Antituberculeux (BCG)' },
  ] as const;

  return (
    <div id="section-urgence-sante" className="space-y-8">
      {/* 3. Personne en cas d'accident */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5 text-blue-950">
            <PhoneCall className="w-5 h-5 text-blue-900" />
            <h2 className="text-base font-bold uppercase tracking-wide">
              3. Personne pouvant être appelée rapidement en cas d'accident
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cette personne peut être différente du responsable légal (proche, grands-parents, voisin de confiance).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Nom et prénom */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nom et prénom du contact <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={data.urgenceAccident.nomPrenom}
              onChange={(e) => updateUrg('nomPrenom', e.target.value)}
              placeholder="Ex: DUPONT Éléonore (Grand-mère)"
              className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                errors.urgenceNomPrenom ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
              }`}
            />
            {errors.urgenceNomPrenom && <p className="text-[11px] text-rose-600 mt-1">{errors.urgenceNomPrenom}</p>}
          </div>

          {/* Numéro de tél personnel */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Numéro de tél. personnel <span className="text-rose-600">*</span>
            </label>
            <input
              type="tel"
              value={data.urgenceAccident.telPersonnel}
              onChange={(e) => updateUrg('telPersonnel', e.target.value)}
              placeholder="Ex: 06 98 76 54 32"
              className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                errors.urgenceTelPersonnel ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
              }`}
            />
            {errors.urgenceTelPersonnel && <p className="text-[11px] text-rose-600 mt-1">{errors.urgenceTelPersonnel}</p>}
          </div>

          {/* Numéro de tél travail */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Numéro de tél. de travail <span className="text-rose-600">*</span>
            </label>
            <input
              type="tel"
              disabled={data.urgenceAccident.telTravailNonConcerne}
              value={data.urgenceAccident.telTravailNonConcerne ? 'Non concerné' : data.urgenceAccident.telTravail}
              onChange={(e) => updateUrg('telTravail', e.target.value)}
              placeholder="Ex: 01 43 00 00 00"
              className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 ${
                errors.urgenceTelTravail ? 'border-rose-500' : 'border-slate-300'
              }`}
            />
            <label className="flex items-center gap-2 cursor-pointer pt-1.5">
              <input
                type="checkbox"
                checked={data.urgenceAccident.telTravailNonConcerne}
                onChange={(e) => {
                  const checked = e.target.checked;
                  updateUrg('telTravailNonConcerne', checked);
                  if (checked) {
                    updateUrg('telTravail', 'Non concerné');
                  } else {
                    updateUrg('telTravail', '');
                  }
                }}
                className="rounded text-blue-900 focus:ring-blue-900"
              />
              <span className="text-xs text-slate-600 font-medium">Non concerné</span>
            </label>
            {errors.urgenceTelTravail && <p className="text-[11px] text-rose-600 mt-1">{errors.urgenceTelTravail}</p>}
          </div>
        </div>

        {/* Adresse du contact d'urgence */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Adresse complète du contact d'urgence <span className="text-rose-600">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={data.urgenceAccident.adresse}
              onChange={(e) => updateUrg('adresse', e.target.value)}
              placeholder="Ex: 8 Avenue Victor Hugo, 94220 Charenton-le-Pont"
              className={`w-full pl-9 pr-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                errors.urgenceAdresse ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
              }`}
            />
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
          {errors.urgenceAdresse && <p className="text-[11px] text-rose-600 mt-1">{errors.urgenceAdresse}</p>}
        </div>
      </div>

      {/* 4. Renseignements sur la santé de l'élève & Vaccinations */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5 text-blue-950">
            <HeartPulse className="w-5 h-5 text-blue-900" />
            <h2 className="text-base font-bold uppercase tracking-wide">
              4. Renseignements sur la santé de l'élève
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Vaccinations obligatoires selon le calendrier vaccinal officiel et carnet de vaccinations.
          </p>
        </div>

        {/* Vaccinations table */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
            Statut des vaccinations obligatoires <span className="text-rose-600">*</span>
          </label>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
            {vaccList.map(({ key, label }) => {
              const item = data.sante.vaccinations[key];
              return (
                <div key={key} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="sm:w-1/3">
                    <span className="text-xs font-semibold text-slate-800 block">
                      {label}
                    </span>
                    <span className="text-[11px] text-slate-400">Vaccination obligatoire</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:w-2/3 justify-start sm:justify-end">
                    {[
                      { id: 'a_jour', label: 'À jour' },
                      { id: 'non', label: 'Non à jour' },
                      { id: 'non_realise', label: 'Non réalisé' },
                      { id: 'inconnu', label: 'Inconnu' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateVaccination(key, opt.id as VaccinationStatus)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                          item.status === opt.id
                            ? opt.id === 'a_jour'
                              ? 'bg-emerald-600 border-emerald-700 text-white shadow-2xs font-semibold'
                              : 'bg-blue-900 border-blue-950 text-white shadow-2xs font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {item.status === opt.id && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                        {opt.label}
                      </button>
                    ))}

                    {item.status === 'a_jour' && (
                      <input
                        type="text"
                        value={item.date || ''}
                        onChange={(e) => updateVaccination(key, item.status, e.target.value)}
                        placeholder="Date (ex: 2024)"
                        className="text-xs px-2.5 py-1.5 w-24 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dépôt obligatoire du carnet de vaccination */}
        <div className="pt-2">
          <VaccinationUpload
            files={data.sante.carnetVaccinations}
            onChange={(files) => {
              onChange((prev) => ({
                ...prev,
                sante: { ...prev.sante, carnetVaccinations: files },
              }));
            }}
          />
          {errors.carnetVaccinations && (
            <p className="text-xs text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {errors.carnetVaccinations}
            </p>
          )}
        </div>

        {/* Allergies & Autres difficultés */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Allergies éventuelles ou autres difficultés de santé à signaler <span className="text-rose-600">*</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={data.sante.aucuneAllergie}
                onChange={(e) => setAllergies(data.sante.allergiesDifficultesSante, e.target.checked)}
                className="rounded text-blue-900 focus:ring-blue-900"
              />
              <span className="text-xs font-semibold text-slate-700">
                Aucune allergie ou difficulté de santé à signaler
              </span>
            </label>
          </div>

          <p className="text-xs text-slate-500">
            Précisez les allergies alimentaires, médicamenteuses, asthme, traitements réguliers (PAI/PPS) ou informations vitales pour l'infirmerie.
          </p>

          <textarea
            rows={4}
            disabled={data.sante.aucuneAllergie}
            value={data.sante.aucuneAllergie ? 'Aucune allergie ou difficulté de santé à signaler.' : data.sante.allergiesDifficultesSante}
            onChange={(e) => setAllergies(e.target.value, false)}
            placeholder="Ex : Allergie aux arachides. Asthme d'effort avec Ventoline autorisée. Port de lunettes en classe..."
            className={`w-full p-3 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400 ${
              errors.allergies ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
            }`}
          />
          {errors.allergies && <p className="text-[11px] text-rose-600">{errors.allergies}</p>}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors"
        >
          ← Retour aux responsables
        </button>

        <button
          type="button"
          onClick={onNext}
          className="px-6 py-3 bg-blue-900 text-white rounded-xl font-bold text-sm shadow-xs hover:bg-blue-800 transition-colors flex items-center gap-2"
        >
          Continuer vers l'Autorisation & Signature →
        </button>
      </div>
    </div>
  );
}
