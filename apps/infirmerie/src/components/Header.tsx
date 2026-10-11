import { Shield, School, LayoutDashboard, FileText, Lock, LogOut, UserCheck } from 'lucide-react';
import { ParentProfile, SchoolBranding } from '../types';

interface HeaderProps {
  currentView: 'parent_form' | 'admin_dashboard';
  onViewChange: (view: 'parent_form' | 'admin_dashboard') => void;
  schoolYear: string;
  onSchoolYearChange: (year: string) => void;
  untransmittedCount?: number;
  parentProfile?: ParentProfile | null;
  onParentLogout?: () => void;
  adminAuthenticated?: boolean;
  adminProfile?: { username: string; label?: string } | null;
  onAdminLogout?: () => void;
  branding?: SchoolBranding;
}

export function Header({
  currentView,
  onViewChange,
  schoolYear,
  onSchoolYearChange,
  untransmittedCount = 0,
  parentProfile,
  onParentLogout,
  adminAuthenticated,
  adminProfile,
  onAdminLogout,
  branding,
}: HeaderProps) {
  const schoolName = branding?.schoolName || 'ENSEMBLE SCOLAIRE NOTRE-DAME DES MISSIONS – SAINT-PIERRE';
  const subTitle = branding?.subTitle || "Sous-contrat d'Association avec l'État";
  const logoSrc = branding?.logoDataUrl && branding.logoDataUrl.trim() ? branding.logoDataUrl : '/logo.svg';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      {/* Top Banner with official institution mark */}
      <div className="bg-slate-900 text-slate-200 text-xs py-1.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <School className="w-3.5 h-3.5 text-blue-300" />
            <span className="font-semibold tracking-wide text-white uppercase">
              {schoolName}
            </span>
            {subTitle && (
              <span className="hidden sm:inline text-slate-400 text-[11px]">
                • {subTitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
              <Lock className="w-3 h-3 text-emerald-400" /> Données 100% Cryptées AES-256
            </span>
            <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-0.5 rounded-sm text-[11px]">
              <span className="text-slate-400">Année :</span>
              <select
                value={schoolYear}
                onChange={(e) => onSchoolYearChange(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
              >
                <option value="2025-2026" className="text-slate-900">2025-2026</option>
                <option value="2026-2027" className="text-slate-900">2026-2027</option>
                <option value="2027-2028" className="text-slate-900">2027-2028</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {/* Institution Logo Top-Left */}
          <img
            src={logoSrc}
            alt={`Logo ${schoolName}`}
            className="h-12 w-auto max-w-[140px] object-contain shrink-0 rounded-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Fiche Infirmerie Numérique
              </h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200">
                Officiel {schoolYear}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Formulaire officiel sécurisé, authentification & données médicales protégées
            </p>
          </div>
        </div>

        {/* User Session & View Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active User Indicator */}
          {currentView === 'parent_form' && parentProfile && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-950 px-3 py-1.5 rounded-xl text-xs">
              <UserCheck className="w-3.5 h-3.5 text-blue-700" />
              <span className="font-semibold">{parentProfile.prenom} {parentProfile.nom}</span>
              <button
                type="button"
                onClick={onParentLogout}
                className="ml-1.5 text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors"
                title="Déconnexion parent"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[11px]">Quitter</span>
              </button>
            </div>
          )}

          {currentView === 'admin_dashboard' && adminAuthenticated && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-950 px-3 py-1.5 rounded-xl text-xs">
              <Shield className="w-3.5 h-3.5 text-emerald-700" />
              <span className="font-bold">{adminProfile?.label || 'Direction / Infirmerie'}</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-md font-mono">
                {adminProfile?.username || 'admin'}
              </span>
              <button
                type="button"
                onClick={onAdminLogout}
                className="ml-1.5 text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors"
                title="Déconnexion administrateur"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[11px]">Quitter</span>
              </button>
            </div>
          )}

          {/* View Switcher: Parent Form vs Admin Dashboard */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onViewChange('parent_form')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
                currentView === 'parent_form'
                  ? 'bg-white text-blue-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-900" />
              <span>Espace Parent</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange('admin_dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all relative ${
                currentView === 'admin_dashboard'
                  ? 'bg-white text-blue-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-blue-900" />
              <span>Infirmerie & Admin</span>
              {untransmittedCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white"></span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
