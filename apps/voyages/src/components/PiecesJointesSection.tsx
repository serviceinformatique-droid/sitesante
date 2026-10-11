import React, { useState } from 'react';
import { Paperclip, Download, Eye, RefreshCw, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Inscription, PieceJointe, Voyage } from '../types.js';
import { pieceUrl } from '../utils/apiFetch.js';
import { piecesDuVoyage } from '../piecesConfig.js';

/** Nombre de pièces demandées pour le voyage et nombre reçues pour cet élève */
export function countPieces(item: Inscription, voyage?: Voyage | null): { recues: number; total: number } {
  const requises = piecesDuVoyage(voyage);
  const types = new Set((item.pieces_jointes || []).map((p) => p.type));
  return { recues: requises.filter((p) => types.has(p.id)).length, total: requises.length };
}

const formatSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);

interface Props {
  inscription: Inscription;
  voyage: Voyage;
  onUpdated?: (updated: Inscription) => void;
}

export const PiecesJointesSection: React.FC<Props> = ({ inscription, voyage, onUpdated }) => {
  const [item, setItem] = useState<Inscription>(inscription);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => setItem(inscription), [inscription]);

  const pieces = item.pieces_jointes || [];
  const requises = piecesDuVoyage(voyage);
  const anySigned = item.parent1.statut === 'signed' || item.parent2.statut === 'signed';
  const autres = pieces.map((p, i) => ({ p, i })).filter(({ p }) => !requises.some((r) => r.id === p.type));
  const { recues, total } = countPieces(item, voyage);

  const refresh = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/inscriptions/${encodeURIComponent(item.id)}/pieces/refresh`, { method: 'POST' });
      const data = await res.json();
      setNotice({ ok: Boolean(data.success), text: data.message || data.error || 'Réponse inattendue' });
      if (data.inscription) {
        setItem(data.inscription);
        onUpdated?.(data.inscription);
      }
    } catch {
      setNotice({ ok: false, text: 'Erreur réseau lors de la récupération des pièces jointes' });
    } finally {
      setLoading(false);
    }
  };

  const fileRow = (p: PieceJointe, index: number) => (
    <div key={`${p.chemin}-${index}`} className="flex flex-wrap items-center justify-between gap-2 pl-6">
      <span className="font-mono text-[11px] text-slate-600 break-all">
        {p.fichier} <span className="text-slate-400 whitespace-nowrap">({formatSize(p.taille)})</span>
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        <a
          href={pieceUrl(item.id, index, item.voyage_id)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
          title="Afficher"
        >
          <Eye className="w-3 h-3" /> Voir
        </a>
        <a
          href={pieceUrl(item.id, index, item.voyage_id, true)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
          title="Télécharger"
        >
          <Download className="w-3 h-3" /> Télécharger
        </a>
      </span>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Pièces jointes des parents{total > 0 ? ` (${recues}/${total})` : ''}
        </h4>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 touch-manipulation"
          title="Télécharger à nouveau les pièces depuis DocuSeal"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Récupération…' : 'Récupérer depuis DocuSeal'}</span>
        </button>
      </div>

      <div className="space-y-2">
        {total === 0 && autres.length === 0 && (
          <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-50 border border-slate-200">
            Aucune pièce jointe n'est demandée pour ce voyage.
          </p>
        )}

        {requises.map((def) => {
          const found = pieces.map((p, i) => ({ p, i })).filter(({ p }) => p.type === def.id);
          return (
            <div
              key={def.id}
              className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                found.length ? 'bg-emerald-50/60 border-emerald-200' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-slate-800">
                {found.length ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span>{def.libelle}</span>
                {!found.length && (
                  <span className="ml-auto text-[10px] font-semibold text-slate-500">
                    {anySigned ? 'Non reçue' : 'En attente de signature'}
                  </span>
                )}
              </div>
              {found.map(({ p, i }) => fileRow(p, i))}
            </div>
          );
        })}

        {autres.length > 0 && (
          <div className="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-1.5">
            <div className="font-bold text-slate-800">{total > 0 ? 'Autres fichiers' : 'Fichiers téléversés'}</div>
            {autres.map(({ p, i }) => fileRow(p, i))}
          </div>
        )}
      </div>

      {notice && (
        <div
          className={`mt-2 p-2.5 rounded-lg text-[11px] flex items-start gap-1.5 ${
            notice.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'
          }`}
        >
          {notice.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          <span className="break-words">{notice.text}</span>
        </div>
      )}
    </div>
  );
};
