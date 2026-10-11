import { useState, useEffect, useMemo } from 'react';
import { FicheInfirmerieData, INITIAL_FICHE_DATA, NextcloudFileNode, SCHOOL_CLASSES, SCHOOL_YEARS, StaffProfile } from '../types';
import { getFicheFileName, getCarnetFileName, generateFichePDF, generateCarnetPDF } from '../utils/pdfGenerator';
import { FicheDocumentPreview } from './FicheDocumentPreview';
import { ClassManagementModal } from './ClassManagementModal';
import { EditStudentClassModal } from './EditStudentClassModal';
import { RgpdComplianceView } from './RgpdComplianceView';
import { ChangeStaffPasswordModal } from './ChangeStaffPasswordModal';
import { withStaffToken } from '../utils/apiAuth';
import { useSchoolName } from '../utils/branding';
import { SchoolBrandingModal } from './SchoolBrandingModal';
import { SchoolBranding } from '../types';
import {
  Search,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Eye,
  Folder,
  FolderOpen,
  File,
  Shield,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
  ChevronDown,
  Users,
  Plus,
  Edit2,
  Trash2,
  School,
  FileCheck,
  Check,
  X,
  Info,
  KeyRound
} from 'lucide-react';

interface AdminDashboardProps {
  schoolYear: string;
  onSchoolYearChange: (year: string) => void;
  onOpenNewForm: () => void;
  adminUser?: StaffProfile | { username: string; label?: string } | null;
  branding?: SchoolBranding;
  onBrandingChange?: (newBranding: SchoolBranding) => void;
}

