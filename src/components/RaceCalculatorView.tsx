import React, { useState, useMemo } from 'react';
import { 
  Compass, 
  Clock, 
  Flame, 
  Droplet, 
  Zap, 
  MapPin, 
  Sliders, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp,
  BatteryCharging,
  AlertTriangle,
  Heart,
  Timer
} from 'lucide-react';
import { OceanmanReadiness } from '../types/swim.ts';
import { 
  formatDuration, 
  formatPace, 
  OCEANMAN_DISTANCE_METERS,
  calculateOrtaFeedPauses
} from '../utils/swimCalculators.ts';
import { OceanmanCourseD3Chart } from './OceanmanCourseD3Chart.tsx';

interface RaceCalculatorViewProps {
  readiness: OceanmanReadiness;
}

export const RaceCalculatorView: React.FC<RaceCalculatorViewProps> = ({ readiness }) => {
  // Base pace in sec/100m (default from readiness)
  const initialPace = readiness.estimatedPacePer100mSec || 100;
  const [targetPaceSec, setTargetPaceSec] = useState<number>(initialPace);
  const [wetsuit, setWetsuit] = useState<boolean>(true);
  const [sightingStrokes, setSightingStrokes] = useState<number>(6); // sight every 6 strokes
  const [fatigueStrategy, setFatigueStrategy] = useState<'high' | 'medium' | 'conservative'>('medium');
  const [lakeCondition, setLakeCondition] = useState<'calm' | 'light_chop' | 'headwind'>('calm');

  // Exact 2-station official model from regulations
  const strategy = useMemo(() => {
    return calculateOrtaFeedPauses(
      targetPaceSec,
      wetsuit,
      sightingStrokes,
      lakeCondition,
      fatigueStrategy
    );
  }, [targetPaceSec, wetsuit, sightingStrokes, lakeCondition, fatigueStrategy]);

  // Calories and energy estimation
  const totalHours = strategy.totalOfficialRaceSec / 3600;
  const totalCalories = Math.round(strategy.effectiveDistanceMeters * 0.28 + totalHours * 120);
  const totalCarbsGrams = Math.round(totalHours * 75);
  const totalHydrationMl = Math.round(totalHours * 650);

  // Checkpoints for route summary
  const checkpoints = [
    {
      km: 0,
      name: "Salida Oficial: Piazza de Omegna",
      desc: "Extremo Norte del Lago d'Orta",
      clockTime: "09:30 AM",
      cutoffStr: "Salida",
      splitTime: "00:00:00",
      marginMin: null,
      isCutoffSafe: true,
      pauseNote: "Cámara de llamadas (09:15 AM)"
    },
    {
      km: 5.0,
      name: strategy.station1.name,
      desc: "Primera plataforma flotante oficial de avituallamiento",
      clockTime: strategy.station1.estimatedArrivalClock,
      cutoffStr: strategy.station1.officialCutOffClock,
      splitTime: formatDuration(strategy.station1.estimatedArrivalSec),
      marginMin: strategy.station1.marginBeforeCutoffMin,
      isCutoffSafe: strategy.station1.isCutoffSafe,
      pauseNote: `Pausa calculada: ${strategy.station1.recommendedPauseString}`
    },
    {
      km: 8.5,
      name: "Paso de Isola San Giulio & Pella",
      desc: "Corazón espiritual del lago · Punto más profundo (-143m)",
      clockTime: (() => {
        const estSec = Math.round((8500 / 14000) * strategy.pureSwimMovingSec + strategy.station1PauseSec);
        const mins = 9 * 60 + 30 + Math.round(estSec / 60);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m} ${h >= 12 ? 'PM' : 'AM'}`;
      })(),
      cutoffStr: "Paso libre",
      splitTime: formatDuration(Math.round((8500 / 14000) * strategy.pureSwimMovingSec + strategy.station1PauseSec)),
      marginMin: null,
      isCutoffSafe: true,
      pauseNote: "Autonomía de boya (sin estación fija)"
    },
    {
      km: 10.0,
      name: strategy.station2.name,
      desc: "Segunda y última plataforma flotante oficial de avituallamiento",
      clockTime: strategy.station2.estimatedArrivalClock,
      cutoffStr: strategy.station2.officialCutOffClock,
      splitTime: formatDuration(strategy.station2.estimatedArrivalSec),
      marginMin: strategy.station2.marginBeforeCutoffMin,
      isCutoffSafe: strategy.station2.isCutoffSafe,
      pauseNote: `Pausa calculada: ${strategy.station2.recommendedPauseString}`
    },
    {
      km: 14.0,
      name: "Meta Oficial: Playa Lido di Gozzano",
      desc: "Cierre de Carrera (Extremo Sur)",
      clockTime: (() => {
        const mins = 9 * 60 + 30 + Math.round(strategy.totalOfficialRaceSec / 60);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m} ${h >= 12 ? 'PM' : 'AM'}`;
      })(),
      cutoffStr: "03:30 PM (6h 00m)",
      splitTime: strategy.totalOfficialRaceString,
      marginMin: strategy.finishMarginMin,
      isCutoffSafe: strategy.isWithinOfficialCutoff,
      pauseNote: "Campana de Finisher"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Introduction Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-cyan-400" />
              <span>Estrategia Oficial Lago d'Orta 14K · Modelo de 2 Estaciones Flotantes</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Simulación de ritmo, oleaje térmico y modelo dinámico de fatiga para las 2 únicas plataformas flotantes oficiales de la travesía (Km 5.0 y Km 10.0).
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 shrink-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>2 Estaciones Flotantes Oficiales</span>
          </div>
        </div>
      </div>

      {/* Interactive D3 Bathymetric Elevation Profile & Lake Map */}
      <OceanmanCourseD3Chart
        targetPaceSec={targetPaceSec}
        effectivePaceSec={strategy.effectivePaceSec}
        station1PauseSec={strategy.station1PauseSec}
        station2PauseSec={strategy.station2PauseSec}
        wetsuit={wetsuit}
        lakeCondition={lakeCondition}
      />

      {/* Main Grid: Controls vs Race Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Variables de Ritmo & Preparación</span>
            </h3>

            {/* Target Pace Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-300 font-medium">Ritmo Base en Agua Calma:</span>
                <span className="font-mono font-bold text-cyan-400 text-sm">
                  {formatPace(targetPaceSec)}
                </span>
              </div>
              <input
                type="range"
                min={85}
                max={130}
                step={1}
                value={targetPaceSec}
                onChange={(e) => setTargetPaceSec(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>1:25/100m (Élite)</span>
                <span>1:40/100m (Sub 4h)</span>
                <span>2:10/100m</span>
              </div>
            </div>

            {/* Neoprene Wetsuit Toggle */}
            <div className="pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-200 block">
                    Traje de Neopreno (Wetsuit)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Aporta flotabilidad clave en agua dulce del lago (-4.5s/100m)
                  </span>
                </div>
                <button
                  onClick={() => setWetsuit(prev => !prev)}
                  className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                    wetsuit ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                  aria-label="Alternar uso de neopreno"
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      wetsuit ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Sighting Frequency */}
            <div className="pt-3 border-t border-slate-800/80">
              <span className="text-xs font-medium text-slate-200 block mb-2">
                Frecuencia de Avistamiento de Boyas (Sighting)
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[4, 6, 8, 12].map((strokes) => (
                  <button
                    key={strokes}
                    onClick={() => setSightingStrokes(strokes)}
                    className={`p-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer text-center ${
                      sightingStrokes === strokes
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    c/ {strokes} brazadas
                  </button>
                ))}
              </div>
            </div>

            {/* Fatigue Strategy */}
            <div className="pt-3 border-t border-slate-800/80">
              <span className="text-xs font-medium text-slate-200 block mb-2">
                Perfil de Gestión en Plataforma Flotante
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'high', label: 'Rápida / Élite', desc: 'Paradas cortas (45-75s)' },
                  { id: 'medium', label: 'Equilibrada', desc: 'Pausas estándar (60-110s)' },
                  { id: 'conservative', label: 'Conservadora', desc: 'Pausa amplia (80-150s)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFatigueStrategy(item.id as any)}
                    className={`p-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer text-center ${
                      fatigueStrategy === item.id
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>{item.label}</div>
                    <div className="text-[9px] text-slate-500 font-normal">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Lake Surface */}
            <div className="pt-3 border-t border-slate-800/80">
              <span className="text-xs font-medium text-slate-200 block mb-2">
                Condición del Agua del Lago d'Orta
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'calm', label: 'Calma Total' },
                  { id: 'light_chop', label: 'Brisa Ligera' },
                  { id: 'headwind', label: 'Viento Térmico' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setLakeCondition(item.id as any)}
                    className={`p-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer text-center ${
                      lakeCondition === item.id
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Output Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Outcome Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Tiempo Total Oficial Proyectado (Nado + Pausas en Estaciones)
              </span>
              {strategy.isWithinOfficialCutoff ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Dentro de Corte Oficial (+{strategy.finishMarginMin} min de margen)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Supera tiempo límite oficial de 6h 00m</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
              <div>
                <span className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight tabular-nums">
                  {strategy.totalOfficialRaceString}
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  Ritmo efectivo global: <strong className="text-cyan-400 font-mono">{formatPace(strategy.effectivePaceSec)}</strong> · Límite oficial: 6h 00min (03:30 PM)
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block">Distancia estimada</span>
                <span className="text-lg font-bold font-mono text-slate-200 tabular-nums">
                  {strategy.effectiveDistanceMeters.toLocaleString('es-ES')} m
                </span>
                <span className="text-[11px] text-slate-500 block">con desvío de boyas y sighting</span>
              </div>
            </div>

            {/* Time Breakdown: Pure Swim vs Pauses */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] flex items-center gap-1">
                  <Timer className="w-3 h-3 text-cyan-400" />
                  <span>Tiempo Neto en Nado</span>
                </span>
                <span className="font-mono font-bold text-white text-base tabular-nums">
                  {strategy.pureSwimMovingString}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Pausa Estación 1 (5k)</span>
                </span>
                <span className="font-mono font-bold text-amber-400 text-base tabular-nums">
                  +{strategy.station1.recommendedPauseString}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Pausa Estación 2 (10k)</span>
                </span>
                <span className="font-mono font-bold text-amber-400 text-base tabular-nums">
                  +{strategy.station2.recommendedPauseString}
                </span>
              </div>
            </div>
          </div>

          {/* Deep Dive: The 2 Official Floating Feed Stations */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Droplet className="w-4 h-4 text-cyan-400" />
              <span>Análisis de las 2 Estaciones Flotantes Oficiales</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Station 1 Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Estación Flotante #1 · Km 5.0
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    +{strategy.station1.marginBeforeCutoffMin} min colchón
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{strategy.station1.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Llegada proyectada: <strong className="text-amber-400 font-mono">{strategy.station1.estimatedArrivalClock}</strong> (Corte: 11:45 AM)</p>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Pausa calculada:</span>
                    <strong className="text-cyan-400 font-mono">{strategy.station1.recommendedPauseString}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Índice de fatiga:</span>
                    <span className="text-amber-400 font-mono font-bold">{strategy.station1.fatigueIndexPct}% (Moderada)</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Ciclos completados:</span>
                    <span className="text-slate-400 font-mono">~{strategy.station1.strokeCountAtArrival.toLocaleString('es-ES')} brazadas</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
                  <span className="font-semibold text-cyan-300 block mb-0.5">Nutrición en Plataforma:</span>
                  {strategy.station1.nutritionAction}
                </div>
              </div>

              {/* Station 2 Card */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                    Estación Flotante #2 · Km 10.0
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    +{strategy.station2.marginBeforeCutoffMin} min colchón
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{strategy.station2.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Llegada proyectada: <strong className="text-amber-400 font-mono">{strategy.station2.estimatedArrivalClock}</strong> (Corte: 02:00 PM)</p>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Pausa calculada:</span>
                    <strong className="text-cyan-400 font-mono">{strategy.station2.recommendedPauseString}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Índice de fatiga:</span>
                    <span className="text-rose-400 font-mono font-bold">{strategy.station2.fatigueIndexPct}% (Avanzada)</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Ciclos completados:</span>
                    <span className="text-slate-400 font-mono">~{strategy.station2.strokeCountAtArrival.toLocaleString('es-ES')} brazadas</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
                  <span className="font-semibold text-amber-300 block mb-0.5">Nutrición en Plataforma:</span>
                  {strategy.station2.nutritionAction}
                </div>
              </div>
            </div>
          </div>

          {/* Course Splits Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-rose-400" />
              <span>Cronograma Oficial y Tiempos de Corte (Salida 09:30 AM · Omegna → Lido di Gozzano)</span>
            </h3>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Km</th>
                    <th className="py-2.5 px-3 font-semibold">Punto Oficial</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Tiempo Carrera</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Hora Paso</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Límite Oficial</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums text-slate-300">
                  {checkpoints.map((cp, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-cyan-400">{cp.km.toFixed(1)}k</td>
                      <td className="py-2.5 px-3 font-sans font-medium text-white">
                        <div>{cp.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{cp.pauseNote}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-200">
                        {cp.splitTime}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                        {cp.clockTime}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-sans text-[11px]">
                        {cp.cutoffStr}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {cp.marginMin !== null ? (
                          cp.isCutoffSafe ? (
                            <span className="text-emerald-400 font-bold">+{cp.marginMin}m</span>
                          ) : (
                            <span className="text-rose-400 font-bold">{cp.marginMin}m</span>
                          )
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
