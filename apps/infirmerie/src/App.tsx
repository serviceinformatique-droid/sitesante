import { useState, useEffect } from 'react';
import { FicheInfirmerieData, INITIAL_FICHE_DATA, ParentProfile, SchoolBranding } from './types';
import { Header } from './components/Header';
import { StudentFormSection } from './components/StudentFormSection';
import { HealthFormSection } from './components/HealthFormSection';
import { AuthorizationSection } from './components/AuthorizationSection';
import { ReviewModalOrStep } from './components/ReviewModalOrStep';
import { ConfirmationSuccess } from './components/ConfirmationSuccess';
import { AdminDashboard } from './components/AdminDashboard';
import { ParentAuthCard } from './components/ParentAuthCard';
import { AdminLoginCard } from './components/AdminLoginCard';
import { generateFichePDF, generateCarnetPDF } from './utils/pdfGenerator';
import { clearSession, SESSION_EXPIRED_EVENT } from './utils/apiAuth';
import { setSchoolName, NOM_PAR_DEFAUT } from './utils/branding';
import {
  User,
  HeartPulse,
  FileCheck,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Shield,
} from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'parent_form' | 'admin_dashboard'>('parent_form');
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null);
  const [adminAuthenticated, setAdminAuthenticated] = useState<boolean>(false);
  const [adminProfile, setAdminProfile] = useState<{ username: string; label?: string } | null>(null);
  const [schoolYear, setSchoolYear] = useState<string>('2026-2027');
  const [step, setStep] = useState<number>(0);
  const [formData, setFormData] = useState<FicheInfirmerieData>(() => ({
    ...INITIAL_FICHE_DATA,
    schoolYear: '2026-2027',
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedFiche, setSubmittedFiche] = useState<FicheInfirmerieData | null>(null);
  const [fichePdfBlob, setFichePdfBlob] = useState<Blob | null>(null);
  const [carnetPdfBlob, setCarnetPdfBlob] = useState<Blob | null>(null);
  const [branding, setBranding] = useState<SchoolBranding>({
    schoolName: NOM_PAR_DEFAUT,
    subTitle: "Sous-contrat d'Association avec l'État",
    logoDataUrl: '',
  });

  // Fetch school branding from server
  useEffect(() => {
    fetch('/api/branding')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.branding) {
          setBranding(data.branding);
          setSchoolName(data.branding.schoolName);
        }
      })
      .catch(() => {});
  }, []);

  // 100% Server Authoritative: brouillon DU PARENT CONNECTÉ (chargé uniquement après sa connexion)
  useEffect(() => {
    if (!parentProfile) return;
    fetch('/api/draft')
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && resData.draft) {
          setFormData((prev) => ({ ...prev, ...resData.draft }));
        }
      })
      .catch((err) => console.log('Draft fetch error:', err));
  }, [parentProfile?.id]);

  // Session expirée côté serveur (redémarrage, inactivité > 8 h) : retour à l'écran de connexion
  useEffect(() => {
    const onExpired = () => {
      setAdminAuthenticated(false);
      setAdminProfile(null);
      setParentProfile(null);
      setNotification({ type: 'error', message: 'Votre session a expiré. Veuillez vous reconnecter.' });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // 100% Server Authoritative: Debounced sync draft to server (nothing stored in localStorage/browser cache)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Autosave to server if a parent is connected and at least some student data is entered
      if (parentProfile && (formData.eleve.nom || formData.eleve.classe || formData.eleve.prenom)) {
        fetch('/api/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }).catch(() => {});
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [formData]);

  // Keep schoolYear updated in form
  useEffect(() => {
    setFormData((prev) => ({ ...prev, schoolYear }));
  }, [schoolYear]);

  // Validation function per step
  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 0) {
      // Step 1: Eleve & Responsables
      if (!formData.eleve.classe) newErrors.classe = 'La classe est obligatoire.';
      if (!formData.eleve.nom.trim()) newErrors.nom = 'Le nom de famille est obligatoire.';
      if (!formData.eleve.prenom.trim()) newErrors.prenom = 'Le prénom est obligatoire.';
      if (!formData.eleve.dateNaissance) newErrors.dateNaissance = 'La date de naissance est obligatoire.';
      if (!formData.eleve.adresse.trim()) newErrors.adresse = "L'adresse est obligatoire.";
      if (!formData.eleve.codePostal.trim()) newErrors.codePostal = 'Le code postal est obligatoire.';
      if (!formData.eleve.ville.trim()) newErrors.ville = 'La ville est obligatoire.';
      if (!formData.eleve.nomMedecinTraitant.trim()) newErrors.nomMedecinTraitant = 'Le nom du médecin traitant est obligatoire.';
      if (!formData.eleve.telMedecinTraitant.trim()) newErrors.telMedecinTraitant = 'Le téléphone du médecin traitant est obligatoire.';

      if (!formData.responsableLegal.nom.trim()) newErrors.nomResponsable = 'Le nom du responsable légal est obligatoire.';
      if (!formData.responsableLegal.telPersonnel.trim()) newErrors.telPersonnelResponsable = 'Le numéro personnel est obligatoire.';
      if (!formData.responsableLegal.telTravailMere.trim() && !formData.responsableLegal.telTravailMereNonConcerne) {
        newErrors.telTravailMere = 'Précisez un numéro ou cochez "Non concerné".';
      }
      if (!formData.responsableLegal.telTravailPere.trim() && !formData.responsableLegal.telTravailPereNonConcerne) {
        newErrors.telTravailPere = 'Précisez un numéro ou cochez "Non concerné".';
      }
    } else if (currentStep === 1) {
      // Step 2: Contact Urgence, Vaccinations & Allergies
      if (!formData.urgenceAccident.nomPrenom.trim()) newErrors.urgenceNomPrenom = 'Le contact d’urgence est obligatoire.';
      if (!formData.urgenceAccident.telPersonnel.trim()) newErrors.urgenceTelPersonnel = 'Le téléphone d’urgence est obligatoire.';
      if (!formData.urgenceAccident.adresse.trim()) newErrors.urgenceAdresse = "L'adresse du contact d'urgence est obligatoire.";
      if (!formData.urgenceAccident.telTravail.trim() && !formData.urgenceAccident.telTravailNonConcerne) {
        newErrors.urgenceTelTravail = 'Précisez un numéro ou cochez "Non concerné".';
      }

      // Obligatory Vaccination Record copy
      if (!formData.sante.carnetVaccinations || formData.sante.carnetVaccinations.length === 0) {
        newErrors.carnetVaccinations = 'Le dépôt d’une copie du carnet de vaccinations est obligatoire.';
      }

      // Allergies
      if (!formData.sante.allergiesDifficultesSante.trim() && !formData.sante.aucuneAllergie) {
        newErrors.allergies = 'Veuillez préciser vos allergies ou cocher "Aucune allergie".';
      }
    } else if (currentStep === 2) {
      // Step 3: Authorization, Signature & GDPR
      if (!formData.autorisationParentale.soussigneNomPrenom.trim()) {
        newErrors.soussigne = 'Le nom et prénom du signataire sont obligatoires.';
      }
      if (!formData.autorisationParentale.accordPriseEnCharge) {
        newErrors.accordPriseEnCharge = "L'autorisation de prise en charge d'urgence est obligatoire.";
      }
      if (!formData.autorisationParentale.faitA.trim()) {
        newErrors.faitA = 'Le lieu est obligatoire.';
      }
      if (!formData.autorisationParentale.signatureDataUrl) {
        newErrors.signature = 'La signature électronique est obligatoire.';
      }
      if (!formData.consentementDonneesSante.accepteCollecteEtTransmission) {
        newErrors.consentement = 'Le consentement RGPD sur les données de santé est obligatoire.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setErrors({});
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 200, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit and upload to Nextcloud
  const handleFinalSubmit = async () => {
    if (!validateStep(2)) {
      setStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Generate official PDFs on the fly
      const pdfFiche = await generateFichePDF(formData);
      const pdfCarnet = await generateCarnetPDF(formData);

      setFichePdfBlob(pdfFiche);
      setCarnetPdfBlob(pdfCarnet);

      // Convert to Base64 for the API
      const toBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

      const [pdfFicheBase64, pdfCarnetBase64] = await Promise.all([
        toBase64(pdfFiche),
        toBase64(pdfCarnet),
      ]);

      // 2. Post to backend
      const res = await fetch('/api/fiches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          pdfFicheBase64,
          pdfCarnetBase64,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSubmittedFiche(json.data);
        setStep(4); // Step 4 is success screen
        fetch('/api/draft', { method: 'DELETE' }).catch(() => {});
        setNotification({
          type: 'success',
          message: 'Fiche infirmerie validée et transmise avec succès !',
        });
      } else {
        setNotification({
          type: 'error',
          message: `Erreur lors de l'enregistrement : ${json.error || 'Erreur inconnue'}`,
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Erreur de transmission : ${err.message}`,
      });
    } finally {
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Pre-fill demo data for rapid evaluation
  const loadDemoData = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 400, 160);
      ctx.strokeStyle = '#0F2557';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(40, 80);
      ctx.bezierCurveTo(90, 20, 120, 140, 160, 70);
      ctx.bezierCurveTo(200, 30, 250, 130, 320, 60);
      ctx.stroke();
    }
    const fakeSig = canvas.toDataURL('image/png');

    // Sample carnet
    const carnetCanvas = document.createElement('canvas');
    carnetCanvas.width = 600;
    carnetCanvas.height = 800;
    const cctx = carnetCanvas.getContext('2d');
    if (cctx) {
      cctx.fillStyle = '#FFFFFF';
      cctx.fillRect(0, 0, 600, 800);
      cctx.fillStyle = '#14274E';
      cctx.font = 'bold 22px Arial';
      cctx.fillText('RÉPUBLIQUE FRANÇAISE', 170, 70);
      cctx.font = 'bold 26px Arial';
      cctx.fillText('CARNET DE SANTÉ / VACCINATIONS', 80, 115);
      cctx.strokeStyle = '#14274E';
      cctx.lineWidth = 3;
      cctx.strokeRect(40, 140, 520, 600);
      cctx.fillStyle = '#2B3A42';
      cctx.font = '16px Arial';
      cctx.fillText('• Vaccins DTP : À JOUR (Rappel 2024)', 60, 240);
      cctx.fillText('• Coqueluche : À JOUR', 60, 290);
      cctx.fillText('• BCG : FAIT', 60, 340);
      cctx.fillText('• ROR : À JOUR', 60, 390);
    }
    const fakeCarnet = carnetCanvas.toDataURL('image/jpeg', 0.9);

    setFormData({
      id: `fiche-${Date.now()}`,
      schoolYear,
      status: 'signee',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eleve: {
        classe: '6ème B',
        nom: 'LECLERC',
        prenom: 'Thomas',
        dateNaissance: '2014-05-12',
        adresse: '14 Rue de Paris',
        codePostal: '94220',
        ville: 'Charenton-le-Pont',
        nomMedecinTraitant: 'Garnier',
        telMedecinTraitant: '01 43 76 89 20',
      },
      responsableLegal: {
        nom: 'LECLERC Alexandre',
        statut: 'pere',
        telPersonnel: '06 11 22 33 44',
        telTravailMere: '01 42 00 11 22',
        telTravailMereNonConcerne: false,
        telTravailPere: '01 48 99 88 77',
        telTravailPereNonConcerne: false,
      },
      urgenceAccident: {
        nomPrenom: 'LECLERC Hélène (Grand-mère)',
        telPersonnel: '06 99 88 77 66',
        telTravail: '',
        telTravailNonConcerne: true,
        adresse: '3 Avenue de Verdun, 94220 Charenton-le-Pont',
      },
      sante: {
        vaccinations: {
          antipoliomyelitique: { status: 'a_jour', date: '2024' },
          antidiphterique: { status: 'a_jour', date: '2024' },
          antitetanique: { status: 'a_jour', date: '2024' },
          anticoqueluche: { status: 'a_jour', date: '2024' },
          antituberculeux_bcg: { status: 'a_jour', date: '2015' },
        },
        carnetVaccinations: [
          {
            id: `doc-${Date.now()}`,
            name: 'Carnet_vaccinations_Thomas_Leclerc.jpg',
            type: 'image/jpeg',
            size: 198000,
            dataUrl: fakeCarnet,
            uploadedAt: new Date().toISOString(),
          },
        ],
        allergiesDifficultesSante: 'Légère intolérance au lactose. Aucun traitement régulier.',
        aucuneAllergie: false,
      },
      autorisationParentale: {
        soussigneNomPrenom: 'LECLERC Alexandre',
        qualite: 'pere',
        nomEnfant: 'Thomas LECLERC',
        accordPriseEnCharge: true,
        accordActesMedicaux: true,
        faitA: 'Charenton-le-Pont',
        faitLe: new Date().toLocaleDateString('fr-FR'),
        signatureDataUrl: fakeSig,
        mentionLuEtApprouve: true,
        signataireNomComplet: 'LECLERC Alexandre',
        dateHeureSignature: new Date().toISOString(),
      },
      consentementDonneesSante: {
        accepteCollecteEtTransmission: true,
        dateConsentement: new Date().toISOString(),
      },
      historique: [
        {
          date: new Date().toISOString(),
          action: 'Exemple démo pré-rempli',
        },
      ],
    });
    setErrors({});
  };

  const handleResetForm = () => {
    setFormData({ ...INITIAL_FICHE_DATA, schoolYear });
    setSubmittedFiche(null);
    setFichePdfBlob(null);
    setCarnetPdfBlob(null);
    setStep(0);
    fetch('/api/draft', { method: 'DELETE' }).catch(() => {});
  };

  const handleParentLoginSuccess = (profile: ParentProfile) => {
    setParentProfile(profile);
    setFormData((prev) => ({
      ...prev,
      responsableLegal: {
        ...prev.responsableLegal,
        nom: prev.responsableLegal.nom || `${profile.nom} ${profile.prenom}`.trim(),
        telPersonnel: prev.responsableLegal.telPersonnel || profile.telephone,
      },
      autorisationParentale: {
        ...prev.autorisationParentale,
        soussigneNomPrenom: prev.autorisationParentale.soussigneNomPrenom || `${profile.nom} ${profile.prenom}`.trim(),
        signataireNomComplet: prev.autorisationParentale.signataireNomComplet || `${profile.nom} ${profile.prenom}`.trim(),
      },
    }));
    setNotification({
      type: 'success',
      message: `Bienvenue ${profile.prenom} ${profile.nom} ! Vous pouvez maintenant compléter la fiche de votre enfant.`,
    });
  };

  const handleParentLogout = () => {
    clearSession('parent');
    setParentProfile(null);
    // Le formulaire est vidé : le parent suivant sur le même appareil ne voit rien
    setFormData({ ...INITIAL_FICHE_DATA, schoolYear });
    setSubmittedFiche(null);
    setFichePdfBlob(null);
    setCarnetPdfBlob(null);
    setStep(0);
    setNotification({
      type: 'info',
      message: 'Vous avez été déconnecté de votre espace parent.',
    });
  };

  const handleAdminLoginSuccess = (admin: { username: string; label?: string; mustChangePassword?: boolean }) => {
    setAdminAuthenticated(true);
    setAdminProfile(admin);
    setNotification(
      admin.mustChangePassword
        ? {
            type: 'error',
            message: `Session ${admin.label || admin.username} ouverte — ⚠️ ce compte utilise encore le mot de passe initial : changez-le immédiatement (bouton « Mot de passe » du tableau de bord).`,
          }
        : {
            type: 'success',
            message: `Session ${admin.label || admin.username} ouverte avec succès.`,
          }
    );
  };

  const handleAdminLogout = () => {
    clearSession('staff');
    setAdminAuthenticated(false);
    setAdminProfile(null);
    setNotification({
      type: 'info',
      message: 'Session administrative fermée.',
    });
  };

  // Steps breadcrumb
  const stepsMetadata = [
    { label: 'Élève & Parents', icon: User, desc: 'Identité et contacts' },
    { label: 'Santé & Vaccins', icon: HeartPulse, desc: 'Urgences & carnet' },
    { label: 'Autorisation', icon: FileCheck, desc: 'Signature & RGPD' },
    { label: 'Vérification', icon: CheckCircle2, desc: 'Relecture intégrale' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Header with logo at top-left, session status, and 100% encryption badge */}
      <Header
        currentView={viewMode}
        onViewChange={(mode) => setViewMode(mode)}
        schoolYear={schoolYear}
        onSchoolYearChange={(year) => setSchoolYear(year)}
        parentProfile={parentProfile}
        onParentLogout={handleParentLogout}
        adminAuthenticated={adminAuthenticated}
        adminProfile={adminProfile}
        onAdminLogout={handleAdminLogout}
        branding={branding}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {notification && (
          <div
            className={`mb-4 p-4 rounded-xl border flex items-center justify-between text-sm transition-all ${
              notification.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <span>{notification.message}</span>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="ml-4 text-xs font-bold underline cursor-pointer"
            >
              Fermer
            </button>
          </div>
        )}

        {/* View Mode Switching: Admin vs Parent */}
        {viewMode === 'admin_dashboard' ? (
          !adminAuthenticated ? (
            <AdminLoginCard
              onSuccess={handleAdminLoginSuccess}
              onBackToParent={() => setViewMode('parent_form')}
            />
          ) : (
            <AdminDashboard
              schoolYear={schoolYear}
              onSchoolYearChange={(y) => setSchoolYear(y)}
              onOpenNewForm={() => {
                handleResetForm();
                setViewMode('parent_form');
              }}
              adminUser={adminProfile}
              branding={branding}
              onBrandingChange={(newB) => {
                setBranding(newB);
                setSchoolName(newB.schoolName);
              }}
            />
          )
        ) : (
          !parentProfile ? (
            <ParentAuthCard
              onSuccess={handleParentLoginSuccess}
              onSwitchToAdmin={() => setViewMode('admin_dashboard')}
            />
          ) : (
            <div className="space-y-6">
            {/* Mode Banner & Quick Demo Pre-fill */}
            {step < 4 && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 px-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Formulaire conforme à la fiche infirmerie officielle de l’établissement • Tous les champs sont obligatoires
                  </span>
                </div>

                <button
                  type="button"
                  onClick={loadDemoData}
                  className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-900 font-semibold px-3 py-1.5 rounded-lg border border-blue-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Pré-remplit les champs avec un exemple complet pour tester immédiatement le formulaire"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                  <span>Pré-remplir avec un exemple d'élève</span>
                </button>
              </div>
            )}

            {/* Stepper Progress Bar (only during steps 0 to 3) */}
            {step < 4 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                  {stepsMetadata.map((s, idx) => {
                    const Icon = s.icon;
                    const isActive = step === idx;
                    const isCompleted = step > idx;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (step > idx) setStep(idx);
                        }}
                        disabled={step < idx}
                        className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                          isActive
                            ? 'bg-blue-950 text-white shadow-xs'
                            : isCompleted
                            ? 'bg-emerald-50/70 text-emerald-950 hover:bg-emerald-100/80 cursor-pointer'
                            : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                            isActive
                              ? 'bg-blue-800 text-white'
                              : isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {isCompleted ? '✓' : idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{s.label}</p>
                          <p className={`text-[11px] truncate ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>
                            {s.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Errors alert if any */}
            {Object.keys(errors).length > 0 && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide">
                    Certains renseignements obligatoires sont incomplets :
                  </h4>
                  <ul className="list-disc pl-5 mt-1 text-xs space-y-0.5 text-rose-700">
                    {Object.values(errors).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Step 0 : Élève & Responsables */}
            {step === 0 && (
              <StudentFormSection
                data={formData}
                onChange={setFormData}
                onNext={handleNext}
                errors={errors}
              />
            )}

            {/* Step 1 : Santé & Vaccinations */}
            {step === 1 && (
              <HealthFormSection
                data={formData}
                onChange={setFormData}
                onNext={handleNext}
                onPrev={handlePrev}
                errors={errors}
              />
            )}

            {/* Step 2 : Autorisation & Signature */}
            {step === 2 && (
              <AuthorizationSection
                data={formData}
                onChange={setFormData}
                onNext={handleNext}
                onPrev={handlePrev}
                errors={errors}
              />
            )}

            {/* Step 3 : Récapitulatif & Validation préalable */}
            {step === 3 && (
              <ReviewModalOrStep
                data={formData}
                onEditSection={(stepIdx) => setStep(stepIdx)}
                onFinalSubmit={handleFinalSubmit}
                isSubmitting={isSubmitting}
              />
            )}

            {/* Step 4 : Succès & Téléchargement */}
            {step === 4 && (
              <ConfirmationSuccess
                data={submittedFiche || formData}
                fichePdfBlob={fichePdfBlob}
                carnetPdfBlob={carnetPdfBlob}
                onReset={handleResetForm}
                onGoToAdmin={() => setViewMode('admin_dashboard')}
              />
            )}
          </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 space-y-1">
          <p className="font-semibold text-slate-700">
            {branding.schoolName} • Service Médical & Infirmerie
          </p>
          <p>
            Plateforme conforme RGPD • Archivage sécurisé • Fiches infirmerie & Carnets de vaccinations numérisés
          </p>
        </div>
      </footer>
    </div>
  );
}
