import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Layers, 
  Sparkles, 
  Filter, 
  Award, 
  Compass,
  Droplet
} from 'lucide-react';
import { OceanmanReadiness, SwimActivity, ReadinessCheckItem } from '../types/swim.ts';
import { calculateHistoricalReadiness, formatDistance, formatDuration } from '../utils/swimCalculators.ts';

interface HistoricalReadinessViewProps {
  readiness: OceanmanReadiness;
  activities: SwimActivity[];
}

export const HistoricalReadinessView: React.FC<HistoricalReadinessViewProps> = ({
  readiness,
  activities,
}) => {
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [checkStatusFilter, setCheckStatusFilter] = useState<'all' | 'passed' | 'warning' | 'pending'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'endurance' | 'volume' | 'open_water' | 'efficiency' | 'pacing'>('all');
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  // Recalculate timeline with selected granularity
  const historyData = useMemo(() => {
    return calculateHistoricalReadiness(activities, granularity);
  }, [activities, granularity]);

  // Filter checks
  const filteredChecks = useMemo(() => {
    return readiness.checks.filter(c => {
      if (checkStatusFilter !== 'all' && c.status !== checkStatusFilter) return false;
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      return true;
    });
  }, [readiness.checks, checkStatusFilter, categoryFilter]);

  // SVG Chart bounds
  const chartHeight = 240;
  const chartWidth = 800;
  const padding = { top: 25, right: 30, bottom: 40, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const points = useMemo(() => {
    if (historyData.length < 2) return [];
    return historyData.map((pt, i) => {
      const x = padding.left + (i / (historyData.length - 1)) * innerWidth;
      const yNormalized = pt.readinessScore / 100;
      const y = padding.top + innerHeight - yNormalized * innerHeight;
      return {
        ...pt,
        x,
        y,
      };
    });
  }, [historyData, innerWidth, innerHeight, padding]);

  const svgPath = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  const svgArea = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const baseY = padding.top + innerHeight;
    return `${svgPath} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  }, [svgPath, points, padding, innerHeight]);

  return (
    <div className="space-y-8">
      {/* 4 Multi-Window Rolling Volumes Strip */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span>Ventanas Rodantes de Volumen Acumulado (Rolling Windows)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Control de absorción fisiológica para evitar sobreentrenamiento y garantizar la base mitocondrial
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Window 1: 14 days */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between items-baseline text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Últimos 14 Días</span>
              <span className="font-mono text-cyan-400 font-bold tabular-nums">Meta 35 km</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold font-mono text-white tabular-nums">
                {(readiness.volumeLast14DaysMeters / 1000).toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">km</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-400 rounded-full"
                style={{ width: `${Math.min(100, (readiness.volumeLast14DaysMeters / 35000) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block">Carga aguda activa (ATL)</span>
          </div>

          {/* Window 2: 30 days */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between items-baseline text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Últimos 30 Días</span>
              <span className="font-mono text-blue-400 font-bold tabular-nums">Meta 75 km</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold font-mono text-blue-300 tabular-nums">
                {(readiness.volumeLast30DaysMeters / 1000).toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">km</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${Math.min(100, (readiness.volumeLast30DaysMeters / 75000) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block">Carga mensual sostenida</span>
          </div>

          {/* Window 3: 60 days */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between items-baseline text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Últimos 60 Días</span>
              <span className="font-mono text-indigo-400 font-bold tabular-nums">Meta 150 km</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold font-mono text-indigo-300 tabular-nums">
                {(readiness.volumeLast60DaysMeters / 1000).toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">km</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${Math.min(100, (readiness.volumeLast60DaysMeters / 150000) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block">Mesociclo de carga</span>
          </div>

          {/* Window 4: 90 days */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between items-baseline text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Últimos 90 Días</span>
              <span className="font-mono text-emerald-400 font-bold tabular-nums">Meta 200 km</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold font-mono text-emerald-300 tabular-nums">
                {(readiness.volumeLast90DaysMeters / 1000).toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">km</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, (readiness.volumeLast90DaysMeters / 200000) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 block">Macrobase trimestral</span>
          </div>
        </div>
      </div>

      {/* Historical Readiness Evolution Interactive Graph */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <span>Evolución Histórica del % de Preparación Oceanman</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Curva cronológica recalculada sesión a sesión para visualizar el crecimiento de tu preparación
            </p>
          </div>

          {/* Granularity Selector: Dia / Semana / Mes */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setGranularity('daily')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                granularity === 'daily' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Día a Día
            </button>
            <button
              onClick={() => setGranularity('weekly')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                granularity === 'weekly' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semanal
            </button>
            <button
              onClick={() => setGranularity('monthly')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                granularity === 'monthly' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mensual
            </button>
          </div>
        </div>

        {/* SVG Curve */}
        <div className="relative w-full overflow-x-auto">
          <div className="min-w-[650px]">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible select-none">
              <defs>
                <linearGradient id="readinessGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Threshold Lines: 50% Solid Progress, 70% Ready, 85% Elite */}
              {[
                { pct: 0.85, label: '85% Élite' },
                { pct: 0.70, label: '70% Ready to Conquer' },
                { pct: 0.50, label: '50% Base Sólida' },
              ].map((th, idx) => {
                const y = padding.top + innerHeight * (1 - th.pct);
                return (
                  <g key={idx}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      stroke="#334155"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padding.left + 6}
                      y={y - 4}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {th.label}
                    </text>
                  </g>
                );
              })}

              {/* Filled Area */}
              {svgArea && (
                <path d={svgArea} fill="url(#readinessGrad)" />
              )}

              {/* Main Curve */}
              {svgPath && (
                <path
                  d={svgPath}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Points */}
              {points.map((pt, i) => {
                const isHovered = hoveredPoint?.date === pt.date;
                const hasMilestone = Boolean(pt.milestoneUnlocked);

                return (
                  <g key={i} className="cursor-pointer">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={hasMilestone ? 6 : (isHovered ? 6 : 3.5)}
                      fill={hasMilestone ? '#f59e0b' : '#06b6d4'}
                      stroke="#020617"
                      strokeWidth="2"
                      onMouseEnter={() => setHoveredPoint(pt)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                    {hasMilestone && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="10"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeOpacity="0.5"
                        className="animate-ping"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Hover info banner */}
        {hoveredPoint && (
          <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-cyan-500/40 flex flex-wrap items-center justify-between gap-4 text-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-white">{hoveredPoint.label}</span>
              <span className="text-slate-500 font-mono">({hoveredPoint.date})</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-slate-300 font-mono">
              <span>Readiness: <strong className="text-cyan-400 text-sm">{hoveredPoint.readinessScore}%</strong></span>
              <span>Tirada Max: <strong className="text-white">{hoveredPoint.longestSwimKm} km</strong></span>
              <span>Volumen 30d: <strong className="text-blue-400">{hoveredPoint.volumeLast30DaysKm} km</strong></span>
              <span>Sesiones OW: <strong className="text-amber-400">{hoveredPoint.openWaterSessionsTotal}</strong></span>
              {hoveredPoint.milestoneUnlocked && (
                <span className="text-amber-300 font-bold bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                  ★ {hoveredPoint.milestoneUnlocked}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
