import type { SwimActivity } from '../types/swim.ts';
import { getTrainingWorkWeek } from './trainingWeeks.ts';

export interface HistogramBin {
  start: number;
  end: number;
  count: number;
}

export interface WeeklyVolumePoint {
  weekStart: string;
  weeklyKm: number;
  rollingMeanKm: number;
}

export interface PoolSwolfSummary {
  poolLength: number;
  count: number;
  averageSwolf: number;
}

export interface SwolfEfficiencyStats {
  poolSummaries: PoolSwolfSummary[];
  measuredSessions: number;
  average25mEquivalent: number | null;
  longSwimDriftPct: number | null;
  shortSwimCount: number;
  longSwimCount: number;
}

export function createHistogram(values: number[], binCount = 8): HistogramBin[] {
  if (values.length === 0) return [];

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.1, 0.5);
    min -= padding;
    max += padding;
  }

  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: min + index * width,
    end: min + (index + 1) * width,
    count: 0,
  }));

  values.forEach(value => {
    const index = Math.min(binCount - 1, Math.floor((value - min) / width));
    bins[index].count += 1;
  });

  return bins;
}

export function getSwolfEfficiencyStats(activities: SwimActivity[]): SwolfEfficiencyStats {
  const measuredPoolSwims = activities.filter(activity =>
    activity.type === 'pool' &&
    activity.hasRecordedCadence === true &&
    Number.isFinite(activity.swolf) && (activity.swolf ?? 0) > 0 &&
    Number.isFinite(activity.poolLength) && (activity.poolLength ?? 0) > 0
  );
  const byLength = new Map<number, SwimActivity[]>();
  measuredPoolSwims.forEach(activity => {
    const length = activity.poolLength!;
    const sessions = byLength.get(length) || [];
    sessions.push(activity);
    byLength.set(length, sessions);
  });

  const poolSummaries = [...byLength.entries()]
    .map(([poolLength, sessions]) => ({
      poolLength,
      count: sessions.length,
      averageSwolf: sessions.reduce((sum, session) => sum + session.swolf!, 0) / sessions.length,
    }))
    .sort((a, b) => a.poolLength - b.poolLength);

  const normalizedScores = measuredPoolSwims.map(activity => activity.swolf! * 25 / activity.poolLength!);
  const average25mEquivalent = normalizedScores.length > 0
    ? normalizedScores.reduce((sum, score) => sum + score, 0) / normalizedScores.length
    : null;

  const comparableLength = [...byLength.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .find(([, sessions]) =>
      sessions.filter(session => session.distance < 2000).length >= 2 &&
      sessions.filter(session => session.distance >= 2000).length >= 2
    );
  const shortSwims = comparableLength?.[1].filter(session => session.distance < 2000) || [];
  const longSwims = comparableLength?.[1].filter(session => session.distance >= 2000) || [];
  const averageSwolf = (sessions: SwimActivity[]) =>
    sessions.reduce((sum, session) => sum + session.swolf!, 0) / sessions.length;
  const longSwimDriftPct = shortSwims.length > 0 && longSwims.length > 0
    ? (averageSwolf(longSwims) / averageSwolf(shortSwims) - 1) * 100
    : null;

  return {
    poolSummaries,
    measuredSessions: measuredPoolSwims.length,
    average25mEquivalent,
    longSwimDriftPct,
    shortSwimCount: shortSwims.length,
    longSwimCount: longSwims.length,
  };
}

export function getWeekdayHourKilometers(activities: SwimActivity[]): number[][] {
  const totals = Array.from({ length: 7 }, () => Array<number>(24).fill(0));

  activities.forEach(activity => {
    if (!activity.startedAt || !Number.isFinite(activity.distance) || activity.distance <= 0) return;
    const startedAt = new Date(activity.startedAt);
    if (Number.isNaN(startedAt.getTime())) return;
    const weekday = (startedAt.getDay() + 6) % 7;
    totals[weekday][startedAt.getHours()] += activity.distance / 1000;
  });

  return totals;
}

export function getWeeklyRollingMean(activities: SwimActivity[], windowWeeks = 4): WeeklyVolumePoint[] {
  const weeklyTotals = new Map<string, number>();

  activities.forEach(activity => {
    const workWeek = getTrainingWorkWeek(activity.date);
    if (!workWeek || !Number.isFinite(activity.distance) || activity.distance < 0) return;
    weeklyTotals.set(workWeek.key, (weeklyTotals.get(workWeek.key) || 0) + activity.distance / 1000);
  });

  const weekKeys = [...weeklyTotals.keys()].sort();
  if (weekKeys.length === 0) return [];

  const firstWeek = new Date(`${weekKeys[0]}T12:00:00`);
  const lastWeek = new Date(`${weekKeys[weekKeys.length - 1]}T12:00:00`);
  const points: WeeklyVolumePoint[] = [];

  for (const week = new Date(firstWeek); week <= lastWeek; week.setDate(week.getDate() + 7)) {
    const weekStart = `${week.getFullYear()}-${String(week.getMonth() + 1).padStart(2, '0')}-${String(week.getDate()).padStart(2, '0')}`;
    const weeklyKm = weeklyTotals.get(weekStart) || 0;
    const recentVolumes = [...points.slice(-(windowWeeks - 1)).map(point => point.weeklyKm), weeklyKm];
    const rollingMeanKm = recentVolumes.reduce((sum, volume) => sum + volume, 0) / recentVolumes.length;
    points.push({
      weekStart,
      weeklyKm: Number(weeklyKm.toFixed(2)),
      rollingMeanKm: Number(rollingMeanKm.toFixed(2)),
    });
  }

  return points;
}