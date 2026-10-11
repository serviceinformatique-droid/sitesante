import React, { useEffect, useState } from 'react';
import { Paperclip, X, RefreshCw, CheckCircle2, AlertTriangle, FolderTree, ListChecks, Download } from 'lucide-react';
import { Voyage } from '../types.js';
import { piecesZipUrl } from '../utils/apiFetch.js';

interface TemplateCheck {
  success: boolean;
  message: string;
  pieces: Array<{ libelle: string; trouve: boolean; champ?: string; type_champ?: string; obligatoire?: boolean; avant_signature?: boolean; role?: string }>;
  champs: Array<{ name: string; type: string; role?: string }>;
  champs_fichier_non_prevus?: string[];
}

interface Summary {
  dossier: string;
  par_voyage: boolean;
  pieces_requises?: Array<{ id: string; libelle: string }>;
  classes: Array<{ classe: string; eleves: number; complets: number; manquants: Array<{ id: string; eleve: string; manque: string[] }> }>;
}

interface Props {
  voyage: Voyage;
  adminToken: string;
  onClose: () => void;
  onVoyageUpdated?: () => void;
}

export const PiecesJointesAdminModal: React.FC<Props> = ({ voyage, adminToken, onClose, onVoyageUpdated }) => {
  const [check, setCheck] = useState<TemplateCheck | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [openClasse, setOpenClasse] = useState<string | null>(null);

  const headers = { 'Content-Type': 'application/json', 'x-admin-token': adminToken };

  const load = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        fetch(`/api/voyages/${voyage.id}/pieces/template-check`, { headers }).then((r) => r.json()),
        fetch(`/api/voyages/${voyage.id}/pieces/summary`, { headers }).then((r) => r.json()),
      ]);
      setCheck(c);
      setSummary(s);
    } catch {
      setNotice({ ok: false, text: 'Erreur réseau lors du chargement' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voyage.id]);

  const fromTemplate = async () => {
    setProcessing(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/voyages/${voyage.id}/pieces/from-template`, { method: 'POST', headers });
      const data = await res.json();
      setNotice({ ok: Boolean(data.success), text: data.message || data.error || 'Réponse inattendue' });
      onVoyageUpdated?.();
      await load();
    } catch {
      setNotice({ ok: false, text: 'Erreur réseau' });
    } finally {
      setProcessing(false);
    }
  };

  const processNow = async (force: boolean) => {
    setProcessing(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/voyages/${voyage.id}/pieces/process`, { method: 'POST', headers, body: JSON.stringify({ force }) });
      const data = await res.json();
      setNotice({ ok: Boolean(data.success), text: data.message || data.error || 'Réponse inattendue' });
      await load();
    } catch {
      setNotice({ ok: false, text: 'Erreur réseau' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-4">
        <div className="bg-slate-900 text-white p-5 sm:p-6 relative pr-16">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-indigo-500/20 text-indigo-300 rounded-xl flex items-center justify-center mb-3">
            <Paperclip className="w-5 h-5" />
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">Pièces jointes — {voyage.nom}</h3>
          <p className="text-xs text-slate-300 mt-1">
            Pièces demandées pour ce voyage, téléversées par les parents dans DocuSeal (liste modifiable : ✏️ Modifier le voyage).
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-5 text-sm">
          {loading ? (
            <div className="text-center text-slate-500 py-8 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Chargement…
            </div>
          ) : (
            <>
              {/* 1. Vérification du modèle DocuSeal */}
              <section>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4" /> 1. Modèle DocuSeal #{voyage.docuseal_template_id}
                </h4>
                {check && (
                  <div className={`p-3 rounded-xl border text-xs ${check.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                    <div className="font-bold flex items-center gap-1.5 mb-2">
                      {check.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      {check.message}
                    </div>
                    <ul className="space-y-1">
                      {check.pieces.map((p) => (
                        <li key={p.libelle} className="flex flex-wrap gap-x-2">
                          <span>{p.trouve && p.avant_signature && p.type_champ === 'file' ? '✅' : '❌'}</span>
                          <strong>{p.libelle}</strong>
                          <span className="text-slate-600">
                            {p.trouve
                              ? `champ « ${p.champ} » (${p.type_champ === 'file' ? 'Fichier' : p.type_champ})${p.role ? `, rôle ${p.role}` : ''}${
                                  p.obligatoire ? ', obligatoire' : ', facultatif'
                                }${p.avant_signature ? ', avant la signature' : ' — ⚠ À DÉPLACER AVANT LA SIGNATURE'}`
                              : '— champ « Fichier » manquant dans le modèle'}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {!check.success && check.pieces.length > 0 && (
                      <p className="mt-2 text-[11px] leading-relaxed">
                        Dans DocuSeal : ouvrir le modèle → ajouter un champ <strong>Fichier</strong> par pièce (même nom que ci-dessus :{' '}
                        {check.pieces.map((p) => `« ${p.libelle} »`).join(', ')}), cocher <em>Obligatoire</em>, l'attribuer au parent, puis
                        glisser ces champs <strong>au-dessus</strong> du champ Signature dans la liste de droite.
                      </p>
                    )}
                    {check.champs_fichier_non_prevus && check.champs_fichier_non_prevus.length > 0 && (
                      <p className="mt-2 text-[11px] leading-relaxed">
                        Champs « Fichier » du modèle non demandés dans le portail (récupérés en « Autres fichiers ») :{' '}
                        <strong>{check.champs_fichier_non_prevus.join(', ')}</strong>
                      </p>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={fromTemplate}
                  disabled={processing}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 disabled:opacity-50"
                  title="Remplace la liste des pièces demandées par les champs « Fichier » trouvés dans le modèle DocuSeal"
                >
                  <ListChecks className="w-3.5 h-3.5" /> Reprendre les champs « Fichier » du modèle comme pièces demandées
                </button>
              </section>

              {/* 2. Rangement sur le serveur */}
              {summary && (
                <section>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4" /> 2. Classement sur le serveur
                  </h4>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono break-all">
                    {summary.dossier}/{summary.par_voyage ? '<Voyage>/' : ''}&lt;Classe&gt;/NOM_Prenom_Piece.ext
                  </div>
                  {summary.classes.length > 0 && (
                    <a
                      href={piecesZipUrl(voyage.id, 'Toutes')}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Download className="w-4 h-4" /> Tout le voyage (.zip, par classe puis par élève)
                    </a>
                  )}
                  <div className="mt-3 space-y-2">
                    {summary.classes.length === 0 && <p className="text-xs text-slate-500">Aucun élève synchronisé pour l'instant.</p>}
                    {summary.classes.map((c) => (
                      <div key={c.classe} className="border border-slate-200 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setOpenClasse(openClasse === c.classe ? null : c.classe)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white hover:bg-slate-50 text-left"
                        >
                          <span className="font-bold text-slate-800">Classe {c.classe}</span>
                          <span className={`text-xs font-bold ${c.complets === c.eleves ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {(summary.pieces_requises?.length ?? 0) > 0
                              ? `${c.complets}/${c.eleves} dossiers complets (${summary.pieces_requises!.length} pièce${summary.pieces_requises!.length > 1 ? 's' : ''})`
                              : `${c.eleves} élève${c.eleves > 1 ? 's' : ''}`}
                          </span>
                        </button>
                        <div className="px-3 pb-2.5 bg-white">
                          <a
                            href={piecesZipUrl(voyage.id, c.classe)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200"
                          >
                            <Download className="w-3.5 h-3.5" /> Télécharger la classe {c.classe} (.zip, par élève)
                          </a>
                        </div>
                        {openClasse === c.classe && c.manquants.length > 0 && (
                          <ul className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs space-y-1">
                            {c.manquants.map((m) => (
                              <li key={m.id}>
                                <strong>{m.eleve}</strong> : <span className="text-slate-600">manque {m.manque.join(', ')}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {notice && (
            <div className={`p-3 rounded-xl text-xs break-words ${notice.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
              {notice.text}
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => processNow(true)}
              disabled={processing}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50"
            >
              Tout retélécharger
            </button>
            <button
              type="button"
              onClick={() => processNow(false)}
              disabled={processing}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${processing ? 'animate-spin' : ''}`} />
              {processing ? 'Récupération en cours…' : 'Synchroniser et récupérer maintenant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
