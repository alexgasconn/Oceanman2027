/**
 * Lago d'Orta 14 km race model: per-kilometre schedule, cut-off margins and the
 * stop time still available at each feeding point.
 */

export const RACE_DISTANCE_M = 14000;
export const RACE_START_MINUTES = 9 * 60 + 30; // 09:30 local start
export const RACE_CUTOFF_SEC = 6 * 3600;

export interface FeedPoint {
  km: number;
  label: string;
  cutoffSec: number;
}

/** Official intermediate cut-offs published for the 14 km course. */
export const FEED_POINTS: FeedPoint[] = [
  { km: 5, label: 'Avituallamiento 1 · Ronco', cutoffSec: 2 * 3600 + 15 * 60 },
  { km: 10, label: 'Avituallamiento 2 · Buccione', cutoffSec: 4 * 3600 + 30 * 60 },
];

export interface RaceConditions {
  /** Extra seconds per 100 m from chop and wind. */
  surfacePenaltySec: number;
  /** Extra distance percentage from sighting and line deviation. */
  navigationPenaltyPct: number;
  /** Seconds per 100 m saved by a wetsuit's buoyancy. */
  wetsuitGainSec: number;
}

export const CALM_CONDITIONS: RaceConditions = {
  surfacePenaltySec: 0,
  navigationPenaltyPct: 3.5,
  wetsuitGainSec: 0,
};

export function formatRaceClock(secondsFromStart: number): string {
  const totalMinutes = (RACE_START_MINUTES + Math.round(secondsFromStart / 60)) % (24 * 60);
  const hour24 = Math.floor(totalMinutes / 60);
  const hour12 = hour24 % 12 || 12;
  const minute = totalMinutes % 60;
  return `${hour12}:${minute < 10 ? '0' : ''}${minute} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

export interface KilometreSplit {
  km: number;
  /** Swim-only seconds for this kilometre. */
  splitSec: number;
  pacePer100mSec: number;
  /** Stop time scheduled at the end of this kilometre. */
  stopSec: number;
  /** Elapsed race seconds after finishing this kilometre and its stop. */
  cumulativeSec: number;
  clockTime: string;
  isFeedPoint: boolean;
  feedLabel?: string;
  /** Seconds left against the cut-off that applies at this point. */
  marginSec?: number;
  cutoffSec?: number;
}

export interface RacePlan {
  /** Pace actually swum once conditions are applied. */
  effectivePaceSec: number;
  /** Distance really covered including navigation deviation. */
  effectiveDistanceM: number;
  swimTimeSec: number;
  totalStopSec: number;
  totalRaceSec: number;
  finishClock: string;
  finishMarginSec: number;
  isWithinCutoff: boolean;
  /** Total stop time available without missing the final cut-off. */
  stopBudgetSec: number;
  splits: KilometreSplit[];
  feedPoints: {
    km: number;
    label: string;
    arrivalSec: number;
    arrivalClock: string;
    cutoffSec: number;
    marginSec: number;
    plannedStopSec: number;
    /** Stop budget still unused once this stop is taken. */
    remainingBudgetSec: number;
    isSafe: boolean;
  }[];
}

export interface RacePlanInput {
  basePacePer100mSec: number;
  conditions?: RaceConditions;
  /** Seconds planned at each feeding point, keyed by kilometre. */
  stopSecByKm?: Record<number, number>;
}

/**
 * Builds the full kilometre-by-kilometre plan. Swim time comes from the pace,
 * stop time is explicit, and every margin is measured against official cut-offs.
 */
export function buildRacePlan({
  basePacePer100mSec,
  conditions = CALM_CONDITIONS,
  stopSecByKm = {},
}: RacePlanInput): RacePlan {
  const effectivePaceSec = Math.max(
    1,
    basePacePer100mSec + conditions.surfacePenaltySec - conditions.wetsuitGainSec,
  );
  const effectiveDistanceM = Math.round(RACE_DISTANCE_M * (1 + conditions.navigationPenaltyPct / 100));
  const metresPerKm = effectiveDistanceM / (RACE_DISTANCE_M / 1000);
  const swimSecPerKm = (metresPerKm / 100) * effectivePaceSec;
  const swimTimeSec = Math.round(swimSecPerKm * (RACE_DISTANCE_M / 1000));

  const splits: KilometreSplit[] = [];
  const feedPoints: RacePlan['feedPoints'] = [];
  let cumulativeSec = 0;
  let totalStopSec = 0;

  for (let km = 1; km <= RACE_DISTANCE_M / 1000; km++) {
    const feedPoint = FEED_POINTS.find(point => point.km === km);
    const stopSec = feedPoint ? Math.max(0, Math.round(stopSecByKm[km] ?? 0)) : 0;
    const splitSec = Math.round(swimSecPerKm);
    cumulativeSec += splitSec;
    const arrivalSec = cumulativeSec;
    cumulativeSec += stopSec;
    totalStopSec += stopSec;

    splits.push({
      km,
      splitSec,
      pacePer100mSec: Number(effectivePaceSec.toFixed(1)),
      stopSec,
      cumulativeSec,
      clockTime: formatRaceClock(cumulativeSec),
      isFeedPoint: Boolean(feedPoint),
      feedLabel: feedPoint?.label,
      marginSec: feedPoint ? feedPoint.cutoffSec - arrivalSec : undefined,
      cutoffSec: feedPoint?.cutoffSec,
    });

    if (feedPoint) {
      feedPoints.push({
        km,
        label: feedPoint.label,
        arrivalSec,
        arrivalClock: formatRaceClock(arrivalSec),
        cutoffSec: feedPoint.cutoffSec,
        marginSec: feedPoint.cutoffSec - arrivalSec,
        plannedStopSec: stopSec,
        remainingBudgetSec: RACE_CUTOFF_SEC - swimTimeSec - totalStopSec,
        isSafe: arrivalSec <= feedPoint.cutoffSec,
      });
    }
  }

  const totalRaceSec = swimTimeSec + totalStopSec;

  return {
    effectivePaceSec: Number(effectivePaceSec.toFixed(1)),
    effectiveDistanceM,
    swimTimeSec,
    totalStopSec,
    totalRaceSec,
    finishClock: formatRaceClock(totalRaceSec),
    finishMarginSec: RACE_CUTOFF_SEC - totalRaceSec,
    isWithinCutoff: totalRaceSec <= RACE_CUTOFF_SEC,
    stopBudgetSec: Math.max(0, RACE_CUTOFF_SEC - swimTimeSec),
    splits,
    feedPoints,
  };
}

/**
 * Splits the available stop budget across the feeding points, keeping a safety
 * reserve so the finish does not land exactly on the cut-off.
 */
export function suggestStopPlan(
  basePacePer100mSec: number,
  conditions: RaceConditions = CALM_CONDITIONS,
  safetyReserveSec = 600,
): Record<number, number> {
  const dryRun = buildRacePlan({ basePacePer100mSec, conditions });
  const usable = Math.max(0, dryRun.stopBudgetSec - safetyReserveSec);
  // Cap each stop so the plan stays realistic even when the budget is large.
  const perStop = Math.min(180, Math.floor(usable / FEED_POINTS.length));
  return FEED_POINTS.reduce<Record<number, number>>((plan, point) => {
    plan[point.km] = perStop;
    return plan;
  }, {});
}
