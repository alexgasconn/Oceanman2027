/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Header, ActiveTabType } from './components/Header.tsx';
import { OceanmanCountdownCard } from './components/OceanmanCountdownCard.tsx';
import { OceanmanReadinessView } from './components/OceanmanReadinessView.tsx';
import { TelemetryView } from './components/TelemetryView.tsx';
import { RaceCalculatorView } from './components/RaceCalculatorView.tsx';
import { StravaImportModal } from './components/StravaImportModal.tsx';
import { ActivityDetailModal } from './components/ActivityDetailModal.tsx';
import { SwimActivity } from './types/swim.ts';
import { calculateOceanmanReadiness, findPaceOutlierIds, parseStravaCsv } from './utils/swimCalculators.ts';
import { Check, Upload } from 'lucide-react';

const STORAGE_KEY = 'aquavortex_swim_activities';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTabType>('oceanman');
  const [activities, setActivities] = useState<SwimActivity[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading stored activities', e);
    }
    return [];
  });
  const [dataInitialized, setDataInitialized] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  });

  const [selectedActivity, setSelectedActivity] = useState<SwimActivity | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [excludePaceOutliers, setExcludePaceOutliers] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dataSourceName, setDataSourceName] = useState<string>('Export Strava');

  useEffect(() => {
    if (dataInitialized) return;
    let isCurrent = true;

    fetch('/data/activities.csv')
      .then(response => {
        if (!response.ok) throw new Error('No root activities.csv found');
        return response.text();
      })
      .then(csv => {
        if (!isCurrent || localStorage.getItem(STORAGE_KEY) !== null) return;
        const imported = parseStravaCsv(csv);
        if (imported.length > 0) {
          setActivities(imported);
          setDataSourceName('data/activities.csv');
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (isCurrent) setDataInitialized(true);
      });

    return () => {
      isCurrent = false;
    };
  }, [dataInitialized]);

  useEffect(() => {
    if (!dataInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    } catch (e) {
      console.warn('Error saving activities to storage', e);
    }
  }, [activities, dataInitialized]);

  const paceOutlierIds = useMemo(() => findPaceOutlierIds(activities), [activities]);
  const analysisActivities = useMemo(
    () => excludePaceOutliers
      ? activities.filter(activity => !paceOutlierIds.includes(activity.id))
      : activities,
    [activities, excludePaceOutliers, paceOutlierIds]
  );

  // Recalculate readiness reactively whenever activities change - 100% dynamic
  const readiness = useMemo(() => {
    return calculateOceanmanReadiness(analysisActivities);
  }, [analysisActivities]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleImportActivities = (newActivities: SwimActivity[], sourceName: string) => {
    setActivities(newActivities);
    setDataInitialized(true);
    setDataSourceName(sourceName);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newActivities));
    } catch (e) {
      console.warn(e);
    }
    showToast(`¡${newActivities.length} actividades analizadas desde ${sourceName}!`);
  };

  const handleClearActivities = () => {
    if (window.confirm('¿Quitar todas las actividades cargadas?')) {
      setActivities([]);
      setDataInitialized(true);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      showToast('Datos de natación restablecidos.');
    }
  };

  const totalKm = useMemo(() => {
    return Number((analysisActivities.reduce((sum, activity) => sum + activity.distance, 0) / 1000).toFixed(1));
  }, [analysisActivities]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Bar Contract Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenImport={() => setIsImportOpen(true)}
        totalSwimsCount={analysisActivities.length}
        totalKm={totalKm}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Subtle Athlete & Dataset Source Status Strip */}
        {activities.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/60 border border-slate-800/80 rounded-xl text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
              <span>
                <strong className="text-white">{analysisActivities.length} nados · {totalKm} km</strong> · {dataSourceName}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {paceOutlierIds.length > 0 && (
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={excludePaceOutliers}
                    onChange={(event) => setExcludePaceOutliers(event.target.checked)}
                    className="accent-cyan-400"
                  />
                  <span>Excluir {paceOutlierIds.length} ritmos extremos</span>
                </label>
              )}
              <button
                onClick={() => setIsImportOpen(true)}
                className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
              >
                Importar
              </button>
              <button
                onClick={handleClearActivities}
                className="text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
              >
                Quitar
              </button>
            </div>
          </div>
        )}

        {/* If no activities are loaded, present clean onboarding dropzone */}
        {analysisActivities.length === 0 ? (
          <div className="py-12 px-6 max-w-3xl mx-auto text-center space-y-6 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
              <Upload className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">
                Preparación para Oceanman
              </h2>
              <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                Importa tu export de Strava o coloca <span className="text-cyan-400 font-mono">data/activities.csv</span> en la raíz del proyecto.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setIsImportOpen(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Importar Strava o CSV</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab 1: Oceanman 14K Readiness & Countdown */}
            {activeTab === 'oceanman' && (
              <div className="space-y-8">
                <OceanmanCountdownCard
                  readiness={readiness}
                  onExploreReadiness={() => {
                    const el = document.getElementById('readiness-details');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                />
                <div id="readiness-details">
                  <OceanmanReadinessView
                    readiness={readiness}
                    activities={analysisActivities}
                    onOpenCalculator={() => setActiveTab('calculator')}
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Telemetría & Sesiones Strava */}
            {activeTab === 'telemetry' && (
              <TelemetryView
                activities={analysisActivities}
                onSelectActivity={(act) => setSelectedActivity(act)}
                onOpenImport={() => setIsImportOpen(true)}
              />
            )}

            {/* Tab 3: Estrategia Lago d'Orta 14K */}
            {activeTab === 'calculator' && (
              <RaceCalculatorView readiness={readiness} />
            )}
          </>
        )}
      </main>

      {/* Clean Domain Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-300">OCEANMAN</span>
            <span>· Lago d'Orta 14K</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>13 Jun 2027</span>
            <button
              onClick={() => setIsImportOpen(true)}
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 cursor-pointer"
            >
              Importar actividades
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <StravaImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportActivities={handleImportActivities}
      />

      <ActivityDetailModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-cyan-950 border border-cyan-500/50 rounded-xl text-cyan-200 text-xs shadow-2xl animate-in slide-in-from-bottom duration-300">
          <Check className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
