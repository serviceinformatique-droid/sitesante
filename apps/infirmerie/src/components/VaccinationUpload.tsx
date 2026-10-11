import { useState, useRef } from 'react';
import { Upload, FileText, Image as ImageIcon, Trash2, Eye, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import { UploadedFile } from '../types';

interface VaccinationUploadProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
}

export function VaccinationUpload({ files, onChange }: VaccinationUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);

  const processFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newUploadedFiles: UploadedFile[] = [];

    Array.from(fileList).forEach((file) => {
      // Accept PDF, PNG, JPEG, JPG
      if (!file.type.match(/(pdf|image\/(jpeg|png|jpg|webp))/i)) {
        alert(`Format non supporté pour ${file.name}. Formats acceptés : PDF, JPG, PNG.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const uploaded: UploadedFile = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
          uploadedAt: new Date().toISOString(),
        };

        onChange([...files, uploaded]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  // Sample carnet generator for instant 1-click testing
  const addSampleCarnet = () => {
    // Generate a clean sample carnet image canvas
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 600, 800);

      // Header
      ctx.fillStyle = '#14274E';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('RÉPUBLIQUE FRANÇAISE', 170, 70);
      ctx.font = 'bold 26px Arial';
      ctx.fillText('CARNET DE SANTÉ / VACCINATIONS', 80, 115);

      ctx.strokeStyle = '#14274E';
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 140, 520, 600);

      // Lines & stamps
      ctx.fillStyle = '#2B3A42';
      ctx.font = '16px Arial';
      ctx.fillText('Vaccinations obligatoires :', 60, 190);
      ctx.fillText('• Diphtérie - Tétanos - Poliomyélite (DTP) : À JOUR', 60, 240);
      ctx.fillText('• Coqueluche : À JOUR', 60, 290);
      ctx.fillText('• BCG (Tuberculose) : VACCINÉ', 60, 340);
      ctx.fillText('• Rougeole - Oreillons - Rubéole (ROR) : À JOUR', 60, 390);

      ctx.strokeStyle = '#BDC3C7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, 440);
      ctx.lineTo(540, 440);
      ctx.stroke();

      // Official looking doctor stamp
      ctx.strokeStyle = '#27AE60';
      ctx.lineWidth = 2;
      ctx.strokeRect(320, 500, 200, 90);
      ctx.fillStyle = '#27AE60';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('DR. V. GARNIER', 360, 535);
      ctx.font = '12px Arial';
      ctx.fillText('Médecin Généraliste', 365, 555);
      ctx.fillText('Certifié conforme', 370, 575);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const sample: UploadedFile = {
        id: `sample-${Date.now()}`,
        name: 'Copie_Carnet_Vaccinations_Page1.jpg',
        type: 'image/jpeg',
        size: 142000,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      };
      onChange([...files, sample]);
    }
  };

  return (
    <div id="vaccination-upload-module" className="space-y-4">
      {/* Obligatory alert callout */}
      <div className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
        files.length > 0
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          : 'bg-rose-50 border-rose-200 text-rose-950'
      }`}>
        {files.length > 0 ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <h4 className="text-sm font-bold flex items-center gap-2">
            Copie du carnet de vaccinations obligatoire
            {files.length > 0 && (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                {files.length} document{files.length > 1 ? 's' : ''} joint{files.length > 1 ? 's' : ''}
              </span>
            )}
          </h4>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Veuillez joindre obligatoirement une copie lisible de la page des vaccinations du carnet de santé de l’élève (formats acceptés : PDF, JPG/JPEG, PNG). Vous pouvez ajouter plusieurs photos si nécessaire.
          </p>
        </div>

        {files.length === 0 && (
          <button
            type="button"
            onClick={addSampleCarnet}
            className="text-xs bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 font-semibold px-2.5 py-1.5 rounded-lg shrink-0 shadow-2xs transition-colors"
          >
            + Exemple de test
          </button>
        )}
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-blue-700 bg-blue-50/50 scale-[0.99]'
            : 'border-slate-300 hover:border-blue-900 bg-white hover:bg-slate-50/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,image/png,image/jpeg,image/jpg"
          onChange={(e) => processFiles(e.target.files)}
          className="hidden"
        />

        <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-950 flex items-center justify-center mb-3">
          <Upload className="w-6 h-6" />
        </div>

        <p className="text-sm font-semibold text-slate-800">
          Glissez-déposez la copie de votre carnet ici, ou{' '}
          <span className="text-blue-900 underline">parcourez vos fichiers</span>
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Prenez une photo nette avec votre smartphone ou déposez un fichier PDF / Image (max 15 Mo)
        </p>
      </div>

      {/* List of uploaded files */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Documents transmis ({files.length}) :
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-medium text-blue-900 hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter une autre page / photo
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {files.map((file, idx) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-colors"
              >
                {file.type.includes('pdf') ? (
                  <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center shrink-0 overflow-hidden relative">
                    <img
                      src={file.dataUrl}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate" title={file.name}>
                    Page {idx + 1} — {file.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {Math.round(file.size / 1024)} Ko • {new Date(file.uploadedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    className="p-1.5 text-slate-500 hover:text-blue-950 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Aperçu du document"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 truncate max-w-md">
                  {previewFile.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {previewFile.type} • {Math.round(previewFile.size / 1024)} Ko
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 min-h-[300px]">
              {previewFile.type.includes('pdf') ? (
                <div className="text-center p-8 bg-white rounded-xl shadow-xs">
                  <FileText className="w-16 h-16 text-rose-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-800">Fichier PDF joint</p>
                  <p className="text-xs text-slate-500 mt-1">{previewFile.name}</p>
                  <a
                    href={previewFile.dataUrl}
                    download={previewFile.name}
                    className="mt-4 inline-block text-xs font-semibold px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800"
                  >
                    Télécharger pour consulter
                  </a>
                </div>
              ) : (
                <img
                  src={previewFile.dataUrl}
                  alt={previewFile.name}
                  className="max-h-[70vh] object-contain rounded-lg shadow-xs"
                />
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-700"
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
