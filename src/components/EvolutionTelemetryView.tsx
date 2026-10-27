import React, { useState, useMemo } from 'react';
import {
  Activity,
  TrendingUp,
  Compass,
  Waves,
  Filter,
  Info,
  Zap,
  BarChart2,
  Calendar,
  Layers
} from 'lucide-react';
import { SwimActivity } from '../types/swim.ts';
import { formatPace, formatDistance, formatDuration, getCalendarWeeklyMileage } from '../utils/swimCalculators.ts';
import { getCalendarWeek } from '../utils/trainingWeeks.ts';

interface EvolutionTelemetryViewProps {
  activities: SwimActivity[];
  onSelectActivity: (activity: SwimActivity) => void;
}

export const EvolutionTelemetryView: React.FC<EvolutionTelemetryViewProps> = ({
  activities,
  onSelectActivity,
}) => {
  const [metricTab, setMetricTab] = useState<'pace' | 'cadence' | 'dps' | 'swolf' | 'spl' | 'distance' | 'heartRate'>('pace');
  const [timeGrouping, setTimeGrouping] = useState<'weekly' | 'monthly'>('weekly');
  const [typeFilter, setTypeFilter] = useState<'all' | 'open_water' | 'pool' | 'unknown'>('all');
  const [minDistFilter, setMinDistFilter] = useState<number>(0);
  const [hoveredPoint, setHoveredPoint] = useState<SwimActivity | null>(null);

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (minDistFilter > 0 && a.distance < minDistFilter) return false;
      return true;
    });
  }, [activities, typeFilter, minDistFilter]);

  // Chronological array for evolution (oldest to newest)
  const chronological = useMemo(() => {
    return [...filteredActivities].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredActivities]);

  // Weekly mileage
  const weeklyData = useMemo(() => {
    return getCalendarWeeklyMileage(filteredActivities);
  }, [filteredActivities]);

  const groupedActivities = useMemo(() => {
    const groups = new Map<string, { label: string; activities: SwimActivity[] }>();

    for (const activity of chronological) {
      const date = new Date(`${activity.date.slice(0, 10)}T12:00:00`);
      if (Number.isNaN(date.getTime())) continue;

      let key: string;
      let label: string;
      if (timeGrouping === 'weekly') {
        const week = getCalendarWeek(activity.date);
        if (!week) continue;
        key = week.key;
        const monday = new Date(`${week.key}T12:00:00`);
        label = monday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      } else {
        key = activity.date.slice(0, 7);
        label = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
      }

      const group = groups.get(key) || { label, activities: [] };
      group.activities.push(activity);
      groups.set(key, group);
    }

    return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
  }, [chronological, timeGrouping]);

  // Summary stats
  const stats = useMemo(() => {
    if (filteredActivities.length === 0) {
      return { avgPace: null, bestPace: null, avgCadence: null, avgDps: null, avgSwolf: null, avgSpl: null, totalKm: 0, totalHours: 0 };
    }
    const totalDist = filteredActivities.reduce((acc, a) => acc + a.distance, 0);
    const paceSessions = filteredActivities.filter(activity => activity.distance > 0 && activity.movingTime > 0);
    const totalTime = paceSessions.reduce((acc, activity) => acc + activity.movingTime, 0);
    const paceDistance = paceSessions.reduce((acc, activity) => acc + activity.distance, 0);
    const paces = paceSessions.map(activity => activity.movingTime / activity.distance * 100);
    const cadences = filteredActivities.filter(a => a.hasRecordedCadence && a.averageCadence !== undefined).map(a => a.averageCadence!);
    const dpsList = filteredActivities.filter(a => a.hasRecordedDps && a.dps !== undefined).map(a => a.dps!);
    const swolfList = filteredActivities.filter(a => a.type === 'pool' && a.poolLength === 25 && a.hasRecordedSwolf && a.swolf !== undefined).map(a => a.swolf!);
    const splList = filteredActivities.filter(a => a.type === 'pool' && a.poolLength === 25 && a.hasRecordedSpl && a.strokesPerLength !== undefined).map(a => a.strokesPerLength!);

    return {
      avgPace: paceDistance > 0 ? Math.round(totalTime / paceDistance * 100) : null,
      bestPace: paces.length > 0 ? Math.round(Math.min(...paces)) : null,
      avgCadence: cadences.length > 0 ? Math.round(cadences.reduce((a, b) => a + b, 0) / cadences.length) : null,
      avgDps: dpsList.length > 0 ? Number((dpsList.reduce((a, b) => a + b, 0) / dpsList.length).toFixed(2)) : null,
      avgSwolf: swolfList.length > 0 ? Math.round(swolfList.reduce((a, b) => a + b, 0) / swolfList.length) : null,
      avgSpl: splList.length > 0 ? Number((splList.reduce((a, b) => a + b, 0) / splList.length).toFixed(1)) : null,
      totalKm: Number((totalDist / 1000).toFixed(1)),
      totalHours: Number((totalTime / 3600).toFixed(1)),
    };
  }, [filteredActivities]);

  // SVG Chart bounds & coordinates
  const chartHeight = 260;
  const chartWidth = 800;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const dataPoints = useMemo(() => {
    if (groupedActivities.length === 0) return [];

    const values = groupedActivities.map(({ activities: sessions }): number | null => {
      if (metricTab === 'pace') {
        const validSessions = sessions.filter(activity => activity.distance > 0 && activity.movingTime > 0);
        const distance = validSessions.reduce((sum, activity) => sum + activity.distance, 0);
        const movingTime = validSessions.reduce((sum, activity) => sum + activity.movingTime, 0);
        return distance > 0 ? (movingTime / distance) * 100 : null;
      }
      if (metricTab === 'distance') {
        const validSessions = sessions.filter(activity => activity.distance > 0);
        return validSessions.length > 0
          ? validSessions.reduce((sum, activity) => sum + activity.distance, 0) / validSessions.length / 1000
          : null;
      }
      if (metricTab === 'heartRate') {
        const heartRates = sessions
          .map(activity => activity.avgHeartRate)
          .filter((heartRate): heartRate is number => typeof heartRate === 'number' && heartRate > 0);
        return heartRates.length > 0
          ? heartRates.reduce((sum, heartRate) => sum + heartRate, 0) / heartRates.length
          : null;
      }

      const metrics = sessions.map(activity => {
        if (metricTab === 'cadence') return activity.hasRecordedCadence ? activity.averageCadence : undefined;
        if (metricTab === 'dps') return activity.hasRecordedDps ? activity.dps : undefined;
        if (metricTab === 'swolf') return activity.type === 'pool' && activity.poolLength === 25 && activity.hasRecordedSwolf ? activity.swolf : undefined;
        return activity.type === 'pool' && activity.poolLength === 25 && activity.hasRecordedSpl ? activity.strokesPerLength : undefined;
      }).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      return metrics.length > 0 ? metrics.reduce((sum, value) => sum + value, 0) / metrics.length : null;
    });

    const validValues = values.filter((value): value is number => value !== null);
    if (validValues.length === 0) return [];
    const minVal = Math.min(...validValues);
    const maxVal = Math.max(...validValues);
    const valRange = maxVal - minVal || 1;

    return groupedActivities.map((group, index) => {
      const val = values[index];
      if (val === null) return null;
      const x = groupedActivities.length === 1
        ? padding.left + innerWidth / 2
        : padding.left + (index / (groupedActivities.length - 1)) * innerWidth;

      // Note: For Pace and SWOLF, lower is faster/better, so we invert or display intuitively
      let yNormalized = (val - minVal) / valRange;
      if (metricTab === 'pace' || metricTab === 'swolf') {
        // Lower is top
        yNormalized = 1 - yNormalized;
      }
      const y = padding.top + innerHeight - yNormalized * innerHeight;

      return {
        act: group.activities[group.activities.length - 1],
        label: group.label,
        sessionCount: group.activities.length,
        val,
        x,
        y,
      };
    }).filter((point): point is NonNullable<typeof point> => point !== null);
  }, [groupedActivities, metricTab, innerWidth, innerHeight, padding]);

  // Generate SVG path for trend
  const svgPath = useMemo(() => {
    if (dataPoints.length === 0) return '';
    return dataPoints.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [dataPoints]);

  const hoveredDataPoint = dataPoints.find(point => point.act.id === hoveredPoint?.id);
  const findPointAtPointer = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const screenMatrix = svg.getScreenCTM();
    if (!screenMatrix) return null;

    const pointer = svg.createSVGPoint();
    pointer.x = clientX;
    pointer.y = clientY;
    const chartPointer = pointer.matrixTransform(screenMatrix.inverse());

    let nearestPoint: typeof dataPoints[number] | null = null;
    let nearestDistance = 18;
    for (const point of dataPoints) {
      const distance = Math.hypot(point.x - chartPointer.x, point.y - chartPointer.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPoint = point;
      }
    }
    return nearestPoint;
  };

  return (
    <div className="space-y-8">
      {/* Top Banner: Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block font-medium">Ritmo Medio /100m</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-cyan-400 tabular-nums">
            {stats.avgPace === null ? 'N/D' : formatPace(stats.avgPace)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">Ritmo global continuo</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block font-medium">Mejor Ritmo Registrado</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {stats.bestPace === null ? 'N/D' : formatPace(stats.bestPace)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">Pico umbral</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block font-medium">Cadencia Media</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {stats.avgCadence ?? 'N/D'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Brazadas por minuto</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block font-medium">SPL registrado · 25 m</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-blue-400 tabular-nums">
              {stats.avgSpl ?? 'N/D'}
            </span>
            <span className="text-xs text-slate-400">brazadas/largo</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Sin dato directo en el CSV</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block font-medium">Puntuación SWOLF</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-violet-400 tabular-nums">
            {stats.avgSwolf ?? 'N/D'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">Eficiencia hidrodinámica</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block font-medium">Volumen Total</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
              {stats.totalKm}
            </span>
            <span className="text-xs text-slate-400">km</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">{stats.totalHours}h en agua</span>
        </div>
      </div>

      {/* Main Evolution Telemetry Chart */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <span>Evolución Temporal & Telemetría en el Agua</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Haz clic en cualquier sesión para ver desglose de splits y métricas detalladas
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setMetricTab('pace')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${metricTab === 'pace' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Ritmo /100m
            </button>
            <button
              onClick={() => setMetricTab('cadence')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${metricTab === 'cadence' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Cadencia (export)
            </button>
            <button
              onClick={() => setMetricTab('dps')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${metricTab === 'dps' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Deslizamiento (DPS)
            </button>
            <button
              onClick={() => setMetricTab('swolf')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${metricTab === 'swolf' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              SWOLF (25 m)
            </button>
            <button
              onClick={() => setMetricTab('spl')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${metricTab === 'spl' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              SPL (25 m)
            </button>
            <button
              onClick={() => setMetricTab('distance')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${metricTab === 'distance' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Distancia media/sesión
            </button>
            <button
              onClick={() => setMetricTab('heartRate')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${metricTab === 'heartRate' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Pulsaciones medias
            </button>
          </div>
        </div>

        {/* Filter controls row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>Medio:</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${typeFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Todos ({activities.length})
              </button>
              <button
                onClick={() => setTypeFilter('open_water')}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${typeFilter === 'open_water' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Aguas Abiertas ({activities.filter(a => a.type === 'open_water').length})
              </button>
              <button
                onClick={() => setTypeFilter('pool')}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${typeFilter === 'pool' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Piscina ({activities.filter(a => a.type === 'pool').length})
              </button>
              <button
                onClick={() => setTypeFilter('unknown')}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${typeFilter === 'unknown' ? 'bg-slate-700 text-slate-200 border border-slate-600' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Sin clasificar ({activities.filter(a => a.type === 'unknown').length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">Distancia mínima:</span>
            <select
              value={minDistFilter}
              onChange={(e) => setMinDistFilter(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value={0}>Todas las distancias</option>
              {[500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000].map(distance => (
                <option key={distance} value={distance}>≥ {distance.toLocaleString('es-ES')}m</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Agrupar:</span>
            <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 p-0.5">
              <button
                onClick={() => setTimeGrouping('weekly')}
                className={`rounded px-2.5 py-1 font-semibold ${timeGrouping === 'weekly' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Semana
              </button>
              <button
                onClick={() => setTimeGrouping('monthly')}
                className={`rounded px-2.5 py-1 font-semibold ${timeGrouping === 'monthly' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Mes
              </button>
            </div>
          </div>
        </div>

        {/* SVG Telemetry Canvas */}
        <div className="relative w-full overflow-x-auto">
          <div className="min-w-[650px]">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto overflow-visible select-none cursor-crosshair"
              onPointerMove={event => {
                const point = findPointAtPointer(event.currentTarget, event.clientX, event.clientY);
                setHoveredPoint(current => current?.id === point?.act.id ? current : point?.act || null);
              }}
              onPointerLeave={() => setHoveredPoint(null)}
              onClick={event => {
                const point = findPointAtPointer(event.currentTarget, event.clientX, event.clientY);
                if (point) onSelectActivity(point.act);
              }}
            >
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const y = padding.top + innerHeight * pct;
                return (
                  <g key={i}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="4 4"
                    />
                  </g>
                );
              })}

              {/* Connected Line */}
              {svgPath && (
                <path
                  d={svgPath}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Interactive Data Points */}
              {dataPoints.map((pt, i) => {
                const isOpen = pt.act.type === 'open_water';
                const pointColor = isOpen ? '#22d3ee' : pt.act.type === 'pool' ? '#3b82f6' : '#94a3b8';
                const isHovered = hoveredPoint?.id === pt.act.id;

                return (
                  <g key={i}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 7 : (isOpen ? 4.5 : 3.5)}
                      fill={pointColor}
                      stroke="#020617"
                      strokeWidth="2"
                      pointerEvents="none"
                    />
                  </g>
                );
              })}

              {dataPoints.map((pt, index) => {
                const labelInterval = Math.max(1, Math.ceil(dataPoints.length / 6));
                if (index % labelInterval !== 0 && index !== dataPoints.length - 1) return null;
                return (
                  <text key={`label-${pt.label}`} x={pt.x} y={chartHeight - 8} textAnchor="middle" fill="#94a3b8" fontSize="10">
                    {pt.label}
                  </text>
                );
              })}

              <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="transparent" pointerEvents="all" />
            </svg>
          </div>
        </div>

        {dataPoints.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-400">
            {metricTab === 'heartRate'
              ? 'No hay pulsaciones registradas en las sesiones filtradas.'
              : metricTab === 'cadence'
                ? 'No hay cadencia registrada en las sesiones filtradas.'
                : metricTab === 'dps'
                  ? 'No hay DPS medido directamente en las sesiones filtradas.'
                  : metricTab === 'swolf'
                    ? 'No hay SWOLF por largo en las sesiones filtradas.'
                    : metricTab === 'spl'
                      ? 'No hay brazadas por largo (SPL) registradas en las sesiones filtradas.'
                      : 'No hay datos válidos para esta métrica.'}
          </p>
        )}

        {/* Dynamic Hover Tooltip Preview */}
        {hoveredPoint && (
          <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4 text-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${hoveredPoint.type === 'open_water' ? 'bg-cyan-400' : hoveredPoint.type === 'pool' ? 'bg-blue-400' : 'bg-slate-400'}`} />
              <strong className="text-white">{hoveredPoint.title}</strong>
              <span className="text-slate-400 font-mono">({hoveredPoint.date})</span>
            </div>
            <div className="flex items-center gap-4 text-slate-300 font-mono">
              {hoveredDataPoint && (
                <span>
                  Media del periodo: <strong className="text-white">
                    {metricTab === 'distance'
                      ? `${hoveredDataPoint.val.toFixed(2)} km/sesión`
                      : metricTab === 'heartRate'
                        ? `${Math.round(hoveredDataPoint.val)} ppm`
                        : metricTab === 'pace'
                          ? formatPace(hoveredDataPoint.val)
                          : metricTab === 'cadence'
                            ? `${Math.round(hoveredDataPoint.val)} (unidad exportada)`
                            : metricTab === 'spl'
                              ? `${hoveredDataPoint.val.toFixed(1)} brazadas/largo`
                              : hoveredDataPoint.val.toFixed(2)}
                  </strong> <span className="text-slate-500">({hoveredDataPoint.label}, {hoveredDataPoint.sessionCount} sesiones)</span>
                </span>
              )}
              <span>Dist: <strong className="text-white">{formatDistance(hoveredPoint.distance)}</strong></span>
              <span>Ritmo: <strong className="text-cyan-400">{formatPace(hoveredPoint.pacePer100m)}</strong></span>
              {hoveredPoint.hasRecordedCadence && hoveredPoint.averageCadence !== undefined && (
                <span>Cadencia: <strong className="text-amber-400">{hoveredPoint.averageCadence} (export)</strong></span>
              )}
              {hoveredPoint.hasRecordedDps && hoveredPoint.dps !== undefined && (
                <span>DPS: <strong className="text-blue-400">{hoveredPoint.dps}m</strong></span>
              )}
              {hoveredPoint.hasRecordedSwolf && hoveredPoint.swolf !== undefined && (
                <span>SWOLF: <strong className="text-violet-400">{hoveredPoint.swolf}</strong></span>
              )}
              {hoveredPoint.hasRecordedSpl && hoveredPoint.strokesPerLength !== undefined && (
                <span>SPL: <strong className="text-violet-300">{hoveredPoint.strokesPerLength}</strong></span>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" />
              <span>Aguas Abiertas (Mar / Lago)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              <span>Piscina (25m / 50m)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-400 inline-block" />
              <span>Sin clasificar</span>
            </span>
          </div>
          <span>Mostrando {filteredActivities.length} sesiones</span>
        </div>
      </div>

      {/* Weekly Mileage & Target 20km Chart */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-cyan-400" />
              <span>Volumen Semanal & Progresión de Carga (km/semana)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Línea de referencia dorada en <strong>20 km/semana</strong>: umbral recomendado para el Oceanman 14K
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {weeklyData.slice(-26).map((w, idx) => {
            const totalBarWidth = Math.min(100, (w.distanceKm / 20) * 100);
            const openWaterBarWidth = w.distanceKm > 0 ? totalBarWidth * (w.openWaterDistanceKm / w.distanceKm) : 0;
            const poolBarWidth = totalBarWidth - openWaterBarWidth;

            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 w-28 shrink-0">
                    {w.label}
                  </span>
                  <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
                    <span className="text-cyan-400">{w.openWaterDistanceKm}k aguas ab.</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-blue-400">{w.poolDistanceKm}k piscina</span>
                    <span className="text-slate-600">·</span>
                    <strong className="text-white text-xs">{w.distanceKm} km</strong>
                  </div>
                </div>

                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800/80">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-500"
                    style={{ width: `${openWaterBarWidth}%` }}
                    title={`${w.openWaterDistanceKm} km Aguas Abiertas`}
                  />
                  <div
                    className="h-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${poolBarWidth}%` }}
                    title={`${w.poolDistanceKm} km Piscina`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
