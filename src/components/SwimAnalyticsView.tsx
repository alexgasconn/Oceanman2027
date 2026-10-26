import React, { useMemo, useState } from 'react';
import { SwimActivity } from '../types/swim.ts';
import { formatPace } from '../utils/swimCalculators.ts';
import { createHistogram, getWeeklyRollingMean } from '../utils/swimAnalytics.ts';

type ActivityFilter = 'all' | 'pool' | 'open_water';

const width = 640;
const height = 270;
const margin = { top: 18, right: 18, bottom: 42, left: 54 };
const plotWidth = width - margin.left - margin.right;
const plotHeight = height - margin.top - margin.bottom;

interface ChartPanelProps {
  title: string;
  detail: string;
  children: React.ReactNode;
}

const ChartPanel: React.FC<ChartPanelProps> = ({ title, detail, children }) => (
  <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
    <div className="mb-2">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <p className="text-[11px] text-slate-500">{detail}</p>
    </div>
    {children}
  </section>
);

const EmptyChart: React.FC = () => (
  <div className="flex h-64 items-center justify-center text-xs text-slate-500">
    No hay nados para este filtro
  </div>
);

interface HistogramProps {
  values: number[];
  formatValue: (value: number) => string;
  color: string;
}

const Histogram: React.FC<HistogramProps> = ({ values, formatValue, color }) => {
  const bins = useMemo(() => createHistogram(values), [values]);
  if (bins.length === 0) return <EmptyChart />;

  const maxCount = Math.max(1, ...bins.map(bin => bin.count));
  const tickCount = 4;
  const barWidth = plotWidth / bins.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Histograma">
      {Array.from({ length: tickCount + 1 }, (_, index) => {
        const value = Math.round(maxCount * (1 - index / tickCount));
        const y = margin.top + plotHeight * index / tickCount;
        return (
          <g key={index}>
            <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#263449" strokeDasharray="3 5" />
            <text x={margin.left - 10} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{value}</text>
          </g>
        );
      })}
      {bins.map((bin, index) => {
        const barHeight = bin.count / maxCount * plotHeight;
        const x = margin.left + index * barWidth + 2;
        const y = margin.top + plotHeight - barHeight;
        return (
          <g key={index}>
            <rect x={x} y={y} width={Math.max(1, barWidth - 4)} height={barHeight} rx="3" fill={color} fillOpacity="0.78">
              <title>{`${formatValue(bin.start)}–${formatValue(bin.end)}: ${bin.count} nado${bin.count === 1 ? '' : 's'}`}</title>
            </rect>
            {index % 2 === 0 && (
              <text x={x + (barWidth - 4) / 2} y={height - 14} textAnchor="middle" fill="#94a3b8" fontSize="9">
                {formatValue(bin.start)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

interface ScatterPoint {
  activity: SwimActivity;
  distanceKm: number;
}

const DistancePaceScatter: React.FC<{ activities: SwimActivity[] }> = ({ activities }) => {
  const points: ScatterPoint[] = activities
    .filter(activity => activity.distance > 0 && activity.pacePer100m > 0)
    .map(activity => ({ activity, distanceKm: activity.distance / 1000 }));
  if (points.length === 0) return <EmptyChart />;

  const maxDistance = Math.max(1, ...points.map(point => point.distanceKm));
  const paceValues = points.map(point => point.activity.pacePer100m);
  const minPace = Math.min(...paceValues);
  const maxPace = Math.max(...paceValues);
  const pacePadding = Math.max(5, (maxPace - minPace) * 0.08);
  const paceFloor = Math.max(0, minPace - pacePadding);
  const paceCeiling = maxPace + pacePadding || paceFloor + 1;
  const paceRange = paceCeiling - paceFloor || 1;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Dispersión de distancia y ritmo">
      {Array.from({ length: 5 }, (_, index) => {
        const ratio = index / 4;
        const x = margin.left + plotWidth * ratio;
        const pace = paceCeiling - paceRange * ratio;
        const y = margin.top + plotHeight * ratio;
        return (
          <g key={index}>
            <line x1={x} x2={x} y1={margin.top} y2={height - margin.bottom} stroke="#263449" strokeDasharray="3 5" />
            <text x={x} y={height - 14} textAnchor="middle" fill="#94a3b8" fontSize="10">{(maxDistance * ratio).toFixed(1)}</text>
            <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#263449" strokeDasharray="3 5" />
            <text x={margin.left - 9} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{formatPace(pace)}</text>
          </g>
        );
      })}
      {points.map(({ activity, distanceKm }) => {
        const x = margin.left + distanceKm / maxDistance * plotWidth;
        const y = margin.top + (paceCeiling - activity.pacePer100m) / paceRange * plotHeight;
        const fill = activity.type === 'open_water' ? '#22d3ee' : '#60a5fa';
        return (
          <circle key={activity.id} cx={x} cy={y} r="5" fill={fill} fillOpacity="0.78" stroke="#07111f" strokeWidth="1.5">
            <title>{`${activity.title} · ${distanceKm.toFixed(2)} km · ${formatPace(activity.pacePer100m)}`}</title>
          </circle>
        );
      })}
    </svg>
  );
};

const WeeklyRollingMean: React.FC<{ activities: SwimActivity[] }> = ({ activities }) => {
  const points = useMemo(() => getWeeklyRollingMean(activities), [activities]);
  if (points.length === 0) return <EmptyChart />;

  const maxKm = Math.max(1, ...points.map(point => point.rollingMeanKm));
  const yMax = Math.ceil(maxKm / 5) * 5 || 5;
  const coordinates = points.map((point, index) => ({
    x: margin.left + (points.length === 1 ? plotWidth / 2 : index / (points.length - 1) * plotWidth),
    y: margin.top + plotHeight - point.rollingMeanKm / yMax * plotHeight,
    point,
  }));
  const line = coordinates.map(point => `${point.x},${point.y}`).join(' ');
  const area = `${margin.left},${height - margin.bottom} ${line} ${width - margin.right},${height - margin.bottom}`;
  const labelIndexes = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Media móvil del volumen semanal">
      {Array.from({ length: 5 }, (_, index) => {
        const value = yMax * (1 - index / 4);
        const y = margin.top + plotHeight * index / 4;
        return (
          <g key={index}>
            <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#263449" strokeDasharray="3 5" />
            <text x={margin.left - 9} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{value.toFixed(0)}</text>
          </g>
        );
      })}
      <polygon points={area} fill="#34d399" fillOpacity="0.1" />
      <polyline points={line} fill="none" stroke="#34d399" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {coordinates.map(({ x, y, point }, index) => (
        <g key={point.weekStart}>
          <circle cx={x} cy={y} r="3" fill="#6ee7b7">
            <title>{`${point.weekStart} · ${point.rollingMeanKm.toFixed(1)} km/sem de media`}</title>
          </circle>
          {labelIndexes.has(index) && (
            <text x={x} y={height - 14} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} fill="#94a3b8" fontSize="10">
              {point.weekStart.slice(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

interface SwimAnalyticsViewProps {
  activities: SwimActivity[];
}

export const SwimAnalyticsView: React.FC<SwimAnalyticsViewProps> = ({ activities }) => {
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const filteredActivities = useMemo(
    () => activityFilter === 'all' ? activities : activities.filter(activity => activity.type === activityFilter),
    [activities, activityFilter]
  );
  const distanceValues = useMemo(() => filteredActivities.map(activity => activity.distance / 1000), [filteredActivities]);
  const paceValues = useMemo(() => filteredActivities.map(activity => activity.pacePer100m).filter(Number.isFinite), [filteredActivities]);
  const counts = {
    all: activities.length,
    pool: activities.filter(activity => activity.type === 'pool').length,
    open_water: activities.filter(activity => activity.type === 'open_water').length,
  };
  const filters: { id: ActivityFilter; label: string }[] = [
    { id: 'all', label: 'Todo' },
    { id: 'pool', label: 'Piscina' },
    { id: 'open_water', label: 'Aguas abiertas' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Distribución de entrenos</h2>
          <p className="text-xs text-slate-500">Distancia, ritmo y volumen semanal</p>
        </div>
        <div className="flex w-fit items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1" role="group" aria-label="Filtrar tipo de nado">
          {filters.map(filter => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={activityFilter === filter.id}
              onClick={() => setActivityFilter(filter.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${activityFilter === filter.id ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
            >
              {filter.label} <span className="text-[10px] opacity-70">{counts[filter.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartPanel title="Distancia vs ritmo" detail="Cada punto representa un nado · ritmo en min/100 m">
          <DistancePaceScatter activities={filteredActivities} />
          <div className="flex justify-end gap-4 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-400" />Piscina</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400" />Aguas abiertas</span>
          </div>
        </ChartPanel>

        <ChartPanel title="Histograma de distancia" detail="Frecuencia de nados por distancia · km">
          <Histogram values={distanceValues} formatValue={value => `${value.toFixed(1)}`} color="#22d3ee" />
        </ChartPanel>

        <ChartPanel title="Histograma de ritmo" detail="Frecuencia de nados por ritmo · min/100 m">
          <Histogram values={paceValues} formatValue={formatPace} color="#60a5fa" />
        </ChartPanel>

        <ChartPanel title="Volumen semanal" detail="Media móvil de 4 semanas · km/semana">
          <WeeklyRollingMean activities={filteredActivities} />
        </ChartPanel>
      </div>
    </div>
  );
};