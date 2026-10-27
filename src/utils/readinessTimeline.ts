/**
 * Readiness percentage resampled over time, so progress can be read daily,
 * weekly or monthly from the same check engine.
 */
import type { ReadinessCheckItem, SwimActivity } from '../types/swim.ts';
import { evaluateReadinessChecks } from './swimCalculators.ts';

export type ReadinessGranularity = 'daily' | 'weekly' | 'monthly';

export interface ReadinessTimelinePoint {
  periodKey: string;
  label: string;
  readinessPct: number;
  sessionsToDate: number;
  checkScores: Record<string, number>;
}

function toLocalDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function startOfWeekKey(date: Date): string {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return formatDayKey(monday);
}

function formatDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function periodKeyFor(date: Date, granularity: ReadinessGranularity): string {
  if (granularity === 'daily') return formatDayKey(date);
  if (granularity === 'weekly') return startOfWeekKey(date);
  return formatDayKey(date).slice(0, 7);
}

function labelFor(periodKey: string, granularity: ReadinessGranularity): string {
  if (granularity === 'monthly') {
    const [year, month] = periodKey.split('-');
    return toLocalDate(`${periodKey}-01`).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
      || `${month}/${year}`;
  }
  const date = toLocalDate(periodKey);
  return granularity === 'weekly'
    ? `Sem ${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
    : date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/**
 * Recomputes the readiness index at the end of every period, using only the
 * sessions available up to that date so the series reflects real progression.
 */
export function buildReadinessTimeline(
  activities: SwimActivity[],
  granularity: ReadinessGranularity = 'weekly',
  maxPoints = 26,
): ReadinessTimelinePoint[] {
  const dated = activities
    .filter(activity => activity.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (dated.length === 0) return [];

  const periodKeys: string[] = [];
  const seen = new Set<string>();
  for (const activity of dated) {
    const key = periodKeyFor(toLocalDate(activity.date), granularity);
    if (seen.has(key)) continue;
    seen.add(key);
    periodKeys.push(key);
  }

  const selected = periodKeys.slice(-maxPoints);

  return selected.map(periodKey => {
    const cutoff = granularity === 'monthly' ? `${periodKey}-31` : periodKey;
    const upToDate = dated.filter(activity => activity.date.slice(0, 10) <= cutoff);
    const reference = toLocalDate(granularity === 'monthly' ? `${periodKey}-28` : periodKey);
    const { checks, overallScore } = evaluateReadinessChecks(upToDate, reference);

    return {
      periodKey,
      label: labelFor(periodKey, granularity),
      readinessPct: overallScore,
      sessionsToDate: upToDate.length,
      checkScores: Object.fromEntries(checks.map((check: ReadinessCheckItem) => [check.id, check.score])),
    };
  });
}
