import React from 'react';
import { X, Calendar, Clock, Waves, Flame, Heart, Compass, MapPin, Award } from 'lucide-react';
import { SwimActivity } from '../types/swim.ts';
import { formatDistance, formatDuration, formatPace } from '../utils/swimCalculators.ts';

interface ActivityDetailModalProps {
  activity: SwimActivity | null;
  onClose: () => void;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  onClose,
}) => {
  if (!activity) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">
              <span className={`w-2 h-2 rounded-full ${activity.type === 'open_water' ? 'bg-cyan-400' : 'bg-blue-400'}`} />
              <span>{activity.type === 'open_water' ? 'Aguas Abiertas (Mar / Lago)' : 'Sesión Piscina'}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-400 font-mono">{activity.date}</span>
            </div>
            <h2 id="modal-title" className="text-xl font-bold text-white">
              {activity.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cerrar detalle"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content scrollable */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Key KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Distancia</span>
              <span className="text-xl font-bold font-mono text-white tabular-nums">
                {formatDistance(activity.distance)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Tiempo en Movimiento</span>
              <span className="text-xl font-bold font-mono text-cyan-400 tabular-nums">
                {formatDuration(activity.movingTime)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Ritmo Medio</span>
              <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                {formatPace(activity.pacePer100m)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Cadencia Media</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                  {activity.averageCadence || '--'}
                </span>
                <span className="text-xs text-slate-400">SPM</span>
              </div>
            </div>
          </div>

          {/* Secondary Telemetry */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block text-[10px]">Moving Ratio</span>
              <span className={`font-mono font-bold text-sm tabular-nums ${
                (activity.movingRatio || 100) >= 90 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {activity.movingRatio ? `${activity.movingRatio}%` : '100%'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block text-[10px]">Elevación GPS (Máx/Mín)</span>
              <span className="font-mono font-bold text-cyan-300 text-sm tabular-nums">
                {activity.elevationHigh !== undefined ? `${activity.elevationHigh}m / ${activity.elevationLow || 0}m` : (activity.type === 'open_water' ? '>0m' : '0m')}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block text-[10px]">DPS (m / ciclo)</span>
              <span className="font-mono font-bold text-blue-300 text-sm tabular-nums">
                {activity.dps ? `${activity.dps} m` : '--'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block text-[10px]">Puntuación SWOLF</span>
              <span className="font-mono font-bold text-violet-300 text-sm tabular-nums">
                {activity.swolf || '--'}
              </span>
            </div>
          </div>

          {/* Session Notes */}
          {activity.notes && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
              <span className="text-cyan-400 font-semibold block mb-1">Notas de Entrenamiento:</span>
              <p className="leading-relaxed">{activity.notes}</p>
            </div>
          )}

          {/* Splits Table if available */}
          {activity.splits && activity.splits.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Desglose Parciales por Kilómetro ({activity.splits.length} km)
              </h3>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Km</th>
                      <th className="py-2.5 px-3 font-semibold">Ritmo /100m</th>
                      <th className="py-2.5 px-3 font-semibold">Cadencia</th>
                      <th className="py-2.5 px-3 font-semibold">Frecuencia Cardíaca</th>
                      <th className="py-2.5 px-3 font-semibold">SWOLF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums text-slate-300">
                    {activity.splits.map((s) => (
                      <tr key={s.km} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-3 font-bold text-white">Km {s.km}</td>
                        <td className="py-2 px-3 text-cyan-400 font-semibold">{formatPace(s.paceSec)}</td>
                        <td className="py-2 px-3">{s.cadenceSpm || '--'} SPM</td>
                        <td className="py-2 px-3">{s.heartRate ? `${s.heartRate} bpm` : '--'}</td>
                        <td className="py-2 px-3">{s.swolf || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
