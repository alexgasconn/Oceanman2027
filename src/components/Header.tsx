import React from 'react';
import { Waves, Upload, Activity, ShieldCheck, Compass } from 'lucide-react';

export type ActiveTabType = 'oceanman' | 'telemetry' | 'calculator';

interface HeaderProps {
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  onOpenImport: () => void;
  totalSwimsCount: number;
  totalKm: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenImport,
  totalSwimsCount,
  totalKm,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Bar Contract: 3 zones separated by gap-8 */}
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white">
              <Waves className="w-5 h-5 text-white" />
            </div>
            <button
              onClick={() => setActiveTab('oceanman')}
              className="text-left group cursor-pointer focus:outline-none"
            >
              <span className="text-lg font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-300 bg-clip-text text-transparent whitespace-nowrap">
                OCEANMAN
              </span>
            </button>
          </div>

          {/* Zone 2: Exactly 3 clean high-signal nav links */}
          <nav className="hidden md:flex items-center gap-2 text-sm font-medium">
            <button
              onClick={() => setActiveTab('oceanman')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${activeTab === 'oceanman'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Preparación</span>
            </button>

            <button
              onClick={() => setActiveTab('telemetry')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${activeTab === 'telemetry'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
            >
              <Activity className="w-4 h-4" />
              <span>Nados ({totalSwimsCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${activeTab === 'calculator'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
            >
              <Compass className="w-4 h-4" />
              <span>Plan 14K</span>
            </button>
          </nav>

          {/* Zone 3: 1 primary action button area */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenImport}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-400 hover:from-cyan-300 hover:to-blue-300 rounded-lg shadow-md shadow-cyan-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Strava</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row (3 concise buttons) */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-900 py-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('oceanman')}
            className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap shrink-0 ${activeTab === 'oceanman' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
              }`}
          >
            Preparación
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap shrink-0 ${activeTab === 'telemetry' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
              }`}
          >
            Nados ({totalSwimsCount})
          </button>
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap shrink-0 ${activeTab === 'calculator' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
              }`}
          >
            Plan 14K
          </button>
        </div>
      </div>
    </header>
  );
};
