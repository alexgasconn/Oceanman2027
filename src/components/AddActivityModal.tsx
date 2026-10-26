import React, { useState } from 'react';
import { X, Dumbbell, Waves, PlusCircle } from 'lucide-react';
import { SwimActivity } from '../types/swim.ts';
import { calculateDPS, calculateSWOLF, calculateStrokeIndex } from '../utils/swimCalculators.ts';

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSwim: (activity: SwimActivity) => void;
}

export const AddActivityModal: React.FC<AddActivityModalProps> = ({
  isOpen,
  onClose,
  onAddSwim,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<'open_water' | 'pool'>('open_water');
  const [distanceMeters, setDistanceMeters] = useState(4000);
  const [minutes, setMinutes] = useState(65);
  const [seconds, setSeconds] = useState(0);
  const [cadenceSpm, setCadenceSpm] = useState(63);
  const [heartRate, setHeartRate] = useState(138);
  const [waterTemp, setWaterTemp] = useState(19.0);
  const [hasWetsuit, setHasWetsuit] = useState(true);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const movingTime = minutes * 60 + seconds;
    if (distanceMeters <= 0 || movingTime <= 0) return;

    const pacePer100m = (movingTime / distanceMeters) * 100;
    const speedMps = distanceMeters / movingTime;
    const dps = calculateDPS(speedMps, cadenceSpm);
    const swolf = calculateSWOLF(pacePer100m, dps, type === 'open_water' ? 50 : 25);
    const strokeIndex = calculateStrokeIndex(speedMps, dps);

    const newActivity: SwimActivity = {
      id: `manual-${Date.now()}`,
      date,
      title: title.trim() || (type === 'open_water' ? 'Travesía Aguas Abiertas' : 'Sesión Piscina'),
      type,
      distance: distanceMeters,
      elapsedTime: Math.round(movingTime * 1.05),
      movingTime,
      pacePer100m: Number(pacePer100m.toFixed(1)),
      averageCadence: cadenceSpm,
      totalStrokes: Math.round((movingTime / 60) * cadenceSpm),
      dps,
      swolf,
      strokeIndex,
      avgHeartRate: heartRate,
      calories: Math.round((distanceMeters / 100) * 30),
      waterTemp,
      hasWetsuit: type === 'open_water' ? hasWetsuit : false,
      notes: notes.trim() || undefined,
      source: 'manual',
    };

    onAddSwim(newActivity);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-title"
      >
        <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h2 id="add-title" className="text-xl font-bold text-white flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-cyan-400" />
              <span>Registrar Sesión de Natación</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Añade un entrenamiento y actualiza instantáneamente tus estadísticas y readiness.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Título de la Sesión</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Test 6000m Lago d'Orta Simulación"
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Tipo de Medio</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="open_water">Aguas Abiertas (Mar / Lago)</option>
                <option value="pool">Piscina (25m / 50m)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Distancia (metros)</label>
              <input
                type="number"
                step="50"
                min="100"
                max="25000"
                value={distanceMeters}
                onChange={(e) => setDistanceMeters(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Tiempo (Minutos y Segundos)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="400"
                  placeholder="Min"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  className="w-1/2 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
                />
                <input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="Seg"
                  value={seconds}
                  onChange={(e) => setSeconds(Number(e.target.value))}
                  className="w-1/2 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Cadencia (SPM)</label>
              <input
                type="number"
                min="40"
                max="90"
                value={cadenceSpm}
                onChange={(e) => setCadenceSpm(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">FC Media (ppm)</label>
              <input
                type="number"
                min="90"
                max="200"
                value={heartRate}
                onChange={(e) => setHeartRate(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Temp. Agua (°C)</label>
              <input
                type="number"
                step="0.5"
                min="10"
                max="32"
                value={waterTemp}
                onChange={(e) => setWaterTemp(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {type === 'open_water' && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-300">¿Utilizaste traje de neopreno (wetsuit)?</span>
              <button
                type="button"
                onClick={() => setHasWetsuit(prev => !prev)}
                className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                  hasWetsuit ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {hasWetsuit ? 'Sí (Wetsuit)' : 'No (Skin swim)'}
              </button>
            </div>
          )}

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Notas / Sensaciones</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sensaciones de tracción, avituallamiento, oleaje..."
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-lg shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              Guardar Sesión
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
