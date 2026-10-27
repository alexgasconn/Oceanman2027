import React, { useMemo, useState } from 'react';
import { Compass, Sliders, ShieldCheck, AlertTriangle, TrendingUp, Clock, MapPin } from 'lucide-react';
import { OceanmanReadiness } from '../types/swim.ts';
import { formatDuration, formatPace } from '../utils/swimCalculators.ts';
import {
  buildRacePlan,
  CALM_CONDITIONS,
  RACE_CUTOFF_SEC,
  RaceConditions,
  suggestStopPlan,
} from '../utils/raceModel.ts';
import { OceanmanCourseD3Chart } from './OceanmanCourseD3Chart.tsx';

interface RaceCalculatorViewProps {
  readiness: OceanmanReadiness;
}

type SurfaceState = 'calm' | 'light_chop' | 'headwind';
type SightingState = 'tight' | 'normal' | 'wide';

const SURFACE_PENALTY: Record<SurfaceState, number> = { calm: 0, light_chop: 2, headwind: 4.5 };
const NAVIGATION_PENALTY: Record<SightingState, number> = { tight: 2, normal: 3.5, wide: 5 };

const signed = (seconds: number) => `${seconds < 0 ? '-' : '+'}${formatDuration(Math.abs(seconds))}`;

export const RaceCalculatorView: React.FC<RaceCalculatorViewProps> = ({ readiness }) => {
  const projectedPace = readiness.estimatedPacePer100mSec;
  const hasProjection = projectedPace > 0;
  const recommendedPace = hasProjection ? Math.round(Math.min(220, Math.max(70, projectedPace))) : 130;

  const [targetPaceSec, setTargetPaceSec] = useState<number>(recommendedPace);
  const [surface, setSurface] = useState<SurfaceState>('calm');
  const [sighting, setSighting] = useState<SightingState>('normal');
  const [wetsuit, setWetsuit] = useState(true);
  const [autoStops, setAutoStops] = useState(true);
  const [manualStopSec, setManualStopSec] = useState(90);

  const conditions: RaceConditions = useMemo(() => ({
    ...CALM_CONDITIONS,
    surfacePenaltySec: SURFACE_PENALTY[surface],
    navigationPenaltyPct: NAVIGATION_PENALTY[sighting],
    wetsuitGainSec: wetsuit ? 4.5 : 0,
  }), [surface, sighting, wetsuit]);

  const stopSecByKm = useMemo(() => (
    autoStops
      ? suggestStopPlan(targetPaceSec, conditions)
      : { 5: manualStopSec, 10: manualStopSec }
  ), [autoStops, manualStopSec, targetPaceSec, conditions]);

  const plan = useMemo(
    () => buildRacePlan({ basePacePer100mSec: targetPaceSec, conditions, stopSecByKm }),
    [targetPaceSec, conditions, stopSecByKm],
  );

  const recommendedPlan = useMemo(
    () => buildRacePlan({
      basePacePer100mSec: recommendedPace,
      conditions,
      stopSecByKm: suggestStopPlan(recommendedPace, conditions),
    }),
    [recommendedPace, conditions],
  );

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-white">
          <Compass className="h-5 w-5 text-cyan-400" />
          <span>Plan de carrera · Lago d'Orta 14 km</span>
        </h2>
        <p className="mt-1 max-w-3xl text-xs text-slate-400">
          Ritmo, tiempos acumulados y margen contra los cortes oficiales. El tiempo de parada disponible se recalcula
          con cada cambio de ritmo o de condiciones.
        </p>
      </div>

      <OceanmanCourseD3Chart
        targetPaceSec={targetPaceSec}
        effectivePaceSec={plan.effectivePaceSec}
        station1PauseSec={stopSecByKm[5] ?? 0}
        station2PauseSec={stopSecByKm[10] ?? 0}
        wetsuit={wetsuit}
        lakeCondition={surface}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6">
            <h3 className="flex items-center gap-2 border-b border-slate-800 pb-3 text-sm font-bold text-white">
              <Sliders className="h-4 w-4 text-cyan-400" />
              <span>Ritmo y condiciones</span>
            </h3>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">Ritmo objetivo en agua calma</span>
                <span className="font-mono text-sm font-bold text-cyan-400">{formatPace(targetPaceSec)}</span>
              </div>
              <input
                type="range"
                min={70}
                max={220}
                step={1}
                value={targetPaceSec}
                onChange={event => setTargetPaceSec(Number(event.target.value))}
                className="w-full cursor-pointer accent-cyan-500"
                aria-label="Ritmo objetivo"
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
                <span>1:10</span>
                <span>2:25</span>
                <span>3:40 /100m</span>
              </div>

              <div className="mt-3 flex flex-col gap-3 rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="block text-[10px] font-semibold uppercase text-cyan-300">Proyección desde tus datos</span>
                  <span className="font-mono text-lg font-bold text-white">
                    {hasProjection ? formatPace(recommendedPace) : 'N/D'}
                  </span>
                  <p className="text-[10px] text-slate-400">
                    {hasProjection
                      ? `Con estas condiciones: ${formatDuration(recommendedPlan.totalRaceSec)} · margen ${signed(recommendedPlan.finishMarginSec)}`
                      : 'Faltan sesiones de 1,5 km o más para proyectar un ritmo.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTargetPaceSec(recommendedPace)}
                  disabled={!hasProjection}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-cyan-500/30 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Aplicar
                </button>
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-3">
              <span className="mb-2 block text-xs font-medium text-slate-200">Estado del agua</span>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['calm', 'Calma'],
                  ['light_chop', 'Marejadilla'],
                  ['headwind', 'Viento de cara'],
                ] as [SurfaceState, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSurface(id)}
                    className={`rounded-lg border p-2 text-xs font-semibold ${surface === id ? 'border-blue-500/40 bg-blue-500/20 text-blue-300' : 'border-slate-800 bg-slate-950 text-slate-400'}`}
                  >
                    {label}
                    <span className="block text-[9px] font-normal text-slate-500">+{SURFACE_PENALTY[id]} s/100m</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-3">
              <span className="mb-2 block text-xs font-medium text-slate-200">Precisión de trazada</span>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['tight', 'Ajustada'],
                  ['normal', 'Normal'],
                  ['wide', 'Amplia'],
                ] as [SightingState, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSighting(id)}
                    className={`rounded-lg border p-2 text-xs font-semibold ${sighting === id ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-300' : 'border-slate-800 bg-slate-950 text-slate-400'}`}
                  >
                    {label}
                    <span className="block text-[9px] font-normal text-slate-500">+{NAVIGATION_PENALTY[id]}% dist.</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
              <div>
                <span className="block text-xs font-medium text-slate-200">Neopreno</span>
                <span className="text-[11px] text-slate-400">Flotabilidad: −4,5 s/100 m</span>
              </div>
              <button
                type="button"
                onClick={() => setWetsuit(value => !value)}
                aria-pressed={wetsuit}
                className={`h-6 w-12 cursor-pointer rounded-full p-1 transition-colors ${wetsuit ? 'bg-cyan-500' : 'bg-slate-800'}`}
              >
                <div className={`h-4 w-4 rounded-full bg-white transition-transform ${wetsuit ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="border-t border-slate-800/80 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-xs font-medium text-slate-200">Paradas en avituallamiento</span>
                  <span className="text-[11px] text-slate-400">
                    {autoStops ? 'Ajustadas al margen disponible' : `${manualStopSec}s en cada punto`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoStops(value => !value)}
                  aria-pressed={autoStops}
                  className={`h-6 w-12 cursor-pointer rounded-full p-1 transition-colors ${autoStops ? 'bg-cyan-500' : 'bg-slate-800'}`}
                >
                  <div className={`h-4 w-4 rounded-full bg-white transition-transform ${autoStops ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              {!autoStops && (
                <input
                  type="range"
                  min={0}
                  max={300}
                  step={15}
                  value={manualStopSec}
                  onChange={event => setManualStopSec(Number(event.target.value))}
                  className="mt-3 w-full cursor-pointer accent-cyan-500"
                  aria-label="Segundos de parada en cada avituallamiento"
                />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Tiempo total proyectado</span>
              {plan.isWithinCutoff ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Dentro del corte · {signed(plan.finishMarginSec)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Fuera de corte · {signed(plan.finishMarginSec)}
                </span>
              )}
            </div>

            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <span className="font-mono text-4xl font-black tabular-nums tracking-tight text-white sm:text-5xl">
                  {formatDuration(plan.totalRaceSec)}
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  Llegada {plan.finishClock} · ritmo efectivo{' '}
                  <strong className="font-mono text-cyan-400">{formatPace(plan.effectivePaceSec)}</strong> · límite 6h 00m
                </span>
              </div>
              <div className="text-right">
                <span className="block text-xs text-slate-400">Distancia real estimada</span>
                <span className="font-mono text-lg font-bold tabular-nums text-slate-200">
                  {plan.effectiveDistanceM.toLocaleString('es-ES')} m
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-slate-800 pt-4 text-xs sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <span className="block text-[10px] text-slate-400">Tiempo nadando</span>
                <span className="font-mono text-base font-bold tabular-nums text-white">{formatDuration(plan.swimTimeSec)}</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <span className="block text-[10px] text-slate-400">Parada total disponible</span>
                <span className="font-mono text-base font-bold tabular-nums text-amber-400">{formatDuration(plan.stopBudgetSec)}</span>
                <span className="mt-1 block text-[10px] text-slate-500">Planificado: {formatDuration(plan.totalStopSec)}</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <span className="block text-[10px] text-slate-400">Tiempo sobrante al final</span>
                <span className={`font-mono text-base font-bold tabular-nums ${plan.finishMarginSec >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {signed(plan.finishMarginSec)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span>Avituallamientos · tiempo disponible</span>
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {plan.feedPoints.map(point => (
                <div key={point.km} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="rounded border border-cyan-800 bg-cyan-950 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                      Km {point.km}
                    </span>
                    <span className={`font-mono text-xs font-bold ${point.isSafe ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {signed(point.marginSec)} al corte
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{point.label}</h4>
                  <div className="flex justify-between text-slate-300">
                    <span>Llegada estimada</span>
                    <strong className="font-mono text-amber-400">{point.arrivalClock}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Corte oficial</span>
                    <span className="font-mono text-slate-400">{formatDuration(point.cutoffSec)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Parada planificada</span>
                    <strong className="font-mono text-cyan-400">{formatDuration(point.plannedStopSec)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Parada aún disponible</span>
                    <strong className={`font-mono ${point.remainingBudgetSec >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                      {formatDuration(Math.max(0, point.remainingBudgetSec))}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <MapPin className="h-4 w-4 text-rose-400" />
              <span>Desglose kilómetro a kilómetro</span>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Km</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Ritmo</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Parcial</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Parada</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Acumulado</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Hora</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums text-slate-300">
                  {plan.splits.map(split => {
                    const remainingToCutoff = RACE_CUTOFF_SEC - split.cumulativeSec;
                    return (
                      <tr key={split.km} className={split.isFeedPoint ? 'bg-cyan-950/20' : undefined}>
                        <td className="px-3 py-2 font-sans font-semibold text-white">
                          {split.km}
                          {split.isFeedPoint && (
                            <span className="ml-2 rounded bg-cyan-900/60 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
                              Avituallamiento
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-cyan-300">{formatPace(split.pacePer100mSec)}</td>
                        <td className="px-3 py-2 text-right">{formatDuration(split.splitSec)}</td>
                        <td className="px-3 py-2 text-right text-amber-300">
                          {split.stopSec > 0 ? formatDuration(split.stopSec) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-white">{formatDuration(split.cumulativeSec)}</td>
                        <td className="px-3 py-2 text-right text-amber-400">{split.clockTime}</td>
                        <td className={`px-3 py-2 text-right ${remainingToCutoff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {signed(split.marginSec ?? remainingToCutoff)}
                          {split.isFeedPoint && <span className="ml-1 text-[9px] text-slate-500">corte</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[10px] text-slate-500">
              El margen de los kilómetros sin corte muestra el tiempo que te sobraría frente al límite de 6 h si mantienes
              ese ritmo; en los kilómetros 5 y 10 se compara contra el corte oficial de cada punto.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
