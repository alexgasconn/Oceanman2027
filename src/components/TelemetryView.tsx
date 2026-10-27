import React, { useState, useMemo } from 'react';
import {
  Activity,
  BarChart2,
  ListFilter,
  Waves,
  Timer,
  Sparkles,
  Compass,
  Zap,
  TrendingUp
} from 'lucide-react';
import { SwimActivity } from '../types/swim.ts';
import { ActivitiesListView } from './ActivitiesListView.tsx';
import { SwimAnalyticsView } from './SwimAnalyticsView.tsx';
import { EvolutionTelemetryView } from './EvolutionTelemetryView.tsx';
import { formatDistance, formatDuration, formatPace } from '../utils/swimCalculators.ts';

interface TelemetryViewProps {
  activities: SwimActivity[];
  onSelectActivity: (activity: SwimActivity) => void;
  onOpenImport: () => void;
}

export const TelemetryView: React.FC<TelemetryViewProps> = ({
  activities,
  onSelectActivity,
  onOpenImport,
}) => {
  const [subTab, setSubTab] = useState<'sessions' | 'analysis' | 'charts'>('sessions');

  // Key metrics calculation
  const metrics = useMemo(() => {
    if (activities.length === 0) {
      return {
        totalKm: 0,
        openWaterCount: 0,
        avgMovingRatio: null,
        avgPaceSec: null,
        swolfCount: 0,
        splCount: 0,
      };
    }

    const totalDist = activities.reduce((sum, a) => sum + a.distance, 0);
    const owSessions = activities.filter(a => a.type === 'open_water');
    const ratios = activities.map(activity => activity.movingRatio).filter((value): value is number => value !== undefined);
    const paceSessions = activities.filter(activity => activity.distance > 0 && activity.movingTime > 0);
    const paceDistance = paceSessions.reduce((sum, activity) => sum + activity.distance, 0);
    const paceTime = paceSessions.reduce((sum, activity) => sum + activity.movingTime, 0);
    const swolfCount = activities.filter(activity => activity.hasRecordedSwolf && activity.swolf !== undefined).length;
    const splCount = activities.filter(activity => activity.hasRecordedSpl && activity.strokesPerLength !== undefined).length;

    return {
      totalKm: Number((totalDist / 1000).toFixed(1)),
      openWaterCount: owSessions.length,
      avgMovingRatio: ratios.length ? Math.round(ratios.reduce((sum, value) => sum + value, 0) / ratios.length) : null,
      avgPaceSec: paceDistance > 0 ? Math.round(paceTime / paceDistance * 100) : null,
      swolfCount,
      splCount,
    };
  }, [activities]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Telemetry KPI strip */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">
                Telemetría & Registro de Sesiones Strava
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Ritmo calculado estrictamente con <strong className="text-cyan-300">Moving Time</strong>, ratio de continuidad y detección automática de travesías (SNL, Oncoswim, Aigües Obertes).
            </p>
          </div>

          {/* Sub-view switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs shrink-0">
            <button
              onClick={() => setSubTab('sessions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${subTab === 'sessions'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Sesiones ({activities.length})</span>
            </button>
            <button
              onClick={() => setSubTab('analysis')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${subTab === 'analysis'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Distribución</span>
            </button>
            <button
              onClick={() => setSubTab('charts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${subTab === 'charts'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Evolución</span>
            </button>
          </div>
        </div>

        {/* 4 Key telemetry metric cards */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Aguas Abiertas / Travesías</span>
            <span className="text-base font-mono font-bold text-cyan-400 tabular-nums">
              {metrics.openWaterCount} <span className="text-xs font-sans text-slate-400">sesiones</span>
            </span>
            <span className="text-[10px] text-slate-500 block">Clasificación con evidencia GPS</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Moving Ratio Promedio</span>
            <span className="text-base font-mono font-bold text-emerald-400 tabular-nums">
              {metrics.avgMovingRatio === null ? 'N/D' : `${metrics.avgMovingRatio}%`}
            </span>
            <span className="text-[10px] text-slate-500 block">Continuidad de nado</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Ritmo Base Medio</span>
            <span className="text-base font-mono font-bold text-white tabular-nums">
              {metrics.avgPaceSec === null ? 'N/D' : formatPace(metrics.avgPaceSec)}
            </span>
            <span className="text-[10px] text-slate-500 block">Basado en moving time</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">SWOLF / SPL</span>
            <span className="text-base font-mono font-bold text-blue-400 tabular-nums">
              N/D
            </span>
            <span className="text-[10px] text-slate-500 block">{metrics.swolfCount} SWOLF · {metrics.splCount} SPL directos</span>
          </div>
        </div>
      </div>

      {/* Render selected subview */}
      {subTab === 'sessions' ? (
        <ActivitiesListView
          activities={activities}
          onSelectActivity={onSelectActivity}
          onOpenImport={onOpenImport}
        />
      ) : subTab === 'analysis' ? (
        <SwimAnalyticsView activities={activities} />
      ) : (
        <EvolutionTelemetryView
          activities={activities}
          onSelectActivity={onSelectActivity}
        />
      )}
    </div>
  );
};
