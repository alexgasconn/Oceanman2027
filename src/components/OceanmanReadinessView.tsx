import React, { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Layers,
  Zap,
  Compass,
  Waves,
  TrendingUp,
  Check,
  ArrowRight,
  ChevronDown,
  Thermometer,
  Wind,
  Sun,
  Eye,
} from 'lucide-react';
import { OceanmanReadiness, SwimActivity, ReadinessCheckItem } from '../types/swim.ts';
import { formatDistance, formatPace, ORTA_HISTORICAL_CONDITIONS } from '../utils/swimCalculators.ts';
import { HistoricalReadinessView } from './HistoricalReadinessView.tsx';

interface OceanmanReadinessViewProps {
  readiness: OceanmanReadiness;
  activities: SwimActivity[];
  onOpenCalculator: () => void;
}

export const OceanmanReadinessView: React.FC<OceanmanReadinessViewProps> = ({
  readiness,
  activities,
  onOpenCalculator,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'warning' | 'pending'>('all');

  // Filter the readiness checks
  const filteredChecks = useMemo(() => {
    return readiness.checks.filter(c => {
      if (filterStatus === 'all') return true;
      return c.status === filterStatus;
    });
  }, [readiness.checks, filterStatus]);

  // Swim stats computed 100% dynamically from imported activities
  const poolSwims = useMemo(() => activities.filter(a => a.type === 'pool'), [activities]);
  const owSwims = useMemo(() => activities.filter(a => a.type === 'open_water'), [activities]);

  const longestPool = useMemo(() => {
    if (poolSwims.length === 0) return null;
    return [...poolSwims].sort((a, b) => b.distance - a.distance)[0];
  }, [poolSwims]);

  const longestOw = useMemo(() => {
    if (owSwims.length === 0) return null;
    return [...owSwims].sort((a, b) => b.distance - a.distance)[0];
  }, [owSwims]);

  const avgMovingRatio = useMemo(() => {
    const recordedRatios = activities.map(activity => activity.movingRatio).filter((value): value is number => value !== undefined);
    if (recordedRatios.length === 0) return null;
    const sum = recordedRatios.reduce((acc, ratio) => acc + ratio, 0);
    return Number((sum / recordedRatios.length).toFixed(1));
  }, [activities]);

  const getEnvIcon = (category: string) => {
    switch (category) {
      case 'water_temp':
        return <Thermometer className="w-5 h-5 text-cyan-400" />;
      case 'air_temp':
        return <Sun className="w-5 h-5 text-amber-400" />;
      case 'wind':
        return <Wind className="w-5 h-5 text-teal-400" />;
      case 'chop':
        return <Waves className="w-5 h-5 text-blue-400" />;
      case 'clarity':
        return <Eye className="w-5 h-5 text-emerald-400" />;
      case 'solar':
        return <Sun className="w-5 h-5 text-rose-400" />;
      default:
        return <Waves className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Tu preparación</h2>
        <button
          onClick={onOpenCalculator}
          className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
        >
          <Compass className="w-4 h-4" />
          <span>Plan 14K</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 6-KPI Swimming Performance Telemetry Matrix (Dynamically computed from actual activities) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* KPI 3: Longest Pool Swim */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Max Piscina</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-blue-300 tabular-nums">
              {longestPool ? formatDistance(longestPool.distance) : 'N/D'}
            </span>
            <span className="text-[11px] text-slate-500">referencia en piscina</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 truncate">
            {longestPool ? `${longestPool.date} (${formatPace(longestPool.pacePer100m)})` : 'Sin sesiones piscina'}
          </p>
        </div>

        {/* KPI 4: Longest Open Water Swim */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Max Aguas Abiertas</span>
            <Waves className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-cyan-300 tabular-nums">
              {longestOw ? formatDistance(longestOw.distance) : 'N/D'}
            </span>
            <span className="text-[11px] text-slate-500">/ 14 km de carrera</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 truncate">
            {longestOw ? `${longestOw.date} (${formatPace(longestOw.pacePer100m)})` : 'Sin travesías registradas'}
          </p>
        </div>

        {/* KPI 5: Weekly Volume */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Carga Semanal Media</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-emerald-300 tabular-nums">
              {formatDistance(readiness.avgWeeklyVolumeMeters)}
            </span>
            <span className="text-[11px] text-slate-500">/ sem</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Hito objetivo: 20 km/sem
          </p>
        </div>

        {/* KPI 6: Moving Ratio */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Moving Ratio Medio</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-amber-300 tabular-nums">
              {avgMovingRatio === null ? 'N/D' : `${avgMovingRatio}%`}
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold">Continuidad</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Tiempo nado vs tiempo total
          </p>
        </div>
      </div>

      {/* Readiness checks */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Checks Oceanman 14K</span>
              <span className="text-xs font-mono font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                {readiness.passedChecksCount} de {readiness.totalChecksCount} superados
              </span>
            </h3>
          </div>

          {/* Clean Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs shrink-0">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded font-semibold cursor-pointer transition-colors ${filterStatus === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Todos ({readiness.checks.length})
            </button>
            <button
              onClick={() => setFilterStatus('passed')}
              className={`px-3 py-1 rounded font-semibold cursor-pointer transition-colors ${filterStatus === 'passed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Superados ({readiness.checks.filter(c => c.status === 'passed').length})
            </button>
            <button
              onClick={() => setFilterStatus('warning')}
              className={`px-3 py-1 rounded font-semibold cursor-pointer transition-colors ${filterStatus === 'warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              En progreso ({readiness.checks.filter(c => c.status === 'warning').length})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1 rounded font-semibold cursor-pointer transition-colors ${filterStatus === 'pending' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Pendientes ({readiness.checks.filter(c => c.status === 'pending').length})
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {filteredChecks.map((check) => {
            const isPassed = check.status === 'passed';
            const isWarning = check.status === 'warning';
            const history = readiness.historicalEvolution
              .map(point => ({ date: point.date, score: point.checkScores?.[check.id] }))
              .filter((point): point is { date: string; score: number } => point.score !== undefined);
            const chartWidth = 360;
            const chartHeight = 76;
            const points = history.map((point, index) => {
              const x = history.length === 1 ? chartWidth / 2 : index / (history.length - 1) * chartWidth;
              const y = chartHeight - point.score / 100 * chartHeight;
              return { ...point, x, y };
            });
            const chartLine = points.map(point => `${point.x},${point.y}`).join(' ');

            return (
              <details
                key={check.id}
                className={`group rounded-lg border transition-colors ${isPassed
                  ? 'bg-slate-950/70 border-emerald-500/30 hover:border-emerald-500/50'
                  : isWarning
                    ? 'bg-slate-950/70 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
              >
                <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 font-mono text-xs font-bold text-cyan-400">
                      #{check.checkNumber}
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-white">{check.shortTitle || check.title}</h4>
                      <span className="text-[10px] text-slate-500">{check.isScored === false ? 'Informativo · fuera del índice' : check.isDataAvailable === false ? 'Sin datos para puntuar' : `${check.weight}% del índice`}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-self-end">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${isPassed
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                      : isWarning
                        ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                        : 'bg-slate-800/80 border border-slate-700 text-slate-300'
                      }`}>
                      {check.isScored === false ? 'Informativo' : check.isDataAvailable === false ? 'Sin datos' : isPassed ? 'Superado' : isWarning ? 'En progreso' : 'Pendiente'}
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums text-slate-200">{check.currentValueFormatted}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:w-48">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div className={`h-full ${isPassed ? 'bg-emerald-400' : isWarning ? 'bg-amber-400' : 'bg-cyan-500'}`} style={{ width: `${check.score}%` }} />
                    </div>
                    <span className="w-8 text-right font-mono text-[10px] tabular-nums text-slate-400">{check.score}%</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                  </div>
                </summary>

                <div className="space-y-3 border-t border-slate-800/70 px-4 pb-4 pt-3">
                  <p className="text-xs text-slate-300">{check.description}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    <span>Actual: <strong className="text-white">{check.currentValueFormatted}</strong></span>
                    <span>Objetivo: <strong className="text-slate-200">{check.targetValueFormatted}</strong></span>
                    <span>Base: {check.baseline}</span>
                  </div>

                  {check.milestones.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {check.milestones.map((milestone, index) => (
                        <div key={index} className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] ${milestone.isCompleted ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300' : 'border-slate-800 bg-slate-900 text-slate-400'}`}>
                          {milestone.isCompleted && <Check className="h-3 w-3" />}
                          <span>{milestone.target}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-md border border-slate-800 bg-slate-900/70 p-3">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Progreso semanal</span>
                      <span>{history.length ? `${history.length} semanas` : 'Sin histórico suficiente'}</span>
                    </div>
                    {points.length > 0 ? (
                      <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 10}`} className="h-16 w-full" role="img" aria-label={`Progreso histórico: ${check.shortTitle || check.title}`}>
                        <line x1="0" x2={chartWidth} y1={chartHeight / 2} y2={chartHeight / 2} stroke="#334155" strokeDasharray="3 4" />
                        <polyline points={chartLine} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        {points.map(point => <circle key={point.date} cx={point.x} cy={point.y} r="2.5" fill="#67e8f9"><title>{`${point.date}: ${point.score}%`}</title></circle>)}
                        <text x="0" y={chartHeight + 9} fill="#64748b" fontSize="9">{points[0].date}</text>
                        <text x={chartWidth} y={chartHeight + 9} textAnchor="end" fill="#64748b" fontSize="9">{points[points.length - 1].date}</text>
                      </svg>
                    ) : <p className="text-[11px] text-slate-500">{check.details}</p>}
                  </div>

                  <p className="text-[11px] text-cyan-200">{check.summary || check.details}</p>
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <h3 className="text-base font-bold text-white">Lago d'Orta · junio</h3>
          <span className="text-xs text-slate-500">Medias 2021–2026</span>
        </div>

        {/* 6 Environmental Historical Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ORTA_HISTORICAL_CONDITIONS.map((cond) => {
            return (
              <div
                key={cond.id}
                className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      {getEnvIcon(cond.category)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{cond.title}</h4>
                      <span className="text-[10px] text-slate-400 block">{cond.subtext}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="text-base font-extrabold font-mono text-cyan-300">
                    {cond.value}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Historical Readiness Evolution Chart */}
      <HistoricalReadinessView readiness={readiness} activities={activities} />
    </div>
  );
};
