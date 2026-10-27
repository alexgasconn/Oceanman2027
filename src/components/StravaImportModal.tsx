import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Archive,
  Compass,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { SwimActivity } from '../types/swim.ts';
import { parseStravaExportFile } from '../utils/stravaExportParser.ts';

interface StravaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportActivities: (activities: SwimActivity[], sourceName: string) => void;
}

export const StravaImportModal: React.FC<StravaImportModalProps> = ({
  isOpen,
  onClose,
  onImportActivities,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<SwimActivity[] | null>(null);
  const [summaryInfo, setSummaryInfo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setErrorMsg(null);
    if (!/\.(zip|csv)$/i.test(file.name)) {
      setParsedPreview(null);
      setErrorMsg('Selecciona el ZIP de Strava o un archivo activities.csv.');
      return;
    }
    setIsProcessing(true);
    setProcessStatus('Iniciando lectura del archivo...');
    setParsedPreview(null);
    setSummaryInfo(null);

    try {
      const result = await parseStravaExportFile(file, (status) => setProcessStatus(status));
      if (result.activities.length === 0) {
        setErrorMsg('No se detectaron actividades de natación en este archivo. Comprueba que contenga actividades con "Activity Type = Swim".');
      } else {
        setParsedPreview(result.activities);
        setSummaryInfo(result.summary);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el archivo. Asegúrate de que sea un .zip, .csv, .gpx o .tcx válido.');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (parsedPreview && parsedPreview.length > 0) {
      onImportActivities(parsedPreview, summaryInfo || 'Archivo Strava');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Importar Archivo de Strava</h2>
              <p className="text-xs text-slate-400">Strava ZIP o activities.csv</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
            <h3 className="font-semibold text-white">¿Aún no tienes tu exportación?</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-slate-400">
              <li>
                Abre los{' '}
                <a
                  href="https://www.strava.com/account"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-cyan-400 hover:text-cyan-300"
                >
                  ajustes de tu cuenta de Strava <ExternalLink className="h-3 w-3" />
                </a>
                {' '}y solicita la descarga de tu archivo de datos.
              </li>
              <li>Strava te enviará un correo con el enlace de descarga; suele tardar unos 5 minutos.</li>
              <li>Descarga el ZIP y selecciónalo aquí para importar tus nados.</li>
            </ol>
          </div>

          {/* Universal Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragActive
              ? 'border-cyan-400 bg-cyan-950/30'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
            />
            {isProcessing ? (
              <div className="py-2">
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-3" />
                <h3 className="text-sm font-bold text-white">Procesando archivo...</h3>
                <p className="text-xs text-cyan-300 font-mono mt-1">{processStatus}</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Archive className="w-8 h-8 text-cyan-400" />
                  <FileText className="w-8 h-8 text-blue-400" />
                  <Compass className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  Arrastra aquí tu <span className="text-cyan-400 font-mono">export.zip</span> de Strava o <span className="text-cyan-400 font-mono">activities.csv</span>
                </h3>
                <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Explorar archivos de tu equipo</span>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-900/50 flex items-center gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed Preview Feedback */}
          {parsedPreview && (
            <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>¡{parsedPreview.length} sesiones de natación analizadas!</span>
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Total: {(parsedPreview.reduce((a, b) => a + b.distance, 0) / 1000).toFixed(1)} km
                </span>
              </div>

              {summaryInfo && (
                <p className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  {summaryInfo}
                </p>
              )}

              {/* Sample 3 rows preview */}
              <div className="divide-y divide-slate-800 text-[11px] font-mono text-slate-300">
                {parsedPreview.slice(0, 3).map((act, i) => (
                  <div key={i} className="py-1.5 flex justify-between">
                    <span className="font-sans text-white truncate max-w-xs">{act.title}</span>
                    <span className="text-cyan-400">{act.distance}m · {act.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={!parsedPreview || parsedPreview.length === 0}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${parsedPreview && parsedPreview.length > 0
              ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/20'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
          >
            Importar al Dashboard ({parsedPreview ? parsedPreview.length : 0})
          </button>
        </div>
      </div>
    </div>
  );
};
