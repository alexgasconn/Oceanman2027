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
  const [metricTab, setMetricTab] = useState<'pace' | 'cadence' | 'dps' | 'swolf' | 'distance' | 'heartRate'>('pace');
  const [timeGrouping, setTimeGrouping] = useState<'weekly' | 'monthly'>('weekly');
  const [typeFilter, setTypeFilter] = useState<'all' | 'open_water' | 'pool'>('all');
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
      return { avgPace: 0, bestPace: 0, avgCadence: 0, avgDps: 0, avgSwolf: 0, totalKm: 0, totalHours: 0 };
    }
    const totalDist = filteredActivities.reduce((acc, a) => acc + a.distance, 0);
    const totalTime = filteredActivities.reduce((acc, a) => acc + a.movingTime, 0);
    const avgPace = (totalTime / totalDist) * 100;
    const bestPace = Math.min(...filteredActivities.map(a => a.pacePer100m));
    const cadences = filteredActivities.filter(a => a.averageCadence).map(a => a.averageCadence!);
    const avgCadence = cadences.length > 0 ? Math.round(cadences.reduce((a, b) => a + b, 0) / cadences.length) : 0;
    const dpsList = filteredActivities.filter(a => a.dps).map(a => a.dps!);
    const avgDps = dpsList.length > 0 ? dpsList.reduce((a, b) => a + b, 0) / dpsList.length : 0;
    const swolfList = filteredActivities.filter(a => a.swolf).map(a => a.swolf!);
    const avgSwolf = swolfList.length > 0 ? Math.round(swolfList.reduce((a, b) => a + b, 0) / swolfList.length) : 0;

    return {
      avgPace: Math.round(avgPace),
      bestPace: Math.round(bestPace),
      avgCadence,
      avgDps: Number(avgDps.toFixed(2)),
      avgSwolf,
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
        const distance = sessions.reduce((sum, activity) => sum + activity.distance, 0);
        const movingTime = sessions.reduce((sum, activity) => sum + activity.movingTime, 0);
        return distance > 0 ? (movingTime / distance) * 100 : 0;
      }
      if (metricTab === 'distance') {
        return sessions.reduce((sum, activity) => sum + activity.distance, 0) / sessions.length / 1000;
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
        if (metricTab === 'cadence') return activity.averageCadence || 62;
        if (metricTab === 'dps') return activity.dps || 1.6;
        return activity.swolf || 75;
      });
      return metrics.reduce((sum, value) => sum + value, 0) / metrics.length;
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

  return (
    <div className="space-y-8">
      {/* Top Banner: Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block font-medium">Ritmo Medio /100m</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-cyan-400 tabular-nums">
            {formatPace(stats.avgPace)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">Ritmo global continuo</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block font-medium">Mejor Ritmo Registrado</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {formatPace(stats.bestPace)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1">Pico umbral</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block font-medium">Cadencia Media</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {stats.avgCadence}
            </span>
            <span className="text-xs text-slate-400">SPM</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Brazadas por minuto</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block font-medium">Deslizamiento DPS</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-blue-400 tabular-nums">
              {stats.avgDps}
            </span>
            <span className="text-xs text-slate-400">m/ciclo</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Metros por ciclo de brazada</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block font-medium">Puntuación SWOLF</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-violet-400 tabular-nums">
            {stats.avgSwolf}
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
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                metricTab === 'pace' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ritmo /100m
            </button>
            <button
              onClick={() => setMetricTab('cadence')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                metricTab === 'cadence' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cadencia (SPM)
            </button>
            <button
              onClick={() => setMetricTab('dps')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                metricTab === 'dps' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Deslizamiento (DPS)
            </button>
            <button
              onClick={() => setMetricTab('swolf')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                metricTab === 'swolf' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SWOLF
            </button>
            <button
              onClick={() => setMetricTab('distance')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                metricTab === 'distance' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Distancia media/sesión
            </button>
            <button
              onClick={() => setMetricTab('heartRate')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                metricTab === 'heartRate' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
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
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                  typeFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todos ({activities.length})
              </button>
              <button
                onClick={() => setTypeFilter('open_water')}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                  typeFilter === 'open_water' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Aguas Abiertas ({activities.filter(a => a.type === 'open_water').length})
              </button>
              <button
                onClick={() => setTypeFilter('pool')}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                  typeFilter === 'pool' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Piscina ({activities.filter(a => a.type === 'pool').length})
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
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible select-none">
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
                const isHovered = hoveredPoint?.id === pt.act.id;

                return (
                  <g key={i} className="cursor-pointer" onClick={() => onSelectActivity(pt.act)}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 7 : (isOpen ? 4.5 : 3.5)}
                      fill={isOpen ? '#22d3ee' : '#3b82f6'}
                      stroke="#020617"
                      strokeWidth="2"
                      onMouseEnter={() => setHoveredPoint(pt.act)}
                      onMouseLeave={() => setHoveredPoint(null)}
                      className="transition-transform hover:scale-125"
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
            </svg>
          </div>
        </div>

        {metricTab === 'heartRate' && dataPoints.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-400">No hay pulsaciones registradas en las sesiones filtradas.</p>
        )}

        {/* Dynamic Hover Tooltip Preview */}
        {hoveredPoint && (
          <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4 text-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${hoveredPoint.type === 'open_water' ? 'bg-cyan-400' : 'bg-blue-400'}`} />
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
                            ? `${Math.round(hoveredDataPoint.val)} SPM`
                            : hoveredDataPoint.val.toFixed(2)}
                  </strong> <span className="text-slate-500">({hoveredDataPoint.label}, {hoveredDataPoint.sessionCount} sesiones)</span>
                </span>
              )}
              <span>Dist: <strong className="text-white">{formatDistance(hoveredPoint.distance)}</strong></span>
              <span>Ritmo: <strong className="text-cyan-400">{formatPace(hoveredPoint.pacePer100m)}</strong></span>
              <span>Cadencia: <strong className="text-amber-400">{hoveredPoint.averageCadence} SPM</strong></span>
              <span>DPS: <strong className="text-blue-400">{hoveredPoint.dps}m</strong></span>
              <span>SWOLF: <strong className="text-violet-400">{hoveredPoint.swolf}</strong></span>
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
