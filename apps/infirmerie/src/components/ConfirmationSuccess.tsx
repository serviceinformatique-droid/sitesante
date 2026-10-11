import { FicheInfirmerieData } from '../types';
import { getFicheFileName, getCarnetFileName, formatClassDirectory } from '../utils/pdfGenerator';
import { CheckCircle2, Download, Cloud, Mail, FileText, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';
import { useSchoolName } from '../utils/branding';

interface ConfirmationSuccessProps {
  data: FicheInfirmerieData;
  fichePdfBlob?: Blob | null;
  carnetPdfBlob?: Blob | null;
  onReset: () => void;
  onGoToAdmin: () => void;
}

export function ConfirmationSuccess({
  data,
  fichePdfBlob,
  carnetPdfBlob,
  onReset,
  onGoToAdmin,
}: ConfirmationSuccessProps) {
  const nomEtab = useSchoolName();
  useEffect(() => {
    // Launch celebratory confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  const downloadFiche = () => {
    if (!fichePdfBlob) return;
    const url = URL.createObjectURL(fichePdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getFicheFileName(data);
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCarnet = () => {
    if (!carnetPdfBlob) return;
    const url = URL.createObjectURL(carnetPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getCarnetFileName(data);
    a.click();
    URL.revokeObjectURL(url);
  };

  const classFolder = formatClassDirectory(data.eleve.classe);
  const nextcloudTreePath = `FICHES INFIRMERIE / ${data.schoolYear} / ${classFolder} / ${getFicheFileName(data)}`;
  const nextcloudCarnetPath = `FICHES INFIRMERIE / ${data.schoolYear} / ${classFolder} / ${getCarnetFileName(data)}`;

  return (
    <div id="confirmation-succes" className="max-w-3xl mx-auto space-y-6">
      {/* Top Card */}
      <div className="bg-white rounded-3xl border border-emerald-200 p-6 sm:p-8 shadow-sm text-center relative overflow-hidden">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <span className="text-xs uppercase tracking-widest font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-block mb-2">
          Fiche infirmerie validée & verrouillée
        </span>

        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Félicitations, la fiche de {data.eleve.prenom} {data.eleve.nom} a été enregistrée !
        </h2>

        <p className="text-sm text-slate-600 max-w-xl mx-auto mt-2 leading-relaxed">
          Le document officiel A4 a été généré avec la signature électronique du représentant légal et archivé de manière sécurisée dans le dossier d'infirmerie de l'établissement.
        </p>

        {/* Automatic filing callout */}
        <div className="mt-6 p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-950 uppercase tracking-wide">
            <FileText className="w-4 h-4 text-blue-900" />
            Classement automatique du dossier d'infirmerie
          </div>

          <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-xs space-y-1.5 shadow-inner">
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Dossier : FICHES INFIRMERIE/{data.schoolYear}/{classFolder}/</span>
            </div>
            <div className="pl-4 text-slate-300">
              ├── 📄 {getFicheFileName(data)}
            </div>
            <div className="pl-4 text-slate-300">
              └── 📎 {getCarnetFileName(data)}
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            ✓ Conformité au cahier des charges : classement par année scolaire ({data.schoolYear}), par classe ({classFolder}), puis par ordre alphabétique de nom d'élève.
          </p>
        </div>

        {/* Download Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={downloadFiche}
            className="px-5 py-3 bg-blue-950 hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Télécharger la Fiche Infirmerie (PDF A4)
          </button>

          <button
            type="button"
            onClick={downloadCarnet}
            className="px-5 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            Télécharger le Carnet de Vaccinations (PDF)
          </button>
        </div>
      </div>

      {/* Confirmation Email Preview (§21) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
            <Mail className="w-4 h-4 text-blue-900" />
            Accusé de réception officiel adressé à la famille (§21)
          </div>
          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
            Généré automatiquement
          </span>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-2 font-sans">
          <p className="font-semibold text-slate-900">
            Objet : Confirmation – Fiche infirmerie de {data.eleve.nom.toUpperCase()} {data.eleve.prenom} ({data.eleve.classe})
          </p>
          <p>Bonjour,</p>
          <p>
            Nous vous confirmons la réception de la fiche infirmerie de votre enfant <strong>{data.eleve.prenom} {data.eleve.nom.toUpperCase()}</strong>.
          </p>
          <p>
            La fiche signée ainsi que la copie du carnet de vaccinations ont bien été enregistrées et transmises à l'infirmerie.
          </p>
          <p className="pt-2 text-slate-500">
            Cordialement,<br />
            <strong>{nomEtab}</strong>
          </p>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={onReset}
          className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Renseigner la fiche d'un autre élève
        </button>

        <button
          type="button"
          onClick={onGoToAdmin}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
        >
          <span>Accéder au tableau de bord Infirmerie</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
