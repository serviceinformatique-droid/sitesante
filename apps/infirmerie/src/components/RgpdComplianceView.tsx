import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  FileText,
  Server,
  Download,
  Printer,
  CheckCircle2,
  Users,
  Eye,
  AlertTriangle,
  Building,
  Key,
  Edit3,
  Save,
  RotateCcw,
  Check,
  X,
  ExternalLink,
  Terminal,
  Copy
} from 'lucide-react';
import {
  DEFAULT_RGPD_CONFIG,
  RgpdSchoolConfig,
  generateRgpdAttestationPDF
} from '../utils/rgpdPdfGenerator';

export function RgpdComplianceView() {
  const [activeSection, setActiveSection] = useState<
    'synthese' | 'registre' | 'securite' | 'droits' | 'full_text' | 'edit' | 'lxc_guide'
  >('synthese');
  const [cryptoStatus, setCryptoStatus] = useState<any>(null);

  // Dynamic RGPD Config & Markdown
  const [config, setConfig] = useState<RgpdSchoolConfig>(DEFAULT_RGPD_CONFIG);
  const [markdownText, setMarkdownText] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Attestation print/preview modal
  const [showAttestationModal, setShowAttestationModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch Crypto Status
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCryptoStatus(data.encryption);
        }
      })
      .catch(() => {});

    // 2. Fetch full RGPD document and custom config from server
    fetch('/api/rgpd/cahier-des-charges')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.markdown) setMarkdownText(data.markdown);
          if (data.config) {
            setConfig((prev) => ({ ...prev, ...data.config }));
          }
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleDownloadPDF = async () => {
    try {
      const doc = await generateRgpdAttestationPDF(config);
      const cleanName = (config.etablissement || 'Etablissement')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 30);
      doc.save(`Attestation_Conformite_RGPD_${cleanName}_${config.schoolYear || '2026-2027'}.pdf`);
    } catch (err: any) {
      alert('Erreur lors de la génération du PDF : ' + err.message);
    }
  };

  const handleDownloadMarkdown = () => {
    const textToDownload = markdownText || '';
    const blob = new Blob([textToDownload], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CAHIER_DES_CHARGES_RGPD_${(config.schoolYear || '2026-2027').replace('-', '_')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/rgpd/cahier-des-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown: markdownText,
          config: config,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Erreur lors de la sauvegarde');
      setSaveMessage({ type: 'success', text: 'Cahier des charges et registre RGPD enregistrés avec succès !' });
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Erreur réseau lors de la sauvegarde' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!window.confirm('Voulez-vous vraiment rétablir le modèle officiel de départ ? Toutes vos modifications seront remplacées.')) {
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/rgpd/cahier-des-charges/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMarkdownText(data.markdown);
        setConfig(DEFAULT_RGPD_CONFIG);
        setSaveMessage({ type: 'success', text: 'Modèle officiel d’origine rétabli avec succès.' });
        setTimeout(() => setSaveMessage(null), 4000);
      }
    } catch (err: any) {
      alert('Erreur lors de la réinitialisation : ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const triggerDirectPrint = () => {
    // Generate printable HTML in an isolated hidden iframe to avoid sandbox/main window issues
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attestation de Conformite RGPD - ${config.etablissement}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 15px; font-size: 11pt; line-height: 1.4; }
            .header { background: #0f172a; color: white; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-bottom: 4px solid #1e3a8a; }
            .header h1 { font-size: 14pt; margin: 0 0 6px 0; text-transform: uppercase; font-weight: 800; }
            .header p { font-size: 9pt; margin: 0; opacity: 0.9; }
            .title-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
            .title-box h2 { font-size: 12pt; margin: 0 0 4px 0; color: #1e293b; }
            .title-box p { font-size: 9pt; margin: 0; color: #475569; }
            .section-title { font-size: 10pt; font-weight: bold; background: #f1f5f9; padding: 6px 10px; margin-top: 14px; margin-bottom: 8px; border-radius: 4px; border-left: 4px solid #1e3a8a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9pt; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
            th { background: #f8fafc; width: 35%; color: #334155; font-weight: bold; }
            .security-item { margin-bottom: 6px; font-size: 8.5pt; }
            .security-item strong { color: #1e3a8a; }
            .sign-grid { display: flex; justify-content: space-between; margin-top: 20px; gap: 20px; }
            .sign-box { flex: 1; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; background: #f8fafc; min-height: 90px; }
            .sign-box h4 { margin: 0 0 6px 0; font-size: 8.5pt; color: #64748b; text-transform: uppercase; }
            .stamp { color: #059669; font-weight: bold; font-size: 8pt; margin-top: 15px; border: 1px dashed #059669; padding: 4px 8px; display: inline-block; border-radius: 4px; }
            .footer { margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 7.5pt; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Attestation Officielle de Conformité RGPD & Santé Scolaire</h1>
            <p>Règlement UE 2016/679 • Loi Informatique et Libertés • Code de la Santé Publique</p>
            <p style="margin-top: 4px; font-size: 8pt;">Réf : ${config.reference} • Année Scolaire : ${config.schoolYear}</p>
          </div>

          <div class="title-box">
            <h2>Homologation du Traitement Informatisé des Fiches d'Infirmerie</h2>
            <p>Protection des données de santé scolaire, protocoles PAI, suivi vaccinal légal et secours d'urgence.</p>
          </div>

          <div class="section-title">1. Identité du Responsable du Traitement & DPO</div>
          <table>
            <tr><th>Établissement / Organisme</th><td>${config.etablissement} (${config.statut})</td></tr>
            <tr><th>Adresse Postale</th><td>${config.adresse}</td></tr>
            <tr><th>Responsable du Traitement</th><td>${config.responsable}</td></tr>
            <tr><th>Service Utilisateur</th><td>${config.service}</td></tr>
            <tr><th>Délégué Protection des Données</th><td>${config.contactDpo} • Tél : ${config.telephone}</td></tr>
          </table>

          <div class="section-title">2. Qualification Juridique & Bases Légales (Art. 6 & 9 du RGPD)</div>
          <table>
            <tr><th>Obligation Légale (Art. 6.1.c)</th><td>Art. L. 541-1 du Code de l'éducation & Art. L. 3111-2 du Code de la santé publique (vaccinations).</td></tr>
            <tr><th>Intérêts Vitaux (Art. 6.1.d)</th><td>Prise en charge des urgences vitales, allergies PAI, asthme aigu, transmission SAMU (15) et Pompiers (18).</td></tr>
            <tr><th>Dérogation Santé (Art. 9.2.h)</th><td>Médecine préventive en milieu scolaire sous secret médical absolu (Art. L. 1110-4 CSP).</td></tr>
          </table>

          <div class="section-title">3. Mesures de Sécurité Techniques Déployées (Art. 32 du RGPD)</div>
          <div class="security-item"><strong>• Chiffrement au repos AES-256-GCM :</strong> Toutes les bases (fiches, comptes, carnet) sont protégées par une clé 256 bits avec étiquette d'intégrité de 128 bits.</div>
          <div class="security-item"><strong>• Hachage cryptographique PBKDF2-SHA512 :</strong> Identifiants hachés avec sel aléatoire et 100 000 itérations. Questions secrètes salées.</div>
          <div class="security-item"><strong>• Hébergement 100% Souverain On-Premise :</strong> Conteneur local Debian 12 / Proxmox VE dans l'établissement. Zéro transfert vers Clouds tiers.</div>
          <div class="security-item"><strong>• Politique « Zéro Stockage Navigateur » :</strong> Cache-Control no-store. Aucune donnée médicale conservée sur les postes navigateurs.</div>

          <div class="section-title">4. Homologation & Engagement de Conformité</div>
          <p style="font-size: 8.5pt; color: #334155; margin: 6px 0;">
            Le présent document certifie que le traitement informatisé des données de santé scolaire mis en œuvre par ${config.etablissement} respecte strictement l'ensemble des exigences du RGPD et les préconisations de la CNIL. Fait à ${config.ville}, le ${config.dateEntree}.
          </p>

          <div class="sign-grid">
            <div class="sign-box">
              <h4>Pour le Responsable du Traitement</h4>
              <p style="font-size: 8pt; margin: 0; font-weight: bold;">${config.responsable}</p>
              <div class="stamp">CERTIFIÉ CONFORME & AUDITÉ</div>
            </div>
            <div class="sign-box">
              <h4>Pour le Délégué à la Protection des Données (DPO)</h4>
              <p style="font-size: 8pt; margin: 0; font-weight: bold;">Référent RGPD (${config.contactDpo})</p>
              <div class="stamp">REGISTRE ART. 30 DÛMENT TENU</div>
            </div>
          </div>

          <div class="footer">
            Document officiel certifié • ${config.etablissement} • Conservation légale au Registre du DPO
          </div>
        </body>
      </html>
    `;

    try {
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(content);
        doc.close();
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            // If window.print fails inside the iframe sandbox, fall back to downloading PDF!
            handleDownloadPDF();
          } finally {
            setTimeout(() => document.body.removeChild(iframe), 1500);
          }
        }, 400);
      } else {
        handleDownloadPDF();
      }
    } catch {
      handleDownloadPDF();
    }
  };

  return (
    <div className="space-y-6">
      {/* Save Notification Banner */}
      {saveMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
            saveMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {saveMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{saveMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-700">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Règlement UE 2016/679 & CNIL
                </span>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Santé Scolaire Art. 9
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                Cahier des Charges & Registre RGPD
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {config.etablissement} • Réf: {config.reference} • Année : {config.schoolYear}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveSection('edit')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                activeSection === 'edit'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300'
              }`}
            >
              <Edit3 className="w-4 h-4 text-amber-800" />
              <span>Modifier le RGPD</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
              title="Télécharger le fichier Markdown officiel (.MD)"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Cahier (.MD)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Télécharger immédiatement l'Attestation officielle de conformité RGPD au format PDF A4"
            >
              <Download className="w-4 h-4" />
              <span>Attestation PDF (A4)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAttestationModal(true)}
              className="px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Aperçu avant impression et impression directe de l'Attestation officielle"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer l'Attestation</span>
            </button>
          </div>
        </div>

        {/* 4 Pillars of Compliance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-5">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1.5">
              <span>Cryptage au repos</span>
              <Lock className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-base font-black text-slate-900">AES-256-GCM</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Bases chiffrées avec tag 128 bits. Zéro stockage médical en clair.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1.5">
              <span>Hébergement Local</span>
              <Server className="w-4 h-4 text-blue-700" />
            </div>
            <p className="text-base font-black text-slate-900">100% Souverain</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Conteneur Debian 12 / Proxmox. Aucune fuite vers le Cloud tiers.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1.5">
              <span>Secret Médical</span>
              <Eye className="w-4 h-4 text-indigo-700" />
            </div>
            <p className="text-base font-black text-slate-900">Cloisonné & Assermenté</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Art. L. 1110-4 CSP. Accès restreint à l'infirmière scolaire et secours (15).
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1.5">
              <span>Délégué (DPO)</span>
              <Building className="w-4 h-4 text-amber-700" />
            </div>
            <p className="text-base font-black text-slate-900 truncate" title={config.contactDpo}>
              {config.contactDpo}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {config.etablissement.length > 32
                ? config.etablissement.substring(0, 30) + '…'
                : config.etablissement}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSection('synthese')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeSection === 'synthese'
              ? 'bg-blue-950 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          Synthèse Réglementaire
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('registre')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeSection === 'registre'
              ? 'bg-blue-950 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          Fiche Registre Art. 30
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('securite')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeSection === 'securite'
              ? 'bg-blue-950 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          Mesures de Sécurité (Art. 32)
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('droits')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeSection === 'droits'
              ? 'bg-blue-950 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          Droits des Familles & DPO
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('full_text')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeSection === 'full_text'
              ? 'bg-blue-950 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          Texte Intégral du Cahier
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('edit')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSection === 'edit'
              ? 'bg-amber-600 text-white shadow-2xs'
              : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Édition du RGPD (Personnalisation)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('lxc_guide')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSection === 'lxc_guide'
              ? 'bg-slate-800 text-white shadow-2xs'
              : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-blue-600" />
          <span>Guide Déploiement LXC / GitHub</span>
        </button>
      </div>

      {/* SECTION: SYNTHÈSE */}
      {activeSection === 'synthese' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 text-blue-950">
              <Building className="w-5 h-5 text-blue-900" />
              <h3 className="font-bold text-sm">Finalités & Périmètre du Traitement</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Le traitement informatisé des fiches d'infirmerie de <strong>{config.etablissement}</strong> est strictement limité à l'organisation des soins
              scolaires, à la gestion des urgences vitales (allergies graves, PAI, asthme) et au contrôle de l'obligation
              vaccinale légale imposée aux établissements scolaires (Art. L. 3111-2 du CSP).
            </p>
            <div className="space-y-2 pt-2">
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Obligation légale (Art. 6.1.c)</strong> : Surveillance médicale et vaccinations réglementaires.
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Sauvegarde des intérêts vitaux (Art. 6.1.d)</strong> : Transmission immédiate aux secours (15 / 18).
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Dérogation Santé (Art. 9.2.h)</strong> : Traitement nécessaire à la médecine préventive scolaire.
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 text-blue-950">
              <Users className="w-5 h-5 text-blue-900" />
              <h3 className="font-bold text-sm">Cloisonnement & Secret Médical</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Les données de santé relèvent du secret médical absolu (Art. L. 1110-4 du Code de la santé
              publique). Aucun personnel non soignant n'a accès aux diagnostics confidentiels.
            </p>
            <div className="space-y-2 pt-2">
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>{config.service}</strong> : Accès intégral aux fiches, vaccins et historiques de soins.
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Services d'urgence (SAMU 15 / Pompiers)</strong> : Transmission de la fiche d'intervention en cas d'accident.
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Zéro tiers publicitaire</strong> : Aucun traceur, aucun cloud commercial étranger.
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 text-blue-950">
              <FileText className="w-5 h-5 text-blue-900" />
              <h3 className="font-bold text-sm">Durée de Conservation des Données</h3>
            </div>
            <ul className="text-xs text-slate-600 space-y-2.5">
              <li className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-medium text-slate-700">Fiche de santé active :</span>
                <span className="font-bold text-blue-950">1 année scolaire ({config.schoolYear})</span>
              </li>
              <li className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-medium text-slate-700">Copie Carnet de Vaccinations :</span>
                <span className="font-bold text-blue-950">Durée de scolarité dans l'établissement</span>
              </li>
              <li className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-medium text-slate-700">Autorisations de soins signées :</span>
                <span className="font-bold text-blue-950">1 an post-scolarité (prescription légale)</span>
              </li>
              <li className="flex justify-between">
                <span className="font-medium text-slate-700">Comptes d'accès parents :</span>
                <span className="font-bold text-blue-950">1 an après le départ du dernier enfant</span>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 text-blue-950">
              <Key className="w-5 h-5 text-blue-900" />
              <h3 className="font-bold text-sm">Exercice des Droits des Familles</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Les parents d'élèves bénéficient d'un droit d'accès permanent à leur dossier, d'un droit de rectification
              immédiate en cas de changement de situation (téléphone, médecin, traitement) et d'un droit d'effacement au terme de la scolarité.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
              <p className="font-bold text-blue-950">Contact Référent RGPD / DPO :</p>
              <p className="mt-0.5 text-slate-600">Email : <code className="text-blue-900 font-mono">{config.contactDpo}</code></p>
              <p className="mt-0.5 text-slate-600">{config.etablissement} • {config.adresse}</p>
              <p className="text-[11px] text-slate-500 mt-1">Autorité de contrôle : CNIL (www.cnil.fr)</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: REGISTRE ART. 30 */}
      {activeSection === 'registre' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-black text-base text-blue-950">
              Registre des Activités de Traitement (Article 30 du RGPD)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Fiche n° {config.reference} annexée au registre officiel de l'établissement
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50 w-1/3">Organisme Responsable</td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {config.etablissement} ({config.ville})
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50">Statut Juridique</td>
                  <td className="py-2.5 px-3 text-slate-700">{config.statut}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50">Représentant Légal</td>
                  <td className="py-2.5 px-3 text-slate-700">{config.responsable}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50">Délégué Protection des Données (DPO)</td>
                  <td className="py-2.5 px-3 text-slate-700">{config.contactDpo} • {config.telephone}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50">Finalité Principale</td>
                  <td className="py-2.5 px-3 text-slate-700">
                    Gestion dématérialisée des fiches infirmerie, protocoles d'accueil individualisé (PAI) et vérification de la conformité vaccinale légale
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50">Personnes Concernées</td>
                  <td className="py-2.5 px-3 text-slate-700">
                    Élèves mineurs scolarisés (de la maternelle au lycée) et leurs représentants légaux
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50">Catégories de Données</td>
                  <td className="py-2.5 px-3 text-slate-700">
                    État civil, coordonnées d'urgence des parents, médecin traitant, allergies, asthme, pathologies, vaccins obligatoires, copies numérisées du carnet de santé, signature manuscrite horodatée
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50">Destinataires Internes</td>
                  <td className="py-2.5 px-3 text-slate-700">{config.service} sous secret professionnel médical (Art. L. 1110-4 CSP)</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50">Destinataires Externes</td>
                  <td className="py-2.5 px-3 text-slate-700">Services d'urgence médicale (SAMU 15, Pompiers 18, SMUR) en cas d'accident ou de détresse vitale</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50">Transferts hors Union Européenne</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">AUCUN (Hébergement 100% On-Premise dans l'établissement)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50">Mesures de Sécurité</td>
                  <td className="py-2.5 px-3 text-slate-700">
                    Chiffrement AES-256-GCM au repos, hachage PBKDF2-SHA512 des mots de passe, question secrète salée, cloisonnement réseau, sauvegardes chiffrées
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: SÉCURITÉ */}
      {activeSection === 'securite' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="font-black text-base text-blue-950">
                Mesures Techniques et Organisationnelles (Article 32 du RGPD)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit des mécanismes cryptographiques et d'infrastructure déployés
              </p>
            </div>
            {cryptoStatus && (
              <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Moteur Cryptographique Actif : {cryptoStatus.algorithm} ({cryptoStatus.keyLength} bits)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Chiffrement AES-256-GCM</span>
              </div>
              <p className="text-xs text-slate-600">
                Toutes les fiches élèves, comptes et brouillons sont encapsulés dans des conteneurs chiffrés avec IV unique et tag d'authentification anti-altération.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Fichiers : fiches.enc, accounts.enc, draft.enc
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Key className="w-4 h-4 text-blue-700" />
                <span>Hachage Salé PBKDF2</span>
              </div>
              <p className="text-xs text-slate-600">
                Mots de passe parents et infirmerie/admin hachés avec 100 000 itérations SHA-512. Réponses secrètes normalisées et hachées.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Sel aléatoire de 128 bits par compte
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Server className="w-4 h-4 text-purple-700" />
                <span>Zero Client Storage</span>
              </div>
              <p className="text-xs text-slate-600">
                Aucune donnée médicale ni identifiant n'est stocké dans le navigateur. Cache HTTP verrouillé avec <code className="text-[10px] bg-white px-1 border rounded">no-store</code>.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Protection des postes publics/partagés
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: DROITS DES FAMILLES */}
      {activeSection === 'droits' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-black text-base text-blue-950">
              Procédure d'Exercice des Droits des Personnes Concernées
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Conformément aux articles 15 à 22 du RGPD et à la loi Informatique et Libertés
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <h4 className="font-bold text-slate-900">1. Droit d'Accès & Transparence (Art. 15)</h4>
              <p className="text-slate-600 leading-relaxed">
                Les parents peuvent consulter et exporter à tout moment la fiche complète de leur enfant au format PDF officiel depuis leur espace personnel.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <h4 className="font-bold text-slate-900">2. Droit de Rectification (Art. 16)</h4>
              <p className="text-slate-600 leading-relaxed">
                En cas de déménagement, changement de numéro d'urgence ou d'évolution de pathologie, le dossier peut être actualisé immédiatement en ligne ou auprès de l'infirmière.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <h4 className="font-bold text-slate-900">3. Droit à l'Effacement (Art. 17)</h4>
              <p className="text-slate-600 leading-relaxed">
                Applicable dès la fin de scolarité de l'élève, dans le respect des délais légaux de conservation des pièces engageant la responsabilité de l'établissement.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <h4 className="font-bold text-slate-900">4. Droit de Réclamation (Art. 77)</h4>
              <p className="text-slate-600 leading-relaxed">
                Les parents peuvent saisir à tout moment la Commission Nationale de l'Informatique et des Libertés (CNIL) sur son site officiel www.cnil.fr.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 text-xs">
            <div className="font-bold text-sm flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-400" />
              <span>Modalités de Contact du Délégué à la Protection des Données (DPO)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Pour toute question relative à la gestion des données de santé ou pour faire valoir vos droits :
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-4 text-slate-200">
              <span>📧 Courriel : <strong>{config.contactDpo}</strong></span>
              <span>🏢 Adresse : {config.adresse}</span>
              <span>⏱️ Délai de réponse garanti : sous 30 jours ouvrés</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: TEXTE INTÉGRAL */}
      {activeSection === 'full_text' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-sm text-blue-950">
                Texte Intégral Officiel du Cahier des Charges RGPD
              </h3>
              <p className="text-[11px] text-slate-500">
                Document source : <code className="font-mono text-slate-700">/CAHIER_DES_CHARGES_RGPD.md</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveSection('edit')}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                <span>Modifier ce texte</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Exporter .MD</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-800 font-mono max-h-[600px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {markdownText || 'Chargement du document officiel...'}
          </div>
        </div>
      )}

      {/* SECTION: ÉDITION COMPLÈTE DU RGPD (USER REQUEST: TOUT LE RGPD DOIT ÊTRE MODIFIABLE) */}
      {activeSection === 'edit' && (
        <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">
                  Éditeur & Personnalisation Complète du RGPD
                </h3>
                <p className="text-xs text-slate-500">
                  Modifiez les coordonnées de l'établissement, le responsable, le DPO et le texte intégral du cahier des charges.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isSaving}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
                title="Rétablir le modèle officiel d'origine"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>Rétablir modèle d'origine</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}</span>
              </button>
            </div>
          </div>

          {/* Form Block: Metadata Fields */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-blue-900" />
              <span>1. Variables Officielles de l'Établissement & DPO</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nom de l'Établissement :</label>
                <input
                  type="text"
                  value={config.etablissement}
                  onChange={(e) => setConfig({ ...config, etablissement: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Statut Juridique :</label>
                <input
                  type="text"
                  value={config.statut}
                  onChange={(e) => setConfig({ ...config, statut: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adresse Postale Complète :</label>
                <input
                  type="text"
                  value={config.adresse}
                  onChange={(e) => setConfig({ ...config, adresse: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Responsable du Traitement :</label>
                <input
                  type="text"
                  value={config.responsable}
                  onChange={(e) => setConfig({ ...config, responsable: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Utilisateur Interne :</label>
                <input
                  type="text"
                  value={config.service}
                  onChange={(e) => setConfig({ ...config, service: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact DPO (Email) :</label>
                <input
                  type="text"
                  value={config.contactDpo}
                  onChange={(e) => setConfig({ ...config, contactDpo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Téléphone de Contact :</label>
                <input
                  type="text"
                  value={config.telephone}
                  onChange={(e) => setConfig({ ...config, telephone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Année Scolaire de Référence :</label>
                <input
                  type="text"
                  value={config.schoolYear}
                  onChange={(e) => setConfig({ ...config, schoolYear: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Référence du Document :</label>
                <input
                  type="text"
                  value={config.reference}
                  onChange={(e) => setConfig({ ...config, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ville de Signature :</label>
                <input
                  type="text"
                  value={config.ville}
                  onChange={(e) => setConfig({ ...config, ville: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date d'Entrée en Vigueur :</label>
                <input
                  type="text"
                  value={config.dateEntree}
                  onChange={(e) => setConfig({ ...config, dateEntree: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-900 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Markdown Full Text Editor */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-900" />
                <span>2. Éditeur du Texte Intégral du Cahier des Charges (Markdown)</span>
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                {markdownText.length} caractères • {markdownText.split('\n').length} lignes
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Vous pouvez adapter chaque clause, ajouter vos propres mentions, modifier les numéros d'articles ou les règles d'archivage spécifiques à votre établissement.
            </p>

            <textarea
              rows={18}
              value={markdownText}
              onChange={(e) => setMarkdownText(e.target.value)}
              className="w-full p-4 border border-slate-300 rounded-xl font-mono text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-900 focus:outline-none leading-relaxed"
              placeholder="Contenu Markdown du cahier des charges..."
            />
          </div>

          {/* Bottom Action Bar */}
          <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Les modifications enregistrées mettent immédiatement à jour le document officiel, les exports PDF et Markdown.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveSection('synthese')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Fermer l'éditeur
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Enregistrement en cours...' : 'Enregistrer tout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: GUIDE DÉPLOIEMENT LXC / PROXMOX / GITHUB */}
      {activeSection === 'lxc_guide' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5 text-blue-950">
              <Terminal className="w-6 h-6 text-blue-900" />
              <div>
                <h3 className="font-black text-base text-slate-900">
                  Guide Complet : Déployer et Pousser depuis GitHub sur votre Conteneur LXC (Proxmox / Debian)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Procédure pas à pas avec commandes prêtes à copier pour installer, compiler et automatiser le démarrage de l'application.
                </p>
              </div>
            </div>
          </div>

          {/* Step 1 */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-950 text-white flex items-center justify-center text-[11px]">1</span>
              <span>Connexion au conteneur LXC et installation des prérequis</span>
            </h4>
            <p className="text-slate-600">
              Sur votre hôte Proxmox ou via la console du conteneur LXC Debian 12 / Ubuntu :
            </p>
            <div className="relative bg-slate-950 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto">
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `# Mise à jour du système\napt update && apt upgrade -y\n\n# Installation de Git, curl et des outils de compilation\napt install -y git curl build-essential\n\n# Installation de Node.js 22 LTS\ncurl -fsSL https://deb.nodesource.com/setup_22.x | bash -\napt install -y nodejs\n\n# Vérification des versions\nnode -v\nnpm -v`,
                    'step1'
                  )
                }
                className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] flex items-center gap-1 cursor-pointer"
              >
                {copiedCode === 'step1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode === 'step1' ? 'Copié' : 'Copier'}</span>
              </button>
              <pre>{`# 1. Mise à jour du système
apt update && apt upgrade -y

# 2. Installation de Git, curl et outils système
apt install -y git curl build-essential

# 3. Installation de Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# 4. Vérification
node -v   # v22.x.x
npm -v    # 10.x.x`}</pre>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-950 text-white flex items-center justify-center text-[11px]">2</span>
              <span>Cloner le dépôt GitHub dans /opt/infirmerie</span>
            </h4>
            <p className="text-slate-600">
              Clonez votre dépôt GitHub (remplacez l'URL par la vôtre ou utilisez une clé SSH / Deploy Key si le dépôt est privé) :
            </p>
            <div className="relative bg-slate-950 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto">
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `mkdir -p /opt/infirmerie\ncd /opt/infirmerie\n\n# Si dépôt public ou avec token :\ngit clone https://github.com/VOTRE_ORGANISATION/infirmerie-scolaire.git .\n\n# Installation des dépendances\nnpm install\n\n# Compilation du frontend Vite et du backend esbuild\nnpm run build`,
                    'step2'
                  )
                }
                className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] flex items-center gap-1 cursor-pointer"
              >
                {copiedCode === 'step2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode === 'step2' ? 'Copié' : 'Copier'}</span>
              </button>
              <pre>{`mkdir -p /opt/infirmerie
cd /opt/infirmerie

# Cloner le dépôt GitHub (adapter l'URL) :
git clone https://github.com/VOTRE_ORGANISATION/infirmerie-scolaire.git .

# Installer toutes les dépendances
npm install

# Compiler le frontend et le serveur de production
npm run build`}</pre>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-950 text-white flex items-center justify-center text-[11px]">3</span>
              <span>Création du Service systemd (Port 3001 pour éviter le conflit avec DocuSeal sur le 3000)</span>
            </h4>
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-[11px] leading-relaxed">
              <strong>⚠️ Attention au conflit de port :</strong> Le conteneur <code>docuseal</code> écoute déjà sur le port <strong>3000</strong> (<code>0.0.0.0:3000</code>). Nous configurons donc l'application infirmerie sur le port <strong>3001</strong> (ou 8090) via <code>Environment=PORT=3001</code> pour un fonctionnement simultané sans aucun conflit.
            </div>
            <p className="text-slate-600">
              Créez le fichier de service pour que l'application tourne en tâche de fond et redémarre automatiquement :
            </p>
            <div className="relative bg-slate-950 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto">
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `cat << 'EOF' > /etc/systemd/system/infirmerie.service\n[Unit]\nDescription=Application Infirmerie Scolaire NDM\nAfter=network.target\n\n[Service]\nType=simple\nUser=root\nWorkingDirectory=/opt/infirmerie\nExecStart=/usr/bin/node dist/server.cjs\nRestart=always\nRestartSec=5\nEnvironment=NODE_ENV=production\nEnvironment=PORT=3001\n\n[Install]\nWantedBy=multi-user.target\nEOF\n\n# Activation et démarrage du service\nsystemctl daemon-reload\nsystemctl enable infirmerie\nsystemctl start infirmerie\n\n# Vérifier le statut\nsystemctl status infirmerie`,
                    'step3'
                  )
                }
                className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] flex items-center gap-1 cursor-pointer"
              >
                {copiedCode === 'step3' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode === 'step3' ? 'Copié' : 'Copier'}</span>
              </button>
              <pre>{`cat << 'EOF' > /etc/systemd/system/infirmerie.service
[Unit]
Description=Application Infirmerie Scolaire NDM
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/infirmerie
ExecStart=/usr/bin/node dist/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

# Recharger systemd et démarrer le service sur le port 3001
systemctl daemon-reload
systemctl enable infirmerie
systemctl start infirmerie

# Vérifier que le statut est bien "active (running)"
systemctl status infirmerie`}</pre>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-950 text-white flex items-center justify-center text-[11px]">4</span>
              <span>Script de mise à jour quotidienne / automatique (deploy.sh)</span>
            </h4>
            <p className="text-slate-600">
              Pour récupérer vos derniers commits GitHub et redémarrer l'application en 1 seule commande :
            </p>
            <div className="relative bg-slate-950 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto">
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `cat << 'EOF' > /opt/infirmerie/deploy.sh\n#!/bin/bash\nset -e\ncd /opt/infirmerie\necho "📥 Récupération des nouveautés GitHub..."\ngit pull\n\necho "📦 Installation des dépendances..."\nnpm install\n\necho "🔨 Compilation de production..."\nnpm run build\n\necho "🔄 Redémarrage du service..."\nsystemctl restart infirmerie\n\necho "✅ Déploiement terminé avec succès !"\nEOF\n\nchmod +x /opt/infirmerie/deploy.sh\n\n# Pour mettre à jour à tout moment, lancez simplement :\n/opt/infirmerie/deploy.sh`,
                    'step4'
                  )
                }
                className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] flex items-center gap-1 cursor-pointer"
              >
                {copiedCode === 'step4' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode === 'step4' ? 'Copié' : 'Copier'}</span>
              </button>
              <pre>{`cat << 'EOF' > /opt/infirmerie/deploy.sh
#!/bin/bash
set -e
cd /opt/infirmerie
echo "📥 Récupération des nouveautés GitHub..."
git pull

echo "📦 Installation des dépendances..."
npm install

echo "🔨 Compilation de production..."
npm run build

echo "🔄 Redémarrage du service..."
systemctl restart infirmerie

echo "✅ Déploiement terminé avec succès !"
EOF

chmod +x /opt/infirmerie/deploy.sh

# Pour déployer à chaque nouvelle version :
/opt/infirmerie/deploy.sh`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APERÇU OFFICIEL & IMPRESSION ATTESTATION */}
      {showAttestationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 text-xs my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-blue-950">
                <Printer className="w-5 h-5 text-blue-900" />
                <h3 className="font-bold text-sm text-slate-900">
                  Attestation Officielle de Conformité RGPD (Prête à imprimer)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAttestationModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Official Document Preview Frame */}
            <div className="border border-slate-300 rounded-xl p-6 bg-slate-50 space-y-4 shadow-inner max-h-[60vh] overflow-y-auto">
              <div className="bg-slate-900 text-white p-4 rounded-lg">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  RÉPUBLIQUE FRANÇAISE • ENSEIGNEMENT CATHOLIQUE SOUS CONTRAT D'ASSOCIATION
                </p>
                <h4 className="text-sm font-black mt-1">
                  ATTESTATION OFFICIELLE DE CONFORMITÉ RGPD & SANTÉ SCOLAIRE
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Règlement (UE) 2016/679 • Réf : {config.reference} • Année : {config.schoolYear}
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-3.5 rounded-lg space-y-1">
                <p className="font-bold text-slate-900 text-xs">
                  Établissement : {config.etablissement}
                </p>
                <p className="text-[11px] text-slate-600">Statut : {config.statut}</p>
                <p className="text-[11px] text-slate-600">Adresse : {config.adresse}</p>
                <p className="text-[11px] text-slate-600">
                  Responsable : <strong>{config.responsable}</strong> • DPO :{' '}
                  <strong className="text-blue-900">{config.contactDpo}</strong>
                </p>
              </div>

              <div className="bg-white border border-slate-200 p-3.5 rounded-lg space-y-1.5">
                <p className="font-bold text-slate-900 text-xs">
                  Bases Légales & Dérogations Données Sensibles (Art. 6 & 9) :
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                  <li>Art. 6.1.c RGPD : Obligation légale de santé scolaire et vaccinations.</li>
                  <li>Art. 6.1.d RGPD : Sauvegarde des intérêts vitaux et protocoles d'urgence PAI.</li>
                  <li>Art. 9.2.h RGPD : Médecine préventive en milieu scolaire sous secret médical.</li>
                </ul>
              </div>

              <div className="bg-white border border-slate-200 p-3.5 rounded-lg space-y-1.5">
                <p className="font-bold text-slate-900 text-xs">
                  Mesures Techniques Certifiées (Art. 32) :
                </p>
                <p className="text-[11px] text-slate-600">
                  Chiffrement AES-256-GCM au repos avec étiquette d'intégrité de 128 bits. Hachage salé PBKDF2-SHA512 (100 000 itérations). Hébergement souverain local Debian 12 / Proxmox. Aucun transfert tiers publicitaire.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-200 text-[11px]">
                <div>
                  <p className="font-bold text-slate-900">Fait à {config.ville}, le {config.dateEntree}</p>
                  <p className="text-slate-500">Pour le Responsable du Traitement</p>
                  <p className="text-emerald-700 font-bold mt-1">[ CERTIFIÉ CONFORME ]</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">Délégué Protection des Données</p>
                  <p className="text-slate-500">{config.contactDpo}</p>
                  <p className="text-emerald-700 font-bold mt-1">[ REGISTRE ART. 30 VALIDÉ ]</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAttestationModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={triggerDirectPrint}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer directement</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger le PDF Officiel (A4)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