export function AdminDashboard({
  schoolYear,
  onSchoolYearChange,
  onOpenNewForm,
  adminUser,
  branding,
  onBrandingChange,
}: AdminDashboardProps) {
  const nomEtab = useSchoolName();
  const [fiches, setFiches] = useState<FicheInfirmerieData[]>([]);
  const [classesList, setClassesList] = useState<string[]>(SCHOOL_CLASSES);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'by_class' | 'all_table' | 'archive_tree' | 'rgpd'>('by_class');

  // Accordion state for class by class view
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  // Preview modal target (replaces broken iframe with authentic zero-error preview)
  const [previewTarget, setPreviewTarget] = useState<{
    fiche: FicheInfirmerieData;
    type: 'fiche' | 'carnet';
  } | null>(null);

  // Class Management Modals
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [renamingClass, setRenamingClass] = useState<{ oldName: string; newName: string } | null>(null);
  const [deletingClass, setDeletingClass] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
  const [studentToEditClass, setStudentToEditClass] = useState<FicheInfirmerieData | null>(null);

  // Archive Tree State
  const [archiveTree, setArchiveTree] = useState<NextcloudFileNode | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);

  // Selected Fiche for detail modal
  const [selectedFicheDetail, setSelectedFicheDetail] = useState<FicheInfirmerieData | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Load classes from API
  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes');
      const json = await res.json();
      if (json.success && Array.isArray(json.classes) && json.classes.length > 0) {
        setClassesList(json.classes);
      }
    } catch (e) {
      console.error('Error fetching classes:', e);
    }
  };

  // Load fiches from API
  const fetchFiches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fiches');
      const json = await res.json();
      if (json.success) {
        // Fiches incomplètes (anciennes ou partielles) complétées avec la structure par défaut :
        // l'affichage ne plante jamais sur une rubrique absente
        const normalized = (Array.isArray(json.data) ? json.data : []).map((f: any) => {
          const out: any = { ...INITIAL_FICHE_DATA, ...f };
          for (const k of Object.keys(INITIAL_FICHE_DATA) as (keyof FicheInfirmerieData)[]) {
            const def: any = INITIAL_FICHE_DATA[k];
            if (def && typeof def === 'object' && !Array.isArray(def)) out[k] = { ...def, ...(f?.[k] || {}) };
          }
          out.historique = Array.isArray(f?.historique) ? f.historique : [];
          return out as FicheInfirmerieData;
        });
        setFiches(normalized);
      }
    } catch (e) {
      console.error('Error fetching fiches:', e);
    } finally {
      setLoading(false);
    }
  };

  // Load folder tree
  const fetchArchiveTree = async () => {
    setLoadingTree(true);
    try {
      const res = await fetch('/api/nextcloud/tree');
      const json = await res.json();
      if (json.success) {
        setArchiveTree(json.tree);
      }
    } catch (e) {
      console.error('Error fetching tree:', e);
    } finally {
      setLoadingTree(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchFiches();
    fetchArchiveTree();
  }, []);

  // Purge all archived files on server
  const handlePurgeArchives = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir PURGER tous les fichiers PDF et carnets archivés sur le serveur ? Cette action supprimera définitivement les fichiers stockés dans le dossier FICHES INFIRMERIE.')) {
      return;
    }

    try {
      const res = await fetch('/api/archives/purge', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        alert(json.message || 'Archives purgées avec succès.');
        await fetchArchiveTree();
      } else {
        alert(json.error || 'Erreur lors de la purge.');
      }
    } catch (e: any) {
      alert('Impossible de purger les archives : ' + e.message);
    }
  };

  // Delete a single archive file
  const handleDeleteArchiveFile = async (filePath: string, fileName: string) => {
    if (!window.confirm(`Supprimer le document "${fileName}" du serveur ?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/archives/file?path=${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        await fetchArchiveTree();
      } else {
        alert(json.error || 'Erreur lors de la suppression.');
      }
    } catch (e: any) {
      alert('Impossible de supprimer le fichier : ' + e.message);
    }
  };

  // Class Management Handlers
  const handleClassCreated = async (name: string) => {
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erreur création classe');
    setClassesList(json.classes);
  };

  const handleClassRenamed = async (oldName: string, newName: string) => {
    const res = await fetch('/api/classes/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldName, newName }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erreur renommage classe');
    setClassesList(json.classes);
    await fetchFiches();
  };

  const handleClassDeleted = async (name: string) => {
    const res = await fetch('/api/classes/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erreur suppression classe');
    setClassesList(json.classes);
    await fetchFiches();
  };

  const handleStudentClassUpdated = async (ficheId: string, newClass: string) => {
    const res = await fetch(`/api/fiches/${ficheId}/classe`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classe: newClass }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Erreur modification classe élève');
    await fetchFiches();
  };

  // Delete single fiche
  const handleDeleteFiche = async (fiche: FicheInfirmerieData) => {
    const studentName = `${fiche.eleve?.nom || ''} ${fiche.eleve?.prenom || ''}`.trim();
    if (!window.confirm(`Supprimer définitivement la fiche infirmerie de "${studentName}" ?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/fiches/${fiche.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        await fetchFiches();
      } else {
        alert(json.error || 'Erreur lors de la suppression.');
      }
    } catch (e: any) {
      alert('Impossible de supprimer la fiche : ' + e.message);
    }
  };

  // Purge all fiches
  const handlePurgeAllFiches = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir PURGER TOUTES les fiches infirmerie enregistrées ? Cette opération effacera la liste complète des élèves enregistrés.')) {
      return;
    }

    try {
      const res = await fetch('/api/fiches/purge', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        alert('Toutes les fiches infirmerie ont été purgées avec succès.');
        await fetchFiches();
      } else {
        alert(json.error || 'Erreur lors de la purge.');
      }
    } catch (e: any) {
      alert('Impossible de purger les fiches : ' + e.message);
    }
  };

  // Filter fiches
  const filteredFiches = useMemo(() => {
    return fiches.filter((fiche) => {
      // School year filter
      if (fiche.schoolYear && fiche.schoolYear !== schoolYear) {
        return false;
      }

      // Class filter
      if (selectedClass !== 'all' && fiche.eleve?.classe !== selectedClass) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'archive' && fiche.status !== 'transmise_nextcloud') return false;
        if (selectedStatus === 'signee' && !fiche.autorisationParentale?.signatureDataUrl) return false;
        if (selectedStatus === 'attente' && fiche.status === 'transmise_nextcloud') return false;
      }

      // Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const nom = (fiche.eleve?.nom || '').toLowerCase();
        const prenom = (fiche.eleve?.prenom || '').toLowerCase();
        const classe = (fiche.eleve?.classe || '').toLowerCase();
        const medecin = (fiche.eleve?.nomMedecinTraitant || '').toLowerCase();
        const resp = (fiche.responsableLegal?.nom || '').toLowerCase();

        return (
          nom.includes(q) ||
          prenom.includes(q) ||
          classe.includes(q) ||
          medecin.includes(q) ||
          resp.includes(q)
        );
      }

      return true;
    });
  }, [fiches, schoolYear, selectedClass, selectedStatus, searchTerm]);

  // Group fiches by class for "Classe par classe" view
  const fichesByClass = useMemo(() => {
    const map: Record<string, FicheInfirmerieData[]> = {};

    // First, populate all known classes
    classesList.forEach((cl) => {
      map[cl] = [];
    });

    // Place fiches in their respective classes
    filteredFiches.forEach((f) => {
      const cl = f.eleve?.classe?.trim() || 'Non assignée';
      if (!map[cl]) {
        map[cl] = [];
      }
      map[cl].push(f);
    });

    // Sort students alphabetically inside each class by NOM, then PRENOM
    Object.keys(map).forEach((cl) => {
      map[cl].sort((a, b) => {
        const nameA = `${a.eleve?.nom || ''} ${a.eleve?.prenom || ''}`.toLowerCase();
        const nameB = `${b.eleve?.nom || ''} ${b.eleve?.prenom || ''}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
    });

    return map;
  }, [classesList, filteredFiches]);

  // Toggle class accordion
  const toggleClassExpand = (className: string) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [className]: !prev[className],
    }));
  };

  const expandAllClasses = () => {
    const next: Record<string, boolean> = {};
    Object.keys(fichesByClass).forEach((cl) => {
      next[cl] = true;
    });
    setExpandedClasses(next);
  };

  const collapseAllClasses = () => {
    setExpandedClasses({});
  };

  // Download PDF helper
  const handleDownloadPDF = async (fiche: FicheInfirmerieData, type: 'fiche' | 'carnet') => {
    try {
      let blob: Blob;
      let title: string;
      if (type === 'fiche') {
        blob = await generateFichePDF(fiche);
        title = getFicheFileName(fiche);
      } else {
        blob = await generateCarnetPDF(fiche);
        title = getCarnetFileName(fiche);
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err: any) {
      alert(`Erreur génération PDF : ${err.message}`);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredFiches.length === 0) return;

    const headers = [
      'Classe',
      'Nom',
      'Prénom',
      'Date de naissance',
      'Adresse',
      'CP',
      'Ville',
      'Médecin traitant',
      'Tél Médecin',
      'Responsable Légal',
      'Statut Responsable',
      'Tél Perso Responsable',
      'Tél Pro Mère',
      'Tél Pro Père',
      'Contact Urgence',
      'Tél Urgence',
      'Vaccins à jour',
      'Carnet joint',
      'Allergies / Difficultés',
      'Fiche Signée',
      'Date Signature',
      'Statut Archivage',
    ];

    const rows = filteredFiches.map((f) => [
      `"${f.eleve.classe || ''}"`,
      `"${f.eleve.nom || ''}"`,
      `"${f.eleve.prenom || ''}"`,
      `"${f.eleve.dateNaissance || ''}"`,
      `"${(f.eleve.adresse || '').replace(/"/g, '""')}"`,
      `"${f.eleve.codePostal || ''}"`,
      `"${f.eleve.ville || ''}"`,
      `"${f.eleve.nomMedecinTraitant || ''}"`,
      `"${f.eleve.telMedecinTraitant || ''}"`,
      `"${(f.responsableLegal.nom || '').replace(/"/g, '""')}"`,
      `"${f.responsableLegal.statut || ''}"`,
      `"${f.responsableLegal.telPersonnel || ''}"`,
      `"${f.responsableLegal.telTravailMere || ''}"`,
      `"${f.responsableLegal.telTravailPere || ''}"`,
      `"${(f.urgenceAccident.nomPrenom || '').replace(/"/g, '""')}"`,
      `"${f.urgenceAccident.telPersonnel || ''}"`,
      `"${f.sante.vaccinations.antipoliomyelitique.status === 'a_jour' ? 'OUI' : 'NON'}"`,
      `"${(f.sante.carnetVaccinations || []).length > 0 ? 'OUI' : 'NON'}"`,
      `"${(f.sante.allergiesDifficultesSante || '').replace(/"/g, '""')}"`,
      `"${f.autorisationParentale?.signatureDataUrl ? 'OUI' : 'NON'}"`,
      `"${f.autorisationParentale?.dateHeureSignature ? new Date(f.autorisationParentale.dateHeureSignature).toLocaleDateString('fr-FR') : ''}"`,
      `"${f.status === 'transmise_nextcloud' ? 'Archivée' : 'En attente'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fiches_infirmerie_${schoolYear}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Summary counts
  const signedCount = filteredFiches.filter((f) => !!f.autorisationParentale?.signatureDataUrl).length;
  const carnetCount = filteredFiches.filter((f) => (f.sante.carnetVaccinations || []).length > 0).length;
  const archivedCount = filteredFiches.filter((f) => f.status === 'transmise_nextcloud').length;

  return (
    <div className="space-y-6">
      {/* Top Header & Stat Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2 text-blue-950">
              <School className="w-6 h-6 text-blue-900" />
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                Portail d'Administration de l'Infirmerie
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {nomEtab} • Année {schoolYear}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsBrandingModalOpen(true)}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-300 shadow-2xs"
              title="Modifier le nom officiel de l'établissement et téléverser votre logo"
            >
              <School className="w-4 h-4 text-blue-700" />
              <span>Identité & Logo</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-300 shadow-2xs"
              title="Modifier le mot de passe de la session active"
            >
              <KeyRound className="w-4 h-4 text-emerald-700" />
              <span>Mot de passe</span>
            </button>

            <button
              type="button"
              onClick={() => setIsClassModalOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
            >
              <Users className="w-4 h-4 text-blue-900" />
              <span>Gérer les Classes</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Exporter CSV</span>
            </button>

            <button
              type="button"
              onClick={onOpenNewForm}
              className="px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle Fiche</span>
            </button>

            <button
              type="button"
              onClick={() => {
                fetchFiches();
                fetchClasses();
                fetchArchiveTree();
              }}
              className="p-2 text-slate-600 hover:text-blue-950 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
              title="Rafraîchir les données"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-5">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
              <span>Total Élèves</span>
              <Users className="w-4 h-4 text-blue-900" />
            </div>
            <p className="text-2xl font-black text-slate-900">{filteredFiches.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{classesList.length} classes configurées</p>
          </div>

          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
            <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold mb-1">
              <span>Signatures Validées</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-950">{signedCount}</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              {filteredFiches.length > 0 ? Math.round((signedCount / filteredFiches.length) * 100) : 0}% des élèves
            </p>
          </div>

          <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between text-xs text-blue-900 font-semibold mb-1">
              <span>Carnets Reçus</span>
              <Shield className="w-4 h-4 text-blue-700" />
            </div>
            <p className="text-2xl font-black text-blue-950">{carnetCount}</p>
            <p className="text-[11px] text-blue-700 mt-0.5">
              {filteredFiches.length > 0 ? Math.round((carnetCount / filteredFiches.length) * 100) : 0}% conformes
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1">
              <span>Archivées & Protégées</span>
              <FileCheck className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">{archivedCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Stockage infirmerie</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('by_class')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'by_class'
                ? 'bg-blue-950 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Vue Classe par Classe (Recommandé)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all_table')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'all_table'
                ? 'bg-blue-950 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Tous les élèves (Vue à plat)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('archive_tree')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'archive_tree'
                ? 'bg-blue-950 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>Stockage & Fichiers Locaux (LXC)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rgpd')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'rgpd'
                ? 'bg-emerald-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Cahier des Charges RGPD & CNIL</span>
          </button>
        </div>

        {/* Global Search & Class Filter */}
        {(activeTab === 'by_class' || activeTab === 'all_table') && (
          <div className="flex items-center gap-2 w-full sm:w-auto px-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher élève, médecin..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeTab === 'by_class' && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={expandAllClasses}
                  className="px-2.5 py-1 text-blue-950 font-bold hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Déplier toutes les classes"
                >
                  Tout déplier
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={collapseAllClasses}
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Replier toutes les classes"
                >
                  Tout replier
                </button>
              </div>
            )}

            {/* Purge all student fiches button */}
            {fiches.length > 0 && (
              <button
                type="button"
                onClick={handlePurgeAllFiches}
                className="px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-xl flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                title="Purger toutes les fiches d'élèves enregistrées"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Purger les fiches</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: CLASSE PAR CLASSE (Core User Requirement) */}
      {activeTab === 'by_class' && (
        <div className="space-y-4">
          {Object.keys(fichesByClass).length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <School className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-base text-slate-700">Aucune classe trouvée</p>
              <p className="text-xs text-slate-500 mt-1">Créez votre première classe pour commencer.</p>
              <button
                type="button"
                onClick={() => setIsClassModalOpen(true)}
                className="mt-4 px-4 py-2 bg-blue-950 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Créer une classe
              </button>
            </div>
          ) : (
            Object.entries(fichesByClass).map(([className, classStudents]) => {
              const isExpanded = !!expandedClasses[className];
              const totalInClass = classStudents.length;
              const signedInClass = classStudents.filter((f) => !!f.autorisationParentale?.signatureDataUrl).length;
              const carnetInClass = classStudents.filter((f) => (f.sante.carnetVaccinations || []).length > 0).length;

              return (
                <div
                  key={className}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs transition-shadow hover:shadow-md"
                >
                  {/* Class Header Bar (Clicking on it expands/collapses the students list) */}
                  <div
                    onClick={() => toggleClassExpand(className)}
                    className="p-4 sm:px-6 bg-slate-50/80 hover:bg-slate-100/80 cursor-pointer flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 select-none transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-950 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-extrabold text-blue-950 tracking-tight">
                            Classe de {className}
                          </h2>
                          <span className="px-2.5 py-0.5 bg-blue-100 text-blue-950 font-bold text-xs rounded-full border border-blue-200">
                            {totalInClass} {totalInClass > 1 ? 'élèves' : 'élève'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {totalInClass > 0
                            ? `${signedInClass} signée(s) • ${carnetInClass} carnet(s) joint(s) — Cliquez pour ${isExpanded ? 'replier' : 'afficher'} la liste`
                            : 'Aucun élève enregistré dans cette classe'}
                        </p>
                      </div>
                    </div>

                    {/* Class indicators & quick actions */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingClass({ oldName: className, newName: className });
                        }}
                        className="p-1.5 text-slate-600 hover:text-blue-950 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                        title={`Modifier la classe "${className}"`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeletingClass(className);
                        }}
                        className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                        title={`Supprimer la classe "${className}"`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleClassExpand(className)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Masquer' : 'Voir les élèves'}</span>
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Student List */}
                  {isExpanded && (
                    <div className="p-0 overflow-x-auto">
                      {classStudents.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          Aucun élève n'est encore enregistré dans la classe de {className}.
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                              <th className="py-3 px-4">Élève & Identité</th>
                              <th className="py-3 px-4">Parents / Urgence</th>
                              <th className="py-3 px-4">Médecin</th>
                              <th className="py-3 px-4 text-center">Fiche</th>
                              <th className="py-3 px-4 text-center">Carnet</th>
                              <th className="py-3 px-4 text-center">Signature</th>
                              <th className="py-3 px-4 text-center">Archivage</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {classStudents.map((fiche) => {
                              const isComplete = !!fiche.eleve?.nom && !!fiche.eleve?.prenom && !!fiche.eleve?.classe;
                              const hasCarnet = (fiche.sante.carnetVaccinations || []).length > 0;
                              const isSigned = !!fiche.autorisationParentale?.signatureDataUrl;

                              return (
                                <tr key={fiche.id} className="hover:bg-blue-50/40 transition-colors">
                                  {/* Student Name */}
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-slate-900 text-sm">
                                      {fiche.eleve.nom.toUpperCase()} {fiche.eleve.prenom}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      Né(e) le {fiche.eleve.dateNaissance || '-'}
                                    </div>
                                  </td>

                                  {/* Parents */}
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-slate-800">
                                      {fiche.responsableLegal.nom}
                                    </div>
                                    <div className="text-[11px] text-blue-900 font-medium">
                                      {fiche.responsableLegal.telPersonnel || '-'}
                                    </div>
                                  </td>

                                  {/* Doctor */}
                                  <td className="py-3 px-4">
                                    <div className="font-medium text-slate-800">
                                      Dr {fiche.eleve.nomMedecinTraitant || '-'}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {fiche.eleve.telMedecinTraitant || '-'}
                                    </div>
                                  </td>

                                  {/* Fiche Status */}
                                  <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                      <CheckCircle2 className="w-3 h-3" /> Complète
                                    </span>
                                  </td>

                                  {/* Carnet Status */}
                                  <td className="py-3 px-4 text-center">
                                    {hasCarnet ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                        <CheckCircle2 className="w-3 h-3" /> {fiche.sante.carnetVaccinations?.length} doc(s)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                                        <AlertTriangle className="w-3 h-3" /> Manquant
                                      </span>
                                    )}
                                  </td>

                                  {/* Signature */}
                                  <td className="py-3 px-4 text-center">
                                    {isSigned ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                        <CheckCircle2 className="w-3 h-3" /> Signée
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                                        <Clock className="w-3 h-3" /> En attente
                                      </span>
                                    )}
                                  </td>

                                  {/* Storage Status */}
                                  <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">
                                      <Check className="w-3 h-3 text-emerald-600" /> Archivée
                                    </span>
                                  </td>

                                  {/* Actions */}
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {/* Eye button: Opens the authentic zero-failure FicheDocumentPreview modal */}
                                      <button
                                        type="button"
                                        onClick={() => setPreviewTarget({ fiche, type: 'fiche' })}
                                        className="p-1.5 text-blue-900 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                                        title="Aperçu officiel de la Fiche Infirmerie (Sans bug iframe)"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>

                                      {/* Carnet Preview */}
                                      {hasCarnet && (
                                        <button
                                          type="button"
                                          onClick={() => setPreviewTarget({ fiche, type: 'carnet' })}
                                          className="p-1.5 text-emerald-800 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                                          title="Aperçu du Carnet de vaccinations"
                                        >
                                          <Shield className="w-4 h-4" />
                                        </button>
                                      )}

                                      {/* Direct PDF Download */}
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadPDF(fiche, 'fiche')}
                                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                        title="Télécharger le PDF A4"
                                      >
                                        <Download className="w-4 h-4" />
                                      </button>

                                      {/* Change student's class */}
                                      <button
                                        type="button"
                                        onClick={() => setStudentToEditClass(fiche)}
                                        className="p-1.5 text-slate-600 hover:text-blue-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                        title="Modifier la classe de cet élève"
                                      >
                                        <School className="w-4 h-4" />
                                      </button>

                                      {/* Details modal */}
                                      <button
                                        type="button"
                                        onClick={() => setSelectedFicheDetail(fiche)}
                                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                        title="Voir l'historique et les détails"
                                      >
                                        <Info className="w-4 h-4" />
                                      </button>

                                      {/* Delete single fiche */}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteFiche(fiche)}
                                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                        title="Supprimer cette fiche"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: FLAT TABLE VIEW */}
      {activeTab === 'all_table' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Liste globale des fiches infirmerie ({filteredFiches.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Classe</th>
                  <th className="py-3 px-4">Élève</th>
                  <th className="py-3 px-4">Responsable</th>
                  <th className="py-3 px-4">Médecin</th>
                  <th className="py-3 px-4 text-center">Fiche</th>
                  <th className="py-3 px-4 text-center">Carnet</th>
                  <th className="py-3 px-4 text-center">Signature</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiches.map((fiche) => (
                  <tr key={fiche.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-950 font-bold rounded-lg text-xs">
                        {fiche.eleve.classe}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {fiche.eleve.nom.toUpperCase()} {fiche.eleve.prenom}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {fiche.responsableLegal.nom} ({fiche.responsableLegal.telPersonnel})
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      Dr {fiche.eleve.nomMedecinTraitant || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        Complète
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {(fiche.sante.carnetVaccinations || []).length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          Reçu
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                          Manquant
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {fiche.autorisationParentale?.signatureDataUrl ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          Signée
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                          En attente
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewTarget({ fiche, type: 'fiche' })}
                          className="p-1.5 text-blue-900 hover:bg-blue-100 rounded-lg cursor-pointer"
                          title="Aperçu officiel de la fiche"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(fiche, 'fiche')}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="Télécharger PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentToEditClass(fiche)}
                          className="p-1.5 text-slate-600 hover:text-blue-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="Changer de classe"
                        >
                          <School className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFiche(fiche)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Supprimer cette fiche"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LOCAL SERVER STORAGE & FILE TREE */}
      {activeTab === 'archive_tree' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-blue-950" />
                <h2 className="text-base font-bold text-blue-950 uppercase tracking-tight">
                  Stockage Local des Archives (Serveur Debian 12 LXC)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tous les PDF des fiches et copies des carnets de vaccination sont conservés directement sur le disque dur local de votre serveur.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>100 % Local & Autonome</span>
              </span>
              <button
                type="button"
                onClick={fetchArchiveTree}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-200"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTree ? 'animate-spin' : ''}`} />
                <span>Actualiser l'arborescence</span>
              </button>
            </div>
          </div>

          {/* Local Storage System Diagnostics Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block uppercase mb-1">
                Emplacement physique sur le serveur
              </span>
              <p className="font-mono text-xs text-blue-950 font-bold break-all">
                /opt/ndm-sante/donnees/infirmerie/archives/
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Dossier racine local hébergé dans le conteneur Proxmox LXC.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block uppercase mb-1">
                Base de données & pièces jointes
              </span>
              <p className="font-mono text-xs text-blue-950 font-bold break-all">
                /opt/ndm-sante/donnees/infirmerie/fiches.enc
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Contient l'intégralité des données, signatures et scans de carnets.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 block uppercase mb-1">
                Statut de connectivité
              </span>
              <p className="text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Autonomie totale (Sans Nextcloud)</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Aucune dépendance cloud extérieure requise.
              </p>
            </div>
          </div>

          {/* Local Folder Tree View */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Explorateur des fichiers PDF & Carnets sur le serveur :
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchArchiveTree}
                  disabled={loadingTree}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  title="Actualiser la liste"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingTree ? 'animate-spin' : ''}`} />
                  <span>Actualiser</span>
                </button>
                <button
                  type="button"
                  onClick={handlePurgeArchives}
                  className="px-3 py-1 text-xs font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Purger tous les fichiers PDF et carnets de l'explorateur serveur"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purger la liste</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 font-mono text-xs shadow-inner max-h-[500px] overflow-y-auto">
              {archiveTree ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-bold border-b border-slate-800 pb-2">
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                    <span>{archiveTree.name} / (Dossier racine local)</span>
                  </div>

                  <div className="pl-4 space-y-2 border-l border-slate-800 ml-2">
                    {(archiveTree.children || []).map((yearNode) => (
                      <div key={yearNode.name} className="space-y-2">
                        <div className="flex items-center gap-2 text-blue-300 font-bold">
                          <Folder className="w-4 h-4 text-blue-400" />
                          <span>Année {yearNode.name} /</span>
                        </div>

                        <div className="pl-5 space-y-2 border-l border-slate-800 ml-2">
                          {(yearNode.children || []).map((classNode) => (
                            <div key={classNode.name} className="space-y-1.5">
                              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                                <Folder className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Classe {classNode.name} / ({classNode.children?.length || 0} document(s))</span>
                              </div>

                              <div className="pl-5 space-y-1 border-l border-slate-800 ml-2">
                                {(classNode.children || []).length === 0 ? (
                                  <span className="text-[11px] text-slate-500 italic">
                                    Aucun fichier déposé dans cette classe
                                  </span>
                                ) : (
                                  (classNode.children || []).map((fileNode) => (
                                    <div
                                      key={fileNode.name}
                                      className="flex items-center justify-between gap-3 p-1.5 rounded-lg hover:bg-slate-800/80 transition-colors group"
                                    >
                                      <div className="flex items-center gap-2 text-slate-300 group-hover:text-white truncate">
                                        <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{fileNode.name}</span>
                                        {fileNode.size && (
                                          <span className="text-[10px] text-slate-500 shrink-0">
                                            ({Math.round(fileNode.size / 1024)} Ko)
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <a
                                          href={withStaffToken(`/api/download-file?path=${encodeURIComponent(fileNode.path)}`)}
                                          download
                                          className="px-2 py-1 bg-blue-900/60 hover:bg-blue-800 text-blue-200 hover:text-white rounded-md text-[10px] font-sans font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                          title="Télécharger ce document depuis le serveur"
                                        >
                                          <Download className="w-3 h-3" />
                                          <span>Télécharger</span>
                                        </a>

                                        <button
                                          type="button"
                                          onClick={() => handleDeleteArchiveFile(fileNode.path, fileNode.name)}
                                          className="p-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white rounded-md transition-colors cursor-pointer"
                                          title={`Supprimer ${fileNode.name} du serveur`}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                  <p>Chargement de l'arborescence locale du serveur...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CAHIER DES CHARGES & REGISTRE RGPD */}
      {activeTab === 'rgpd' && <RgpdComplianceView />}

      {/* Zero-Failure Official Document Preview Modal */}
      {previewTarget && (
        <FicheDocumentPreview
          fiche={previewTarget.fiche}
          initialTab={previewTarget.type}
          onClose={() => setPreviewTarget(null)}
        />
      )}

      {/* Class Management Modal */}
      {isClassModalOpen && (
        <ClassManagementModal
          classes={classesList}
          onClose={() => setIsClassModalOpen(false)}
          onClassCreated={handleClassCreated}
          onClassRenamed={handleClassRenamed}
          onClassDeleted={handleClassDeleted}
        />
      )}

      {/* Edit Single Student's Class Modal */}
      {studentToEditClass && (
        <EditStudentClassModal
          fiche={studentToEditClass}
          classes={classesList}
          onClose={() => setStudentToEditClass(null)}
          onClassUpdated={handleStudentClassUpdated}
        />
      )}

      {/* Rename Class Modal (100% iframe & sandboxed safe) */}
      {renamingClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-900" />
                <h3 className="font-bold text-sm text-blue-950">
                  Modifier le nom de la classe
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRenamingClass(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-slate-600">
                Vous modifiez la classe : <strong className="text-slate-900 font-bold">{renamingClass.oldName}</strong>
              </p>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Nouveau nom de la classe :
                </label>
                <input
                  type="text"
                  autoFocus
                  value={renamingClass.newName}
                  onChange={(e) => setRenamingClass({ ...renamingClass, newName: e.target.value })}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (renamingClass.newName.trim() && renamingClass.newName.trim() !== renamingClass.oldName) {
                        try {
                          await handleClassRenamed(renamingClass.oldName, renamingClass.newName.trim());
                          setRenamingClass(null);
                        } catch (err: any) {
                          alert(err.message);
                        }
                      } else {
                        setRenamingClass(null);
                      }
                    }
                    if (e.key === 'Escape') setRenamingClass(null);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none text-slate-900 font-semibold"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                La mise à jour sera répercutée automatiquement sur tous les élèves et dossiers associés.
              </p>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRenamingClass(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (renamingClass.newName.trim() && renamingClass.newName.trim() !== renamingClass.oldName) {
                    try {
                      await handleClassRenamed(renamingClass.oldName, renamingClass.newName.trim());
                      setRenamingClass(null);
                    } catch (err: any) {
                      alert(err.message);
                    }
                  } else {
                    setRenamingClass(null);
                  }
                }}
                disabled={!renamingClass.newName.trim()}
                className="px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Enregistrer la modification</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Class Confirmation Modal (100% iframe safe) */}
      {deletingClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-xs animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-900">
                  Supprimer la classe
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-slate-700 text-sm">
                Êtes-vous sûr de vouloir supprimer la classe <strong className="text-slate-900 font-bold">"{deletingClass}"</strong> ?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Conservation des données élèves :</span>
                </div>
                <p>
                  Les élèves inscrits dans cette classe seront conservés et basculés automatiquement dans le statut <strong>"Non assignée"</strong>. Aucune donnée médicale n'est détruite.
                </p>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await handleClassDeleted(deletingClass);
                    setDeletingClass(null);
                  } catch (err: any) {
                    alert(err.message);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <ChangeStaffPasswordModal
          currentStaff={adminUser || { username: 'admin', label: 'Direction / Administrateur' }}
          onClose={() => setIsPasswordModalOpen(false)}
        />
      )}

      {/* School Branding & Logo Modal */}
      {isBrandingModalOpen && (
        <SchoolBrandingModal
          isOpen={isBrandingModalOpen}
          branding={branding}
          onClose={() => setIsBrandingModalOpen(false)}
          onSaved={(newB) => {
            if (onBrandingChange) onBrandingChange(newB);
          }}
        />
      )}

      {/* Fiche Detail & Audit Log Modal */}
      {selectedFicheDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm text-blue-950">
                Historique et Traçabilité • {selectedFicheDetail.eleve.nom.toUpperCase()} {selectedFicheDetail.eleve.prenom}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedFicheDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-slate-700 block uppercase">Journal des actions :</span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                {(selectedFicheDetail.historique || []).map((h, i) => (
                  <div key={i} className="text-[11px] flex items-start gap-2">
                    <span className="text-slate-400 shrink-0 font-mono">
                      {new Date(h.date).toLocaleDateString('fr-FR')} {new Date(h.date).toLocaleTimeString('fr-FR')}
                    </span>
                    <span className="text-slate-700 font-medium">{h.action}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedFicheDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
