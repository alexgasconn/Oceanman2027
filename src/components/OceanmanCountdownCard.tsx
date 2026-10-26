import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Trophy, ArrowRight } from 'lucide-react';
import { OceanmanReadiness } from '../types/swim.ts';
import { OCEANMAN_DATE } from '../utils/swimCalculators.ts';

interface OceanmanCountdownCardProps {
  readiness: OceanmanReadiness;
  onExploreReadiness: () => void;
}

export const OceanmanCountdownCard: React.FC<OceanmanCountdownCardProps> = ({
  readiness,
  onExploreReadiness,
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const difference = OCEANMAN_DATE.getTime() - now;
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };
    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40';
    if (score >= 65) return 'text-cyan-400 border-cyan-500/40 bg-cyan-950/40';
    if (score >= 50) return 'text-amber-400 border-amber-500/40 bg-amber-950/40';
    return 'text-rose-400 border-rose-500/40 bg-rose-950/40';
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
      {/* Background Image with Measured Scrim */}
      <div className="absolute inset-0 z-0">
        <img
          src="/src/assets/images/oceanman_orta_lake_1792875384639.jpg"
          alt="Lago d'Orta en Italia, sede del Oceanman 14K"
          className="w-full h-full object-cover object-center filter brightness-60 contrast-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/40" />
        <div className="absolute inset-0 bg-radial from-transparent via-slate-950/50 to-slate-950/90" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col justify-between min-h-[460px]">
        {/* Top Kicker and Location Tag */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-cyan-300 uppercase">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Objetivo 2027</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700">
            <MapPin className="w-3.5 h-3.5 text-rose-400" />
            <span>Lago d'Orta, Italia</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-white">13 de Junio de 2027</span>
          </div>
        </div>

        {/* Hero Title & Readiness Spotlight */}
        <div className="my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-7">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight text-balance">
              OCEANMAN <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">14K</span>
            </h1>
            <p className="mt-3 text-sm text-slate-300">14 km · corte: 6 h</p>
            <div className="mt-7 flex items-end gap-5 sm:gap-7">
              <div className="flex items-baseline gap-2">
                <span className="text-7xl sm:text-8xl font-black font-mono leading-none text-white tabular-nums">
                  {timeLeft.days}
                </span>
                <span className="text-base text-cyan-300">días</span>
              </div>
              <div className="grid grid-cols-3 gap-3 pb-1 text-center font-mono tabular-nums">
                <div>
                  <span className="block text-xl font-bold text-cyan-300">{String(timeLeft.hours).padStart(2, '0')}</span>
                  <span className="text-[10px] text-slate-400">h</span>
                </div>
                <div>
                  <span className="block text-xl font-bold text-slate-200">{String(timeLeft.minutes).padStart(2, '0')}</span>
                  <span className="text-[10px] text-slate-400">min</span>
                </div>
                <div>
                  <span className="block text-xl font-bold text-slate-400">{String(timeLeft.seconds).padStart(2, '0')}</span>
                  <span className="text-[10px] text-slate-400">s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Large Readiness Score Gauge */}
          <div className="lg:col-span-5 bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
                PREPARACIÓN
              </span>
              <span className={`px-2.5 py-0.5 text-xs font-bold rounded border ${getScoreColor(readiness.overallScore)}`}>
                {readiness.statusLevel}
              </span>
            </div>

            <div className="flex items-baseline justify-between mb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tabular-nums font-mono text-white">
                  {readiness.overallScore}%
                </span>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Tiempo Estimado</div>
                <div className="text-lg font-bold font-mono text-cyan-400 tabular-nums">
                  {readiness.estimatedFinishTimeString}
                </div>
              </div>
            </div>

            {/* Segmented Readiness Progress Bar */}
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-4 flex">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(5, readiness.overallScore))}%` }}
              />
            </div>

            {/* Sub-scores breakdown */}
            <div className="grid grid-cols-4 gap-2 text-center pt-2 border-t border-slate-800/80 text-xs">
              <div>
                <span className="block text-slate-400 text-[10px]">Volumen</span>
                <span className="font-mono font-bold text-slate-200 tabular-nums">
                  {readiness.checks.find(c => c.category === 'volume')?.score || 0}%
                </span>
              </div>
              <div>
                <span className="block text-slate-400 text-[10px]">Tirada Max</span>
                <span className="font-mono font-bold text-slate-200 tabular-nums">
                  {readiness.checks.find(c => c.category === 'endurance')?.score || 0}%
                </span>
              </div>
              <div>
                <span className="block text-slate-400 text-[10px]">Aguas Ab.</span>
                <span className="font-mono font-bold text-slate-200 tabular-nums">
                  {readiness.checks.find(c => c.category === 'open_water')?.score || 0}%
                </span>
              </div>
              <div>
                <span className="block text-slate-400 text-[10px]">Eficiencia</span>
                <span className="font-mono font-bold text-slate-200 tabular-nums">
                  {readiness.checks.find(c => c.category === 'efficiency')?.score || 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Strip: Live Countdown Clock & Actions */}
        <div className="pt-6 border-t border-slate-800/80 flex justify-end">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onExploreReadiness}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              <span>Ver preparación</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
