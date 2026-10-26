import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowUpDown, ChevronDown, ChevronRight, ChevronUp, Waves, Calendar, Clock, Droplet, Shield, RotateCcw } from 'lucide-react';
import { SwimActivity } from '../types/swim.ts';
import { formatDistance, formatDuration, formatPace } from '../utils/swimCalculators.ts';

interface ActivitiesListViewProps {
  activities: SwimActivity[];
  onSelectActivity: (activity: SwimActivity) => void;
  onOpenImport: () => void;
}

type SortField = 'date' | 'title' | 'distance' | 'movingTime' | 'movingRatio' | 'pace' | 'cadence' | 'dps' | 'swolf';

export const ActivitiesListView: React.FC<ActivitiesListViewProps> = ({
  activities,
  onSelectActivity,
  onOpenImport,
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'open_water' | 'pool'>('all');
  const [distRange, setDistRange] = useState<'all' | 'under_3k' | '3k_6k' | '6k_10k' | 'over_10k'>('all');
  const [tempFilter, setTempFilter] = useState<'all' | 'cold' | 'mild' | 'warm'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'last_30d' | 'last_90d' | 'this_year'>('all');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const resetFilters = () => {
    setSearch('');
    setFilterType('all');
    setDistRange('all');
    setTempFilter('all');
    setDateFilter('all');
  };

  const hasActiveFilters = search !== '' || filterType !== 'all' || distRange !== 'all' || tempFilter !== 'all' || dateFilter !== 'all';

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(order => order === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortBy(field);
    setSortOrder(field === 'pace' || field === 'title' ? 'asc' : 'desc');
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
    const now = new Date('2026-10-24T12:00:00Z').getTime();

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

        // Temperature filter
        const temp = a.waterTemp || (a.type === 'pool' ? 27 : 20);
        if (tempFilter === 'cold' && temp > 20) return false;
        if (tempFilter === 'mild' && (temp <= 20 || temp > 24)) return false;
        if (tempFilter === 'warm' && temp <= 24) return false;

        // Date window filter
        if (dateFilter !== 'all') {
          const actTime = new Date(a.date).getTime();
          if (dateFilter === 'last_30d' && actTime < now - 30 * 24 * 3600 * 1000) return false;
          if (dateFilter === 'last_90d' && actTime < now - 90 * 24 * 3600 * 1000) return false;
          if (dateFilter === 'this_year' && !a.date.startsWith('2026')) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const getValue = (activity: SwimActivity): string | number | undefined => {
          switch (sortBy) {
            case 'date': return new Date(activity.date).getTime();
            case 'title': return activity.title.toLocaleLowerCase();
            case 'distance': return activity.distance;
            case 'movingTime': return activity.movingTime;
            case 'movingRatio': return activity.movingRatio ?? (activity.elapsedTime > 0 ? activity.movingTime / activity.elapsedTime * 100 : 100);
            case 'pace': return activity.pacePer100m;
            case 'cadence': return activity.averageCadence;
            case 'dps': return activity.dps;
            case 'swolf': return activity.swolf;
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
  }, [activities, search, filterType, distRange, tempFilter, dateFilter, sortBy, sortOrder]);

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
                className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  filterType === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todos ({activities.length})
              </button>
              <button
                onClick={() => setFilterType('open_water')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  filterType === 'open_water' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Aguas Abiertas
              </button>
              <button
                onClick={() => setFilterType('pool')}
                className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  filterType === 'pool' ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Piscina
              </button>
            </div>

            <button
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                showAdvancedFilters || hasActiveFilters
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

            {/* Filter: Water Temperature */}
            <div>
              <span className="text-slate-400 font-semibold block mb-1.5">Temperatura del Agua:</span>
              <select
                value={tempFilter}
                onChange={(e) => setTempFilter(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Todas las temperaturas</option>
                <option value="cold">Fría (≤ 20°C · Símil Lago d'Orta)</option>
                <option value="mild">Templada (21°C – 24°C)</option>
                <option value="warm">Cálida / Piscina (&gt; 24°C)</option>
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
                  {renderSortHeader('Distancia', 'distance', 'text-right')}
                  {renderSortHeader('Tiempo nado', 'movingTime', 'text-right')}
                  {renderSortHeader('Moving Ratio', 'movingRatio', 'text-right')}
                  {renderSortHeader('Ritmo /100m', 'pace', 'text-right')}
                  {renderSortHeader('Cadencia', 'cadence', 'text-right')}
                  {renderSortHeader('DPS', 'dps', 'text-right')}
                  {renderSortHeader('SWOLF', 'swolf', 'text-right')}
                <th className="py-3.5 px-4 text-center">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums text-slate-300">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 font-sans">
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
                  const isOpen = act.type === 'open_water' || (act.elevationHigh && act.elevationHigh !== 0);
                  const ratio = act.movingRatio || (act.elapsedTime > 0 ? Math.round((act.movingTime / act.elapsedTime) * 100) : 100);

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
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isOpen ? 'bg-cyan-400 shadow-sm shadow-cyan-400/50' : 'bg-blue-400'
                            }`}
                          />
                          <span className="truncate max-w-xs">{act.title}</span>
                          {isOpen ? (
                            <span 
                              className="text-[10px] text-cyan-300 font-medium bg-cyan-950/80 border border-cyan-700/60 px-1.5 py-0.5 rounded shrink-0 shadow-xs"
                              title={`Aguas Abiertas detectado por GPS: Elevación Máx ${act.elevationHigh || 0}m, Mín ${act.elevationLow || 0}m`}
                            >
                              Aguas Abiertas · Elev {act.elevationHigh !== undefined ? `${act.elevationHigh}m` : '>0m'}
                            </span>
                          ) : (
                            <span 
                              className="text-[10px] text-blue-300 font-medium bg-blue-950/80 border border-blue-800/60 px-1.5 py-0.5 rounded shrink-0"
                              title="Piscina detectada: Elevación Strava = 0m"
                            >
                              Piscina · Elev 0m
                            </span>
                          )}
                          {act.waterTemp && act.waterTemp <= 20 && (
                            <span className="text-[10px] text-blue-300 font-mono bg-blue-950/60 border border-blue-800/40 px-1.5 py-0.5 rounded shrink-0" title={`Agua fresca: ${act.waterTemp}°C`}>
                              ❄ {act.waterTemp}°C
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white whitespace-nowrap">
                        {formatDistance(act.distance)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300 whitespace-nowrap">
                        <div>{formatDuration(act.movingTime)}</div>
                        {act.elapsedTime > act.movingTime && (
                          <div className="text-[10px] text-slate-500 font-sans" title={`Pausa total: ${formatDuration(act.elapsedTime - act.movingTime)}`}>
                            Elapsed: {formatDuration(act.elapsedTime)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                          ratio >= 90
                            ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40'
                            : ratio >= 80
                            ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-800/40'
                            : 'text-amber-400 bg-amber-950/60 border border-amber-800/40'
                        }`} title={`Continuidad: ${ratio}% en movimiento (Pausa: ${formatDuration(act.elapsedTime - act.movingTime)})`}>
                          {ratio}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-cyan-400 whitespace-nowrap">
                        {formatPace(act.pacePer100m)}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-400 whitespace-nowrap">
                        {act.averageCadence || '--'} <span className="text-[10px] text-slate-500 font-sans">SPM</span>
                      </td>
                      <td className="py-3 px-4 text-right text-blue-300 whitespace-nowrap">
                        {act.dps ? `${act.dps}m` : '--'}
                      </td>
                      <td className="py-3 px-4 text-right text-violet-300 whitespace-nowrap">
                        {act.swolf || '--'}
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
