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
import { AddActivityModal } from './components/AddActivityModal.tsx';
import { ActivityDetailModal } from './components/ActivityDetailModal.tsx';
import { SwimActivity } from './types/swim.ts';
import { SAMPLE_STRAVA_CSV_CONTENT } from './data/mockSwimData.ts';
import { calculateOceanmanReadiness, parseStravaCsv } from './utils/swimCalculators.ts';
import { Check, Upload, Archive, RefreshCw, AlertCircle, FileText } from 'lucide-react';

const STORAGE_KEY = 'aquavortex_swim_activities';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTabType>('oceanman');
  const [activities, setActivities] = useState<SwimActivity[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading stored activities', e);
    }
    // Parse real Strava CSV content dynamically (no hardcoded objects)
    return parseStravaCsv(SAMPLE_STRAVA_CSV_CONTENT);
  });

  const [selectedActivity, setSelectedActivity] = useState<SwimActivity | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddSwimOpen, setIsAddSwimOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dataSourceName, setDataSourceName] = useState<string>('Export Strava');

  // Save activities to localStorage whenever they change
  useEffect(() => {
    try {
      if (activities.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
      }
    } catch (e) {
      console.warn('Error saving activities to storage', e);
    }
  }, [activities]);

  // Recalculate readiness reactively whenever activities change - 100% dynamic
  const readiness = useMemo(() => {
    return calculateOceanmanReadiness(activities);
  }, [activities]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleImportActivities = (newActivities: SwimActivity[], sourceName: string) => {
    setActivities(newActivities);
    setDataSourceName(sourceName);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newActivities));
    } catch (e) {
      console.warn(e);
    }
    showToast(`¡${newActivities.length} actividades analizadas desde ${sourceName}!`);
  };

  const handleClearActivities = () => {
    if (window.confirm('¿Deseas restablecer y borrar los datos de natación cargados para importar un nuevo atleta?')) {
      setActivities([]);
      localStorage.removeItem(STORAGE_KEY);
      showToast('Datos de natación restablecidos.');
    }
  };

  const handleAddSwim = (newActivity: SwimActivity) => {
    setActivities(prev => {
      const updated = [newActivity, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    showToast(`Sesión "${newActivity.title}" añadida correctamente.`);
  };

  const totalKm = useMemo(() => {
    return Number((activities.reduce((sum, a) => sum + a.distance, 0) / 1000).toFixed(1));
  }, [activities]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Bar Contract Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenAddSwim={() => setIsAddSwimOpen(true)}
        totalSwimsCount={activities.length}
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
                Datos activos: <strong className="text-white">{activities.length} sesiones de natación ({totalKm} km)</strong> analizadas desde {dataSourceName}.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsImportOpen(true)}
                className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2 cursor-pointer"
              >
                Cambiar archivo Strava
              </button>
              <span className="text-slate-700">·</span>
              <button
                onClick={handleClearActivities}
                className="text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
              >
                Restablecer
              </button>
            </div>
          </div>
        )}

        {/* If no activities are loaded, present clean onboarding dropzone */}
        {activities.length === 0 ? (
          <div className="py-12 px-6 max-w-3xl mx-auto text-center space-y-6 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
              <Upload className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">
                Sube tu export de Strava para comenzar el análisis
              </h2>
              <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                AquaVortex procesa directamente tu archivo <span className="text-cyan-400 font-mono">export.zip</span> o <span className="text-cyan-400 font-mono">activities.csv</span>.
                Filtra únicamente los registros de <strong className="text-white">Activity Type = Swim</strong> y clasifica como aguas abiertas mediante elevación o nombres clave, calculando tus 7 hitos Oceanman.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setIsImportOpen(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Importar archivo Strava (ZIP o CSV)</span>
              </button>
              <button
                onClick={() => {
                  const sampleSwims = parseStravaCsv(SAMPLE_STRAVA_CSV_CONTENT);
                  handleImportActivities(sampleSwims, 'CSV de prueba (10 sesiones reales)');
                }}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Probar con CSV de muestra</span>
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
                  onExploreCourse={() => setActiveTab('calculator')}
                  onExploreReadiness={() => {
                    const el = document.getElementById('readiness-details');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                />
                <div id="readiness-details">
                  <OceanmanReadinessView
                    readiness={readiness}
                    activities={activities}
                    onOpenCalculator={() => setActiveTab('calculator')}
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Telemetría & Sesiones Strava */}
            {activeTab === 'telemetry' && (
              <TelemetryView
                activities={activities}
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
            <span className="font-extrabold text-slate-300">AQUAVORTEX</span>
            <span>· Ultra Swimming Telemetry & Oceanman 14K Intelligence Lab</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Objetivo: 14.000m Lago d'Orta (13 Jun 2027)</span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <button
              onClick={() => setIsImportOpen(true)}
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 cursor-pointer"
            >
              Exportar / Importar Strava ZIP
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

      <AddActivityModal
        isOpen={isAddSwimOpen}
        onClose={() => setIsAddSwimOpen(false)}
        onAddSwim={handleAddSwim}
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
