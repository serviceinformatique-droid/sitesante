import { useState } from 'react';
import {
  Lock,
  Shield,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Info,
  Eye,
  EyeOff,
  ChevronLeft
} from 'lucide-react';

interface AdminLoginCardProps {
  onSuccess: (admin: { username: string; label?: string; mustChangePassword?: boolean }) => void;
  onBackToParent: () => void;
}

export function AdminLoginCard({ onSuccess, onBackToParent }: AdminLoginCardProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg('Veuillez saisir votre identifiant et votre mot de passe.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (data.success && data.admin) {
        onSuccess({ ...data.admin, mustChangePassword: !!data.mustChangePassword });
      } else {
        setErrorMsg(data.error || 'Identifiant ou mot de passe incorrect.');
      }
    } catch (err: any) {
      setErrorMsg('Erreur de connexion : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6 sm:py-12 px-3 sm:px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
        {/* Header Institutionnel Admin */}
        <div className="bg-gradient-to-b from-blue-950 via-slate-900 to-blue-950 text-white p-6 sm:p-8 text-center relative">
          <div className="flex justify-center mb-3">
            <img
              src="/logo.svg"
              alt="Logo Notre-Dame des Missions - Saint-Pierre"
              className="h-16 w-auto object-contain bg-white/10 p-2 rounded-xl backdrop-blur-xs border border-white/20"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-700/60 text-blue-200 text-xs font-semibold mb-2">
            <Shield className="w-3.5 h-3.5 text-blue-300" />
            <span>Portail Infirmerie & Direction</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Accès Sécurisé Administration
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Ensemble Scolaire Notre-Dame des Missions – Saint-Pierre
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-7 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Session Switcher Buttons */}
          <div className="space-y-1.5">
            <label className="block text-slate-700 font-semibold">
              Choisir la session à ouvrir :
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUsername('admin')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  username.toLowerCase() === 'admin'
                    ? 'bg-blue-950 text-white border-blue-950 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Direction (admin)</span>
              </button>

              <button
                type="button"
                onClick={() => setUsername('infirmerie')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  username.toLowerCase() === 'infirmerie'
                    ? 'bg-blue-950 text-white border-blue-950 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Infirmerie (infirmerie)</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 pt-1">
            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">
                Identifiant de Session
              </label>
              <div className="relative">
                <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin ou infirmerie"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900 text-slate-900 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">
                Mot de passe de la session
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900 text-slate-900 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-950 hover:bg-blue-900 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span>Vérification sécurisée...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Se connecter au tableau de bord</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Back button */}
        <div className="bg-slate-50 border-t border-slate-200 p-3.5 text-center">
          <button
            type="button"
            onClick={onBackToParent}
            className="text-slate-600 hover:text-blue-950 font-semibold text-xs flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Retour à l'espace parent (Formulaire)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
