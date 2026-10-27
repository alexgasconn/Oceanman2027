import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowUpDown, ChevronDown, ChevronRight, ChevronUp, Waves, Calendar, Clock, Shield, RotateCcw } from 'lucide-react';
import { SwimActivity } from '../types/swim.ts';
import { formatDistance, formatDuration, formatPace } from '../utils/swimCalculators.ts';

interface ActivitiesListViewProps {
  activities: SwimActivity[];
  onSelectActivity: (activity: SwimActivity) => void;
  onOpenImport: () => void;
}

type SortField = 'date' | 'title' | 'type' | 'distance' | 'movingTime' | 'movingRatio' | 'pace' | 'cadence' | 'dps' | 'swolf' | 'spl';

export const ActivitiesListView: React.FC<ActivitiesListViewProps> = ({
  activities,
  onSelectActivity,
  onOpenImport,
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'open_water' | 'pool' | 'unknown'>('all');
  const [distRange, setDistRange] = useState<'all' | 'under_3k' | '3k_6k' | '6k_10k' | 'over_10k'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'last_30d' | 'last_90d' | 'this_year'>('all');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const resetFilters = () => {
    setSearch('');
    setFilterType('all');
    setDistRange('all');
    setDateFilter('all');
  };

  const hasActiveFilters = search !== '' || filterType !== 'all' || distRange !== 'all' || dateFilter !== 'all';

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(order => order === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortBy(field);
    setSortOrder(field === 'pace' || field === 'title' || field === 'type' ? 'asc' : 'desc');
  };

  const renderSortHeader = (label: string, field: SortField, alignment = '') => (
    <th
      className={`py-3.5 px-4 font-semibold ${alignment}`}
      aria-sort={sortBy === field ? sortOrder === 'asc' ? 'ascending' : 'descending' : 'none'}
    >
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="inline-flex items-center gap-1.5 hover:text-white cursor-pointer"
      >
        <span>{label}</span>
        {sortBy === field
          ? sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
          : <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />}
      </button>
    </th>
  );

  const filteredAndSorted = useMemo(() => {
    const now = Date.now();

    return activities
      .filter((a) => {
        // Medium filter
        if (filterType !== 'all' && a.type !== filterType) return false;

        // Search text
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const matchTitle = String(a.title || '').toLowerCase().includes(q);
          const matchDate = String(a.date || '').includes(q);
          const matchNotes = a.notes ? String(a.notes).toLowerCase().includes(q) : false;
          if (!matchTitle && !matchDate && !matchNotes) return false;
        }

        // Distance range filter
        if (distRange === 'under_3k' && a.distance >= 3000) return false;
        if (distRange === '3k_6k' && (a.distance < 3000 || a.distance >= 6000)) return false;
        if (distRange === '6k_10k' && (a.distance < 6000 || a.distance >= 10000)) return false;
        if (distRange === 'over_10k' && a.distance < 10000) return false;

        // Date window filter
        if (dateFilter !== 'all') {
          const actTime = new Date(a.date).getTime();
          if (dateFilter === 'last_30d' && actTime < now - 30 * 24 * 3600 * 1000) return false;
          if (dateFilter === 'last_90d' && actTime < now - 90 * 24 * 3600 * 1000) return false;
          if (dateFilter === 'this_year' && !a.date.startsWith(String(new Date().getFullYear()))) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const getValue = (activity: SwimActivity): string | number | undefined => {
          switch (sortBy) {
            case 'date': return new Date(activity.date).getTime();
            case 'title': return activity.title.toLocaleLowerCase();
            case 'type': return activity.type;
            case 'distance': return activity.distance;
            case 'movingTime': return activity.movingTime;
            case 'movingRatio': return activity.movingRatio;
            case 'pace': return activity.pacePer100m;
            case 'cadence': return activity.averageCadence;
            case 'dps': return activity.dps;
            case 'swolf': return activity.swolf;
            case 'spl': return activity.strokesPerLength;
          }
        };
        const first = getValue(a);
        const second = getValue(b);
        if (first === undefined) return second === undefined ? 0 : 1;
        if (second === undefined) return -1;
        const diff = typeof first === 'string' && typeof second === 'string'
          ? first.localeCompare(second)
          : Number(first) - Number(second);
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [activities, search, filterType, distRange, dateFilter, sortBy, sortOrder]);

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por lugar, mar, pantano, serie, notas..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Quick Primary Filters & Sort */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${filterType === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Todos ({activities.length})
              </button>
              <button
                onClick={() => setFilterType('open_water')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${filterType === 'open_water' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Aguas Abiertas
              </button>
              <button
                onClick={() => setFilterType('pool')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${filterType === 'pool' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Piscina
              </button>
              <button
                onClick={() => setFilterType('unknown')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${filterType === 'unknown' ? 'bg-slate-700 text-slate-200' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Sin clasificar ({activities.filter(activity => activity.type === 'unknown').length})
              </button>
            </div>

            <button
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${showAdvancedFilters || hasActiveFilters
                ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtros Avanzados</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
              )}
            </button>

          </div>
        </div>

        {/* Collapsible Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs animate-in fade-in duration-200">
            {/* Filter: Distance Range */}
            <div>
              <span className="text-slate-400 font-semibold block mb-1.5">Distancia de Sesión:</span>
              <select
                value={distRange}
                onChange={(e) => setDistRange(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Todas las distancias</option>
                <option value="under_3k">&lt; 3.000m (velocidad/técnica)</option>
                <option value="3k_6k">3.000m – 6.000m (volumen medio)</option>
                <option value="6k_10k">6.000m – 10.000m (fondo largo)</option>
                <option value="over_10k">≥ 10.000m (test ultra)</option>
              </select>
            </div>

            {/* Filter: Date Window */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-slate-400 font-semibold">Ventana Temporal:</span>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Limpiar filtros</span>
                  </button>
                )}
              </div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Todo el historial ({activities.length})</option>
                <option value="last_30d">Últimos 30 días</option>
                <option value="last_90d">Últimos 90 días</option>
                <option value="this_year">Año 2026</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* High-Density Tabular Grid */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                {renderSortHeader('Fecha', 'date')}
                {renderSortHeader('Actividad', 'title')}
                {renderSortHeader('Tipo', 'type')}
                {renderSortHeader('Distancia', 'distance', 'text-right')}
                {renderSortHeader('Tiempo nado', 'movingTime', 'text-right')}
                {renderSortHeader('Moving Ratio', 'movingRatio', 'text-right')}
                {renderSortHeader('Ritmo /100m', 'pace', 'text-right')}
                {renderSortHeader('Cadencia (export)', 'cadence', 'text-right')}
                {renderSortHeader('DPS', 'dps', 'text-right')}
                {renderSortHeader('SWOLF', 'swolf', 'text-right')}
                {renderSortHeader('SPL', 'spl', 'text-right')}
                <th className="py-3.5 px-4 text-center">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums text-slate-300">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 font-sans">
                    No se encontraron sesiones con los filtros seleccionados.{' '}
                    <button
                      onClick={resetFilters}
                      className="text-cyan-400 underline underline-offset-4 font-semibold cursor-pointer ml-1"
                    >
                      Restablecer filtros
                    </button>
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((act) => {
                  const ratio = act.movingRatio;

                  return (
                    <tr
                      key={act.id}
                      onClick={() => onSelectActivity(act)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {act.date}
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-white group-hover:text-cyan-300 transition-colors">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="truncate max-w-xs">{act.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded px-2 py-1 font-sans text-[10px] font-semibold ${act.type === 'open_water' ? 'bg-cyan-950/70 text-cyan-300' : act.type === 'pool' ? 'bg-blue-950/70 text-blue-300' : 'bg-slate-800 text-slate-300'}`}>
                          {act.type === 'open_water' ? 'Aguas abiertas' : act.type === 'pool' ? 'Piscina' : 'Sin clasificar'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white whitespace-nowrap">
                        {formatDistance(act.distance)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300 whitespace-nowrap">
                        <div>{act.movingTime > 0 ? formatDuration(act.movingTime) : 'N/D'}</div>
                        {act.movingTime > 0 && act.elapsedTime > act.movingTime && (
                          <div className="text-[10px] text-slate-500 font-sans" title={`Pausa total: ${formatDuration(act.elapsedTime - act.movingTime)}`}>
                            Elapsed: {formatDuration(act.elapsedTime)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {ratio !== undefined ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${ratio >= 90
                          ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40'
                          : ratio >= 80
                            ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-800/40'
                            : 'text-amber-400 bg-amber-950/60 border border-amber-800/40'
                          }`} title={`Continuidad: ${ratio}% en movimiento`}>
                          {ratio}%
                        </span> : <span className="text-slate-500">N/D</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-cyan-400 whitespace-nowrap">
                        {formatPace(act.pacePer100m)}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-400 whitespace-nowrap">
                        {act.hasRecordedCadence && act.averageCadence !== undefined ? act.averageCadence : 'N/D'}
                      </td>
                      <td className="py-3 px-4 text-right text-blue-300 whitespace-nowrap">
                        {act.hasRecordedDps && act.dps !== undefined ? `${act.dps}m` : 'N/D'}
                      </td>
                      <td className="py-3 px-4 text-right text-violet-300 whitespace-nowrap">
                        {act.hasRecordedSwolf && act.swolf !== undefined ? act.swolf : 'N/D'}
                      </td>
                      <td className="py-3 px-4 text-right text-violet-300 whitespace-nowrap">
                        {act.hasRecordedSpl && act.strokesPerLength !== undefined ? act.strokesPerLength : 'N/D'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors inline-block" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
