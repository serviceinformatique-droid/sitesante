import { useState, useEffect } from 'react';
import { SchoolClass, SCHOOL_CLASSES, FicheInfirmerieData } from '../types';
import { User, MapPin, Phone, Stethoscope, Users, Building2, Plus, Check } from 'lucide-react';

interface StudentFormSectionProps {
  data: FicheInfirmerieData;
  onChange: (updater: (prev: FicheInfirmerieData) => FicheInfirmerieData) => void;
  onNext: () => void;
  errors: Record<string, string>;
}

export function StudentFormSection({ data, onChange, onNext, errors }: StudentFormSectionProps) {
  const [classesList, setClassesList] = useState<string[]>(SCHOOL_CLASSES);
  const [isAddingNewClass, setIsAddingNewClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  useEffect(() => {
    fetch('/api/classes')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.classes) && json.classes.length > 0) {
          setClassesList(json.classes);
        }
      })
      .catch(() => {});
  }, []);

  const handleAddNewClass = async () => {
    if (!newClassName.trim()) return;
    const trimmed = newClassName.trim();
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();
      if (json.success) {
        setClassesList(json.classes);
      } else {
        if (!classesList.includes(trimmed)) {
          setClassesList((prev) => [...prev, trimmed]);
        }
      }
      updateEleve('classe', trimmed);
      setIsAddingNewClass(false);
      setNewClassName('');
    } catch {
      if (!classesList.includes(trimmed)) {
        setClassesList((prev) => [...prev, trimmed]);
      }
      updateEleve('classe', trimmed);
      setIsAddingNewClass(false);
      setNewClassName('');
    }
  };
  const updateEleve = (field: keyof FicheInfirmerieData['eleve'], value: string) => {
    onChange((prev) => ({
      ...prev,
      eleve: { ...prev.eleve, [field]: value },
    }));
  };

  const updateResp = (field: keyof FicheInfirmerieData['responsableLegal'], value: any) => {
    onChange((prev) => ({
      ...prev,
      responsableLegal: { ...prev.responsableLegal, [field]: value },
    }));
  };

  return (
    <div id="section-eleve-responsables" className="space-y-8">
      {/* 1. Identité de l'élève */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5 text-blue-950">
            <User className="w-5 h-5 text-blue-900" />
            <h2 className="text-base font-bold uppercase tracking-wide">
              1. Identité de l'élève
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tous les renseignements de la fiche papier sont obligatoires pour la sécurité médicale de l'enfant.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Classe */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Classe de l'élève <span className="text-rose-600">*</span>
              </label>
              {!isAddingNewClass ? (
                <button
                  type="button"
                  onClick={() => setIsAddingNewClass(true)}
                  className="text-[11px] text-blue-900 font-bold hover:underline inline-flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Autre classe
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingNewClass(false)}
                  className="text-[11px] text-slate-500 hover:underline"
                >
                  Choisir dans la liste
                </button>
              )}
            </div>

            {isAddingNewClass ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Ex: 6ème E, ULIS..."
                  className="flex-1 px-3 py-2 text-sm bg-white border border-blue-900 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewClass();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddNewClass}
                  className="px-3 py-2 bg-blue-900 text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition-colors"
                >
                  OK
                </button>
              </div>
            ) : (
              <select
                value={data.eleve.classe}
                onChange={(e) => updateEleve('classe', e.target.value as SchoolClass)}
                className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none transition-colors ${
                  errors.classe ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              >
                <option value="">-- Sélectionner la classe --</option>
                {classesList.map((cl) => (
                  <option key={cl} value={cl}>
                    {cl}
                  </option>
                ))}
              </select>
            )}
            {errors.classe && <p className="text-[11px] text-rose-600 mt-1">{errors.classe}</p>}
          </div>

          {/* Nom */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nom de famille <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={data.eleve.nom}
              onChange={(e) => updateEleve('nom', e.target.value.toUpperCase())}
              placeholder="Ex: DUPONT"
              className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none uppercase ${
                errors.nom ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
              }`}
            />
            {errors.nom && <p className="text-[11px] text-rose-600 mt-1">{errors.nom}</p>}
          </div>

          {/* Prénom */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Prénom <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={data.eleve.prenom}
              onChange={(e) => updateEleve('prenom', e.target.value)}
              placeholder="Ex: Jean"
              className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                errors.prenom ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
              }`}
            />
            {errors.prenom && <p className="text-[11px] text-rose-600 mt-1">{errors.prenom}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Date de naissance */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Date de naissance <span className="text-rose-600">*</span>
            </label>
            <input
              type="date"
              value={data.eleve.dateNaissance}
              onChange={(e) => updateEleve('dateNaissance', e.target.value)}
              className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                errors.dateNaissance ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
              }`}
            />
            {errors.dateNaissance && <p className="text-[11px] text-rose-600 mt-1">{errors.dateNaissance}</p>}
          </div>

          {/* Adresse */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Adresse de l'élève <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={data.eleve.adresse}
                onChange={(e) => updateEleve('adresse', e.target.value)}
                placeholder="Numéro et nom de voie"
                className={`w-full pl-9 pr-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                  errors.adresse ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
            {errors.adresse && <p className="text-[11px] text-rose-600 mt-1">{errors.adresse}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* CP */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Code Postal (CP) <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              maxLength={5}
              value={data.eleve.codePostal}
              onChange={(e) => updateEleve('codePostal', e.target.value)}
              placeholder="Ex: 94220"
              className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                errors.codePostal ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
              }`}
            />
            {errors.codePostal && <p className="text-[11px] text-rose-600 mt-1">{errors.codePostal}</p>}
          </div>

          {/* Ville */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ville <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={data.eleve.ville}
              onChange={(e) => updateEleve('ville', e.target.value)}
              placeholder="Ex: Charenton-le-Pont"
              className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                errors.ville ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
              }`}
            />
            {errors.ville && <p className="text-[11px] text-rose-600 mt-1">{errors.ville}</p>}
          </div>

          {/* Médecin traitant (Nom) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nom du médecin traitant <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={data.eleve.nomMedecinTraitant}
                onChange={(e) => updateEleve('nomMedecinTraitant', e.target.value)}
                placeholder="Ex: Dr. Garnier"
                className={`w-full pl-9 pr-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                  errors.nomMedecinTraitant ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
            {errors.nomMedecinTraitant && <p className="text-[11px] text-rose-600 mt-1">{errors.nomMedecinTraitant}</p>}
          </div>
        </div>

        {/* Téléphone médecin traitant */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              N° Téléphone du médecin traitant <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                value={data.eleve.telMedecinTraitant}
                onChange={(e) => updateEleve('telMedecinTraitant', e.target.value)}
                placeholder="Ex: 01 43 76 89 20"
                className={`w-full pl-9 pr-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                  errors.telMedecinTraitant ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
            {errors.telMedecinTraitant && <p className="text-[11px] text-rose-600 mt-1">{errors.telMedecinTraitant}</p>}
          </div>
        </div>
      </div>

      {/* 2. Personnes responsables de l'élève */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5 text-blue-950">
            <Users className="w-5 h-5 text-blue-900" />
            <h2 className="text-base font-bold uppercase tracking-wide">
              2. Personnes responsables de l'élève
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Indiquez le responsable légal et les coordonnées professionnelles des parents.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Nom du responsable légal */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nom du responsable légal <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={data.responsableLegal.nom}
              onChange={(e) => updateResp('nom', e.target.value)}
              placeholder="Ex: DUPONT Marc"
              className={`w-full px-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                errors.nomResponsable ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
              }`}
            />
            {errors.nomResponsable && <p className="text-[11px] text-rose-600 mt-1">{errors.nomResponsable}</p>}
          </div>

          {/* Statut du responsable légal */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Qualité du responsable <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'pere', label: 'Père' },
                { id: 'mere', label: 'Mère' },
                { id: 'responsable_tuteur', label: 'Tuteur' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center justify-center py-2 px-2 border rounded-xl text-xs font-medium cursor-pointer transition-all ${
                    data.responsableLegal.statut === opt.id
                      ? 'border-blue-900 bg-blue-900 text-white shadow-2xs font-semibold'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="statutResponsable"
                    value={opt.id}
                    checked={data.responsableLegal.statut === opt.id}
                    onChange={() => updateResp('statut', opt.id)}
                    className="sr-only"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Téléphone personnel du responsable */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tél. personnel du responsable <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                value={data.responsableLegal.telPersonnel}
                onChange={(e) => updateResp('telPersonnel', e.target.value)}
                placeholder="Ex: 06 12 34 56 78"
                className={`w-full pl-9 pr-3 py-2 text-sm bg-white border rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none ${
                  errors.telPersonnelResponsable ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
            {errors.telPersonnelResponsable && <p className="text-[11px] text-rose-600 mt-1">{errors.telPersonnelResponsable}</p>}
          </div>
        </div>

        {/* Coordonnées professionnelles */}
        <div className="pt-2 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-slate-500" />
            Coordonnées professionnelles des parents
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Tél. travail mère */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Téléphone professionnel de la mère <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                disabled={data.responsableLegal.telTravailMereNonConcerne}
                value={data.responsableLegal.telTravailMereNonConcerne ? 'Non concerné' : data.responsableLegal.telTravailMere}
                onChange={(e) => updateResp('telTravailMere', e.target.value)}
                placeholder="Ex: 01 45 23 89 00"
                className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:ring-2 focus:ring-blue-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 ${
                  errors.telTravailMere ? 'border-rose-500' : 'border-slate-300'
                }`}
              />
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={data.responsableLegal.telTravailMereNonConcerne}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateResp('telTravailMereNonConcerne', checked);
                    if (checked) {
                      updateResp('telTravailMere', 'Non concerné');
                    } else {
                      updateResp('telTravailMere', '');
                    }
                  }}
                  className="rounded text-blue-900 focus:ring-blue-900"
                />
                <span className="text-xs text-slate-600 font-medium">
                  Non concerné (retraite, sans emploi, ou non applicable)
                </span>
              </label>
              {errors.telTravailMere && <p className="text-[11px] text-rose-600">{errors.telTravailMere}</p>}
            </div>

            {/* Tél. travail père */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Téléphone professionnel du père <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                disabled={data.responsableLegal.telTravailPereNonConcerne}
                value={data.responsableLegal.telTravailPereNonConcerne ? 'Non concerné' : data.responsableLegal.telTravailPere}
                onChange={(e) => updateResp('telTravailPere', e.target.value)}
                placeholder="Ex: 01 42 30 11 22"
                className={`w-full px-3 py-2 text-sm bg-white border rounded-lg focus:ring-2 focus:ring-blue-900 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 ${
                  errors.telTravailPere ? 'border-rose-500' : 'border-slate-300'
                }`}
              />
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={data.responsableLegal.telTravailPereNonConcerne}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateResp('telTravailPereNonConcerne', checked);
                    if (checked) {
                      updateResp('telTravailPere', 'Non concerné');
                    } else {
                      updateResp('telTravailPere', '');
                    }
                  }}
                  className="rounded text-blue-900 focus:ring-blue-900"
                />
                <span className="text-xs text-slate-600 font-medium">
                  Non concerné (retraite, sans emploi, ou non applicable)
                </span>
              </label>
              {errors.telTravailPere && <p className="text-[11px] text-rose-600">{errors.telTravailPere}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Button to Next Step */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          className="px-6 py-3 bg-blue-900 text-white rounded-xl font-bold text-sm shadow-xs hover:bg-blue-800 transition-colors flex items-center gap-2"
        >
          Continuer vers l'Urgence & la Santé →
        </button>
      </div>
    </div>
  );
}
