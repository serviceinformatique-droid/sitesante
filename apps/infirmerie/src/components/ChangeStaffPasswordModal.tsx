import { useState } from 'react';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, X, Shield } from 'lucide-react';
import { StaffProfile } from '../types';

interface ChangeStaffPasswordModalProps {
  currentStaff: StaffProfile | { username: string; label?: string };
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export function ChangeStaffPasswordModal({
  currentStaff,
  onClose,
  onSuccess,
}: ChangeStaffPasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setErrorMessage('Veuillez renseigner votre mot de passe actuel.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentStaff.username,
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Erreur lors du changement de mot de passe.');
      }

      setSuccessMessage(data.message || 'Mot de passe modifié avec succès.');
      if (onSuccess) {
        onSuccess(data.message);
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur de communication avec le serveur.');
    } finally {
      setLoading(false);
    }
  };

  const accountDisplayName =
    currentStaff.label ||
    (currentStaff.username === 'infirmerie' ? 'Service Infirmerie' : 'Direction / Administrateur');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 to-slate-900 text-white p-5 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-800/60 border border-blue-600/50 flex items-center justify-center text-blue-200">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Changer le mot de passe</h3>
              <p className="text-xs text-blue-200">
                Session : <span className="font-semibold text-white">{accountDisplayName}</span> ({currentStaff.username})
              </p>
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

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Info pill */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-950 flex items-start gap-2">
            <Shield className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <span>
              La modification est immédiate et chiffrée en <strong>PBKDF2-SHA512</strong> dans le coffre-fort local du serveur.
            </span>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Mot de passe actuel
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Saisissez votre mot de passe actuel"
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Nouveau mot de passe (8 caractères minimum)
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Au moins 8 caractères"
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Confirmer le nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le nouveau mot de passe"
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                className="px-5 py-2 bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {loading ? (
                  <span>Enregistrement...</span>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Mettre à jour mon mot de passe</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
