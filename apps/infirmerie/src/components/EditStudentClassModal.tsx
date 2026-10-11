import { useState } from 'react';
import { FicheInfirmerieData } from '../types';
import { X, Check, School, AlertCircle } from 'lucide-react';

interface EditStudentClassModalProps {
  fiche: FicheInfirmerieData;
  classes: string[];
  onClose: () => void;
  onClassUpdated: (ficheId: string, newClass: string) => Promise<void>;
}

export function EditStudentClassModal({
  fiche,
  classes,
  onClose,
  onClassUpdated,
}: EditStudentClassModalProps) {
  const [selectedClass, setSelectedClass] = useState(fiche.eleve?.classe || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fiche.id || !selectedClass.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onClassUpdated(fiche.id, selectedClass.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement de classe.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="bg-blue-950 text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <School className="w-5 h-5 text-blue-300" />
            <h3 className="font-bold text-sm">Modifier la classe de l'élève</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">Élève concerné :</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {fiche.eleve?.nom?.toUpperCase()} {fiche.eleve?.prenom}
            </p>
            <p className="text-xs text-blue-900 mt-0.5">
              Classe actuelle : <strong>{fiche.eleve?.classe || 'Non assignée'}</strong>
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
              Sélectionner la nouvelle classe :
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none"
              required
            >
              <option value="">-- Choisir une classe --</option>
              {classes.map((cl) => (
                <option key={cl} value={cl}>
                  {cl}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedClass.trim() || selectedClass === fiche.eleve?.classe}
              className="px-4 py-2 bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Enregistrer la nouvelle classe</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
