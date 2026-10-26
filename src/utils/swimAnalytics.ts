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