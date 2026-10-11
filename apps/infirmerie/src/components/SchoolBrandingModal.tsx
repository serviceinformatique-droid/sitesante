import { getSchoolName } from '../utils/branding';
import { useState } from 'react';
import { SchoolBranding } from '../types';
import { School, Upload, RotateCcw, Save, X, Check, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface SchoolBrandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  branding?: SchoolBranding;
  onSaved: (newBranding: SchoolBranding) => void;
}

export function SchoolBrandingModal({
  isOpen,
  onClose,
  branding,
  onSaved,
}: SchoolBrandingModalProps) {
  const [schoolName, setSchoolName] = useState(branding?.schoolName || getSchoolName());
  const [subTitle, setSubTitle] = useState(branding?.subTitle || "Sous-contrat d'Association avec l'État");
  const [logoDataUrl, setLogoDataUrl] = useState<string>(branding?.logoDataUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|webp|svg\+xml)$/)) {
      setError('Format non supporté. Veuillez sélectionner une image PNG, JPG, WebP ou SVG.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('L’image est trop volumineuse (maximum 2 Mo conseillé).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setLogoDataUrl(event.target.result);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim()) {
      setError("Le nom de l'établissement est requis.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          subTitle: subTitle.trim(),
          logoDataUrl,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde');
      }

      onSaved(data.branding);
      setSuccessMsg('Identité et logo sauvegardés avec succès !');
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err.message || 'Impossible de sauvegarder les modifications.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Rétablir le nom d'établissement et le logo d'origine ?")) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/branding/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSchoolName(data.branding.schoolName);
        setSubTitle(data.branding.subTitle);
        setLogoDataUrl('');
        onSaved(data.branding);
        setSuccessMsg('Paramètres par défaut rétablis.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la réinitialisation.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <School className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">Identité & Logo de l'Établissement</h3>
              <p className="text-xs text-slate-400">Personnalisez le nom affiché et le logo officiel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* School Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nom officiel de l'Établissement <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Nom officiel de l'établissement"
              className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              required
            />
          </div>

          {/* Subtitle / mention */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Sous-titre / Statut juridique
            </label>
            <input
              type="text"
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              placeholder="Ex: Sous-contrat d'Association avec l'État"
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            />
          </div>

          {/* Logo upload & preview */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Logo de l'Établissement (PNG, JPG, WebP, SVG)
            </label>
            <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                {logoDataUrl ? (
                  <img
                    src={logoDataUrl}
                    alt="Logo personnalisé"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src="/logo.svg"
                    alt="Logo par défaut"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-blue-700" />
                  <span>Choisir une image</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/svg+xml"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoDataUrl('')}
                    className="ml-2 text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer underline"
                  >
                    Effacer le logo personnalisé
                  </button>
                )}
                <p className="text-[10px] text-slate-500">
                  Visible en en-tête et sur tous les documents officiels. Max 2 Mo.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rétablir défaut</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-blue-950 hover:bg-blue-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Enregistrement...' : 'Enregistrer'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
