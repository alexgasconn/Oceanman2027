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

  // Filter the 7 checks
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
    if (activities.length === 0) return 0;
    const sum = activities.reduce((acc, a) => acc + (a.movingRatio || 90), 0);
    return Number((sum / activities.length).toFixed(1));
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
              {longestPool ? formatDistance(longestPool.distance) : '0 m'}
            </span>
            <span className="text-[11px] text-slate-500">/ 10k meta</span>
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
              {longestOw ? formatDistance(longestOw.distance) : '0 m'}
            </span>
            <span className="text-[11px] text-slate-500">/ 12k meta</span>
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
            Hito objetivo: 25 km/sem
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
              {avgMovingRatio > 0 ? `${avgMovingRatio}%` : 'N/D'}
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold">Continuidad</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Tiempo nado vs tiempo total
          </p>
        </div>
      </div>

      {/* CHECKLIST DE CONTROL DE PREPARACIÓN (7 Checks - Rediseñado sin saturación) */}
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

        {/* 7 Streamlined Checks Cards */}
        <div className="space-y-3.5">
          {filteredChecks.map((check) => {
            const isPassed = check.status === 'passed';
            const isWarning = check.status === 'warning';

            return (
              <div
                key={check.id}
                className={`p-4 rounded-xl border transition-all ${isPassed
                    ? 'bg-slate-950/70 border-emerald-500/30 hover:border-emerald-500/50'
                    : isWarning
                      ? 'bg-slate-950/70 border-amber-500/30 hover:border-amber-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
              >
                {/* Clean Row 1: Header + Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      #{check.checkNumber}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">
                          {check.title}
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                          {check.weight}% peso
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {check.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${isPassed
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : isWarning
                          ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                          : 'bg-slate-800/80 border border-slate-700 text-slate-300'
                      }`}>
                      {isPassed ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Superado</span>
                        </>
                      ) : isWarning ? (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                          <span>En Progreso</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Pendiente</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Clean Row 2: Progress Bar & Current vs Target */}
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-400">Progreso actual:</span>
                    <strong className="text-white text-sm">{check.currentValueFormatted}</strong>
                    <span className="text-slate-500">/ objetivo {check.targetValueFormatted}</span>
                  </div>

                  <div className="flex items-center gap-3 sm:w-1/3">
                    <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isPassed ? 'bg-emerald-400' : isWarning ? 'bg-amber-400' : 'bg-cyan-500'
                          }`}
                        style={{ width: `${Math.min(100, Math.max(4, check.score))}%` }}
                      />
                    </div>
                    <span className={`font-mono text-xs font-bold tabular-nums shrink-0 ${isPassed ? 'text-emerald-400' : isWarning ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                      {check.score}%
                    </span>
                  </div>
                </div>

                {/* Clean Row 3: Horizontal Milestone Stepper (Hitos de Control) */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-400 shrink-0">Hitos:</span>
                    {check.milestones && check.milestones.length > 0 ? (
                      check.milestones.map((ms, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${ms.isCompleted
                              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 font-medium'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400'
                            }`}
                        >
                          {ms.isCompleted ? (
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-300">{ms.label}:</span>
                          <span>{ms.target}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400">{check.targetValueFormatted}</span>
                    )}
                  </div>
                </div>

              </div>
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
