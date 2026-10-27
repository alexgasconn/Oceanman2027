/**
 * Performance metrics derived strictly from fields the Strava export actually provides:
 * distance, moving time, elapsed time, heart rate, relative effort and water temperature.
 */
import type { SwimActivity } from '../types/swim.ts';

/** Sessions below this distance are warm-ups/technique work and distort endurance fitting. */
export const ENDURANCE_MIN_DISTANCE_M = 1500;
/** Riegel exponents outside this range are not physiologically plausible for swimming. */
export const FATIGUE_EXPONENT_MIN = 1.02;
export const FATIGUE_EXPONENT_MAX = 1.15;

export function quantile(sortedValues: number[], probability: number): number {
  if (sortedValues.length === 0) return 0;
  const position = (sortedValues.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  if (lowerIndex + 1 >= sortedValues.length) return sortedValues[lowerIndex];
  const weight = position - lowerIndex;
  return sortedValues[lowerIndex] + (sortedValues[lowerIndex + 1] - sortedValues[lowerIndex]) * weight;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  return quantile([...values].sort((a, b) => a - b), 0.5);
}

export function hasUsablePace(activity: SwimActivity): boolean {
  return activity.distance > 0 && activity.movingTime > 0 && activity.pacePer100m > 0;
}

/**
 * Flags pace outliers with Tukey fences computed per medium, since pool and open-water
 * pace distributions differ by ~22 s/100 m in this dataset.
 */
export function markPaceOutliers(activities: SwimActivity[]): SwimActivity[] {
  const fencesByType = new Map<SwimActivity['type'], { low: number; high: number }>();

  for (const type of ['pool', 'open_water', 'unknown'] as const) {
    const paces = activities
      .filter(activity => activity.type === type && hasUsablePace(activity))
      .map(activity => activity.pacePer100m)
      .sort((a, b) => a - b);
    if (paces.length < 5) continue;
    const q1 = quantile(paces, 0.25);
    const q3 = quantile(paces, 0.75);
    const iqr = q3 - q1;
    fencesByType.set(type, { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr });
  }

  return activities.map(activity => {
    const fences = fencesByType.get(activity.type);
    if (!fences || !hasUsablePace(activity)) return { ...activity, isPaceOutlier: false };
    const isPaceOutlier = activity.pacePer100m < fences.low || activity.pacePer100m > fences.high;
    return { ...activity, isPaceOutlier };
  });
}

export interface FatigueModel {
  /** Riegel exponent actually fitted from the athlete's sessions. */
  exponentRaw: number;
  /** Exponent used for projection, clamped to a plausible swimming range. */
  exponent: number;
  wasClamped: boolean;
  rSquared: number;
  sampleSize: number;
  longestDistanceM: number;
  logIntercept: number;
}

/**
 * Fits time = a * distance^k on log-log axes (Riegel). Only endurance sessions are used:
 * short sessions are drills and produce k < 1, which would absurdly predict faster long swims.
 */
export function fitFatigueModel(
  activities: SwimActivity[],
  minDistanceM: number = ENDURANCE_MIN_DISTANCE_M,
): FatigueModel | null {
  const points = activities
    .filter(activity => hasUsablePace(activity) && !activity.isPaceOutlier && activity.distance >= minDistanceM)
    .map(activity => ({ x: Math.log(activity.distance), y: Math.log(activity.movingTime) }));
  if (points.length < 5) return null;

  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const varianceX = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (varianceX === 0) return null;

  const exponentRaw = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / varianceX;
  const logIntercept = meanY - exponentRaw * meanX;
  const residual = points.reduce((sum, point) => sum + (point.y - (logIntercept + exponentRaw * point.x)) ** 2, 0);
  const total = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
  const exponent = Math.min(Math.max(exponentRaw, FATIGUE_EXPONENT_MIN), FATIGUE_EXPONENT_MAX);

  return {
    exponentRaw: Number(exponentRaw.toFixed(4)),
    exponent: Number(exponent.toFixed(4)),
    wasClamped: Math.abs(exponent - exponentRaw) > 1e-9,
    rSquared: total === 0 ? 0 : Number((1 - residual / total).toFixed(3)),
    sampleSize: points.length,
    longestDistanceM: Math.max(...activities.filter(a => hasUsablePace(a) && a.distance >= minDistanceM).map(a => a.distance)),
    logIntercept,
  };
}

/** Projects swim-only time for a target distance using the fitted fatigue curve. */
export function projectSwimTimeSec(model: FatigueModel, targetDistanceM: number): number {
  // Anchor on the fitted time at the longest distance with real data, then extrapolate
  // with the plausible exponent so a clamped fit stays consistent with its own anchor.
  const anchorDistance = model.longestDistanceM;
  const anchorTime = Math.exp(model.logIntercept) * anchorDistance ** model.exponentRaw;
  return Math.round(anchorTime * (targetDistanceM / anchorDistance) ** model.exponent);
}

export interface PaceProjection {
  swimTimeSec: number;
  pacePer100mSec: number;
  /** How far beyond the longest recorded swim the projection reaches. */
  extrapolationFactor: number;
  model: FatigueModel;
}

export function projectRacePace(
  activities: SwimActivity[],
  targetDistanceM: number,
  openWaterPenaltySec: number = 0,
): PaceProjection | null {
  const model = fitFatigueModel(activities);
  if (!model) return null;
  const swimTimeSec = projectSwimTimeSec(model, targetDistanceM);
  const basePace = swimTimeSec / (targetDistanceM / 100);
  const pacePer100mSec = basePace + openWaterPenaltySec;
  return {
    swimTimeSec: Math.round(pacePer100mSec * (targetDistanceM / 100)),
    pacePer100mSec: Number(pacePer100mSec.toFixed(1)),
    extrapolationFactor: Number((targetDistanceM / model.longestDistanceM).toFixed(2)),
    model,
  };
}

/**
 * Picks the soundest basis for an open-water projection: the fatigue curve is fitted on
 * pool sessions, whose distance is exact, and the measured pool-to-open-water penalty is
 * then applied once. Falls back to all sessions when pool data is insufficient.
 */
export function buildRaceProjection(
  activities: SwimActivity[],
  targetDistanceM: number,
): (PaceProjection & { basis: 'pool' | 'all'; openWaterPenaltySec: number }) | null {
  const poolEndurance = activities.filter(
    activity => activity.type === 'pool' && hasUsablePace(activity) && !activity.isPaceOutlier && activity.distance >= ENDURANCE_MIN_DISTANCE_M,
  );
  const usePool = poolEndurance.length >= 5;
  const penalty = usePool ? getOpenWaterPenaltySec(activities) ?? 0 : 0;
  const projection = projectRacePace(usePool ? poolEndurance : activities, targetDistanceM, penalty);
  if (!projection) return null;
  return { ...projection, basis: usePool ? 'pool' : 'all', openWaterPenaltySec: penalty };
}

/**
 * Measured pace penalty of open water versus pool, from the athlete's own medians.
 * Returns null when either medium lacks enough clean sessions.
 */
export function getOpenWaterPenaltySec(activities: SwimActivity[]): number | null {
  const usable = activities.filter(activity => hasUsablePace(activity) && !activity.isPaceOutlier);
  const poolPaces = usable.filter(a => a.type === 'pool').map(a => a.pacePer100m);
  const openPaces = usable.filter(a => a.type === 'open_water').map(a => a.pacePer100m);
  if (poolPaces.length < 5 || openPaces.length < 3) return null;
  const poolMedian = median(poolPaces);
  const openMedian = median(openPaces);
  if (poolMedian === null || openMedian === null) return null;
  return Number((openMedian - poolMedian).toFixed(1));
}

/** Aerobic efficiency: metres per heartbeat x100. Higher means more speed for the same cost. */
export function getEfficiencyFactor(activity: SwimActivity): number | null {
  if (!hasUsablePace(activity) || !activity.avgHeartRate || activity.avgHeartRate <= 0) return null;
  const speedMps = activity.distance / activity.movingTime;
  return Number((speedMps / activity.avgHeartRate * 100).toFixed(3));
}

export interface EfficiencyTrend {
  recentAverage: number;
  previousAverage: number;
  changePct: number;
  recentCount: number;
  previousCount: number;
}

/** Compares aerobic efficiency of the last N sessions against the preceding N. */
export function getEfficiencyTrend(activities: SwimActivity[], windowSize = 10): EfficiencyTrend | null {
  const series = activities
    .filter(activity => getEfficiencyFactor(activity) !== null && !activity.isPaceOutlier)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(activity => getEfficiencyFactor(activity)!);
  if (series.length < windowSize * 2) return null;

  const recent = series.slice(-windowSize);
  const previous = series.slice(-windowSize * 2, -windowSize);
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const recentAverage = mean(recent);
  const previousAverage = mean(previous);

  return {
    recentAverage: Number(recentAverage.toFixed(3)),
    previousAverage: Number(previousAverage.toFixed(3)),
    changePct: Number(((recentAverage / previousAverage - 1) * 100).toFixed(1)),
    recentCount: recent.length,
    previousCount: previous.length,
  };
}

/**
 * Share of swimming time inside long sessions, which is what separates a continuous
 * crossing from an interval workout. Race time is elapsed, not moving.
 */
export function getLongSwimContinuity(activities: SwimActivity[], minDistanceM = 2000): {
  medianRatio: number;
  sampleSize: number;
} | null {
  const ratios = activities
    .filter(activity => activity.distance >= minDistanceM && activity.movingRatio !== undefined)
    .map(activity => activity.movingRatio!);
  if (ratios.length === 0) return null;
  const value = median(ratios);
  if (value === null) return null;
  return { medianRatio: Number(value.toFixed(1)), sampleSize: ratios.length };
}
