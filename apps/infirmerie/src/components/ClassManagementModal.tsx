import { useState } from 'react';
import { X, Plus, Edit2, Trash2, Check, AlertCircle, Users } from 'lucide-react';

interface ClassManagementModalProps {
  classes: string[];
  onClose: () => void;
  onClassCreated: (newClass: string) => Promise<void>;
  onClassRenamed: (oldName: string, newName: string) => Promise<void>;
  onClassDeleted: (name: string) => Promise<void>;
}

export function ClassManagementModal({
  classes,
  onClose,
  onClassCreated,
  onClassRenamed,
  onClassDeleted,
}: ClassManagementModalProps) {
  const [newClassName, setNewClassName] = useState('');
  const [editingOldName, setEditingOldName] = useState<string | null>(null);
  const [editingNewName, setEditingNewName] = useState('');
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await onClassCreated(newClassName.trim());
      setSuccessMessage(`Classe "${newClassName.trim()}" créée avec succès.`);
      setNewClassName('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la création de la classe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (className: string) => {
    setEditingOldName(className);
    setEditingNewName(className);
    setDeletingName(null);
    setErrorMessage(null);
  };

  const handleSaveEdit = async (oldName: string) => {
    if (!editingNewName.trim() || editingNewName.trim() === oldName) {
      setEditingOldName(null);
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await onClassRenamed(oldName, editingNewName.trim());
      setSuccessMessage(`Classe "${oldName}" renommée en "${editingNewName.trim()}".`);
      setEditingOldName(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la modification de la classe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async (name: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await onClassDeleted(name);
      setSuccessMessage(`Classe "${name}" supprimée.`);
      setDeletingName(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la suppression de la classe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-blue-950 text-white p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-blue-300" />
            <div>
              <h3 className="font-bold text-base">Gestion des Classes</h3>
              <p className="text-xs text-blue-200">Créer, modifier ou supprimer les classes scolaires</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form to create a new class */}
          <form onSubmit={handleCreate} className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Ajouter une nouvelle classe
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Ex: 6ème E, 2nde 5, BTS 1..."
                className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none"
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={isSubmitting || !newClassName.trim()}
                className="px-4 py-2 bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter</span>
              </button>
            </div>
          </form>

          {/* List of current classes */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Classes existantes ({classes.length})</span>
              <span>Actions</span>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
              {classes.map((className) => {
                const isEditing = editingOldName === className;

                return (
                  <div
                    key={className}
                    className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-colors"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editingNewName}
                          onChange={(e) => setEditingNewName(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-sm bg-white border border-blue-900 rounded-lg focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(className);
                            if (e.key === 'Escape') setEditingOldName(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(className)}
                          disabled={isSubmitting}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                          title="Valider la modification"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingOldName(null)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 cursor-pointer"
                          title="Annuler"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : deletingName === className ? (
                      <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-1.5 px-3 rounded-lg text-xs">
                        <span className="text-rose-900 font-semibold">Supprimer cette classe ?</span>
                        <button
                          type="button"
                          onClick={() => confirmDelete(className)}
                          disabled={isSubmitting}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md transition-colors cursor-pointer"
                        >
                          Oui, supprimer
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingName(null)}
                          disabled={isSubmitting}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-md transition-colors cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-slate-800">{className}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(className)}
                            className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            title="Modifier le nom de la classe"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingName(className);
                              setEditingOldName(null);
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            title="Supprimer la classe"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
