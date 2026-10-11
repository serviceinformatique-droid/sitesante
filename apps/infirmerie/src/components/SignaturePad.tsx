import { useRef, useState, useEffect } from 'react';
import { RotateCcw, Trash2, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  signerName: string;
}

export function SignaturePad({ value, onChange, signerName }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!value);
  const [mode, setMode] = useState<'draw' | 'type'>(value ? 'draw' : 'draw');
  const [typedName, setTypedName] = useState(signerName || '');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high DPI canvas resolution
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#14274E';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (value && value.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = value;
    }
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    onChange('');
  };

  const applyTypedSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !typedName.trim()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.font = 'italic 28px "Playfair Display", "Times New Roman", cursive';
    ctx.fillStyle = '#14274E';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName, rect.width / 2, rect.height / 2);

    setHasDrawn(true);
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  };

  return (
    <div id="signature-pad-container" className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <PenTool className="w-4 h-4 text-blue-900" />
          Signature électronique du représentant légal <span className="text-rose-600">*</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('draw')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
              mode === 'draw'
                ? 'bg-blue-950 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tracé manuscrit
          </button>
          <button
            type="button"
            onClick={() => setMode('type')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
              mode === 'type'
                ? 'bg-blue-950 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Saisie clavier
          </button>
        </div>
      </div>

      {mode === 'type' && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
          <p className="text-xs text-slate-600">
            Saisissez votre nom et prénom légal pour apposer une signature certifiée :
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Ex: Jean DUPONT"
              className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={applyTypedSignature}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Appliquer
            </button>
          </div>
        </div>
      )}

      <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden shadow-xs hover:border-slate-400 transition-colors">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-36 cursor-crosshair touch-none"
        />

        {!hasDrawn && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 select-none">
            <PenTool className="w-6 h-6 mb-1 text-slate-300" />
            <span className="text-xs font-medium">Signez ici avec votre souris, votre doigt ou un stylet</span>
          </div>
        )}

        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between border-t border-slate-100 pt-1 pointer-events-none">
          <span className="text-[11px] font-serif italic font-bold text-blue-950">
            « Lu et approuvé »
          </span>
          <span className="text-[10px] text-slate-400">
            Horodatage & intégrité numérique garantis
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          {hasDrawn ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Check className="w-3 h-3" /> Signature enregistrée
            </span>
          ) : (
            <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Signature obligatoire requise
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={clear}
          disabled={!hasDrawn}
          className="inline-flex items-center gap-1 text-slate-600 hover:text-rose-600 disabled:opacity-40 disabled:hover:text-slate-600 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Effacer
        </button>
      </div>
    </div>
  );
}
