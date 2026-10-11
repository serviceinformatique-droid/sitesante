import { useState } from 'react';
import { ParentProfile, SECRET_QUESTIONS } from '../types';
import {
  Lock,
  Mail,
  KeyRound,
  User,
  Phone,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface ParentAuthCardProps {
  onSuccess: (parent: ParentProfile) => void;
  onSwitchToAdmin: () => void;
}

export function ParentAuthCard({ onSuccess, onSwitchToAdmin }: ParentAuthCardProps) {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register form
  const [regNom, setRegNom] = useState('');
  const [regPrenom, setRegPrenom] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSecretQuestion, setRegSecretQuestion] = useState<string>(SECRET_QUESTIONS[0]);
  const [regSecretAnswer, setRegSecretAnswer] = useState('');

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState('');
  const [foundSecretQuestion, setFoundSecretQuestion] = useState<string | null>(null);
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Veuillez renseigner votre email et mot de passe.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/parent/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (data.success && data.parent) {
        onSuccess(data.parent);
      } else {
        setErrorMsg(data.error || 'Email ou mot de passe incorrect.');
      }
    } catch (err: any) {
      setErrorMsg('Erreur de connexion : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regNom.trim() || !regPrenom.trim()) {
      setErrorMsg('Veuillez renseigner votre nom et votre prénom.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMsg('Veuillez renseigner une adresse email valide.');
      return;
    }
    if (!regPhone.trim()) {
      setErrorMsg('Le numéro de téléphone est obligatoire.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (!regSecretAnswer.trim()) {
      setErrorMsg('Veuillez répondre à la question secrète (indispensable en cas d\'oubli de mot de passe).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/parent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: regNom.trim().toUpperCase(),
          prenom: regPrenom.trim(),
          email: regEmail.trim().toLowerCase(),
          telephone: regPhone.trim(),
          password: regPassword,
          secretQuestion: regSecretQuestion,
          secretAnswer: regSecretAnswer.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.parent) {
        onSuccess(data.parent);
      } else {
        setErrorMsg(data.error || 'Erreur lors de la création du compte.');
      }
    } catch (err: any) {
      setErrorMsg('Erreur serveur : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch secret question for email
  const handleFetchSecretQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setErrorMsg('Veuillez saisir une adresse email valide.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/parent/forgot-password/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.success && data.secretQuestion) {
        setFoundSecretQuestion(data.secretQuestion);
        setErrorMsg(null);
      } else {
        setErrorMsg(data.error || 'Aucun compte parent trouvé avec cette adresse email.');
      }
    } catch (err: any) {
      setErrorMsg('Erreur lors de la vérification : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset password using secret answer
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!forgotAnswer.trim()) {
      setErrorMsg('Veuillez saisir votre réponse secrète.');
      return;
    }
    if (forgotNewPassword.length < 6) {
      setErrorMsg('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMsg('Les mots de passe saisis ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/parent/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          secretAnswer: forgotAnswer.trim(),
          newPassword: forgotNewPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter.');
        setTab('login');
        setLoginEmail(forgotEmail);
        setLoginPassword('');
        setFoundSecretQuestion(null);
        setForgotAnswer('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
      } else {
        setErrorMsg(data.error || 'La réponse à la question secrète est incorrecte.');
      }
    } catch (err: any) {
      setErrorMsg('Erreur de réinitialisation : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-4 sm:py-8 px-3 sm:px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Institutionnel */}
        <div className="bg-gradient-to-b from-blue-950 to-blue-900 text-white p-6 sm:p-8 text-center relative">
          <div className="flex justify-center mb-3">
            <img
              src="/logo.svg"
              alt="Logo Notre-Dame des Missions - Saint-Pierre"
              className="h-16 w-auto object-contain bg-white/10 p-2 rounded-xl backdrop-blur-xs border border-white/20"
            />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white uppercase">
            Ensemble Scolaire Notre-Dame des Missions – Saint-Pierre
          </h2>
          <p className="text-xs text-blue-200 mt-1">
            Service Infirmerie • Portail d'authentification des familles
          </p>

          <div className="mt-4 inline-flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] px-3 py-1 rounded-full font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Données de santé 100% cryptées (AES-256-GCM) • Accès protégé</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-3 text-center transition-all cursor-pointer ${
              tab === 'login'
                ? 'bg-white text-blue-950 border-b-2 border-blue-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Se connecter
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-3 text-center transition-all cursor-pointer ${
              tab === 'register'
                ? 'bg-white text-blue-950 border-b-2 border-blue-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Créer un compte parent
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">
                  Adresse email du parent responsable
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="exemple : marie.dupont@email.fr"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900 text-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-700 font-semibold">
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot');
                      setForgotEmail(loginEmail);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-blue-900 hover:underline font-semibold cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Votre mot de passe"
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
                  <span>Connexion en cours...</span>
                ) : (
                  <>
                    <span>Accéder à la fiche infirmerie</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-3 text-center border-t border-slate-100">
                <span className="text-slate-500">Première connexion ? </span>
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-bold text-blue-950 hover:underline cursor-pointer"
                >
                  Créez votre compte en 1 minute
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-950 text-[11px] leading-relaxed">
                Ce compte parent vous permet de compléter, signer et suivre la fiche d'infirmerie de vos enfants en toute sécurité.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nom de famille *</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={regNom}
                      onChange={(e) => setRegNom(e.target.value)}
                      placeholder="DUPONT"
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900 uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={regPrenom}
                    onChange={(e) => setRegPrenom(e.target.value)}
                    placeholder="Marie"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Adresse email *</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="marie.dupont@email.fr"
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Téléphone mobile *</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="06 12 34 56 78"
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mot de passe (au moins 6 caractères) *
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              </div>

              {/* Secret Question & Answer */}
              <div className="border border-amber-200 bg-amber-50/50 p-3.5 rounded-xl space-y-2.5">
                <div className="flex items-center gap-1.5 text-amber-950 font-bold">
                  <HelpCircle className="w-4 h-4 text-amber-700" />
                  <span>Question secrète de sécurité (en cas d'oubli de mot de passe)</span>
                </div>
                <p className="text-[11px] text-amber-900">
                  Cette question vous permettra de réinitialiser instantanément votre mot de passe si vous le perdez.
                </p>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Choisissez votre question secrète :</label>
                  <select
                    value={regSecretQuestion}
                    onChange={(e) => setRegSecretQuestion(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 text-slate-800 text-xs"
                  >
                    {SECRET_QUESTIONS.map((q, idx) => (
                      <option key={idx} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Votre réponse secrète * :</label>
                  <input
                    type="text"
                    required
                    value={regSecretAnswer}
                    onChange={(e) => setRegSecretAnswer(e.target.value)}
                    placeholder="Votre réponse (ex: Médor, Lyon, etc.)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-950 hover:bg-blue-900 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-3"
              >
                {loading ? 'Création en cours...' : 'Créer mon compte et continuer'}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-blue-950 font-semibold hover:underline cursor-pointer"
                >
                  Vous possédez déjà un compte ? Se connecter
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: FORGOT PASSWORD */}
          {tab === 'forgot' && (
            <div className="space-y-4 text-xs">
              {!foundSecretQuestion ? (
                <form onSubmit={handleFetchSecretQuestion} className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-950 text-[11px]">
                    Saisissez votre adresse email pour afficher la question secrète que vous avez configurée lors de votre inscription.
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Adresse email de votre compte parent
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="marie.dupont@email.fr"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900 text-slate-900 text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-blue-950 hover:bg-blue-900 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Recherche en cours...' : 'Vérifier mon compte'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                    <span className="text-[11px] font-bold text-amber-900 uppercase">Question secrète enregistrée :</span>
                    <p className="text-xs font-semibold text-slate-900">{foundSecretQuestion}</p>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Votre réponse secrète *
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotAnswer}
                      onChange={(e) => setForgotAnswer(e.target.value)}
                      placeholder="Saisissez la réponse à votre question secrète"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Nouveau mot de passe *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder="Min 6 caractères"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Confirmer le mot de passe *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        placeholder="Identique"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Validation en cours...' : 'Réinitialiser mon mot de passe'}
                  </button>
                </form>
              )}

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setFoundSecretQuestion(null);
                    setErrorMsg(null);
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 font-semibold hover:underline cursor-pointer"
                >
                  ← Retour à la connexion
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with switch to Admin */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-1 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Conforme RGPD & Secret Médical
          </span>

          <button
            type="button"
            onClick={onSwitchToAdmin}
            className="text-blue-900 hover:text-blue-950 font-bold hover:underline cursor-pointer text-[11px]"
          >
            Accès réservé Infirmerie / Administration →
          </button>
        </div>
      </div>
    </div>
  );
}
