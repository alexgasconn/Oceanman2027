/**
 * Types for Oceanman swim readiness and telemetry.
 */

export type SwimActivityType = 'pool' | 'open_water' | 'unknown';

export interface SwimSplit {
  km: number;
  paceSec: number;
  cadenceSpm?: number;
  heartRate?: number;
  swolf?: number;
  strokesPerLength?: number;
}

export interface SwimActivity {
  id: string;
  date: string; // ISO format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  startedAt?: string; // Local start date/time for weekday-hour analytics
  title: string;
  type: SwimActivityType; // 'pool' | 'open_water'
  distance: number; // in meters
  elapsedTime: number; // in seconds
  movingTime: number; // in seconds
  hasRecordedMovingTime?: boolean;
  hasRecordedElapsedTime?: boolean;
  movingRatio?: number; // (movingTime / elapsedTime) * 100
  elevationHigh?: number; // meters from Strava (non-zero indicates open water)
  elevationLow?: number; // meters from Strava
  isOpenWaterDetected?: boolean;
  hasPoolLength?: boolean; // Strava recorded a pool length (pool swims only)
  openWaterTrigger?: string;
  pacePer100m: number; // in seconds per 100m strictly using movingTime
  averageCadence?: number; // Exported cadence value; source CSV does not specify its unit
  hasRecordedCadence?: boolean;
  totalStrokes?: number;
  hasRecordedTotalStrokes?: boolean;
  totalCycles?: number;
  swolf?: number;
  hasRecordedSwolf?: boolean;
  strokesPerLength?: number;
  hasRecordedSpl?: boolean;
  hasRecordedDps?: boolean;
  dps?: number; // Distance per stroke cycle in meters
  strokeIndex?: number; // Speed * DPS (m²/s)
  avgHeartRate?: number;
  maxHeartRate?: number;
  relativeEffort?: number;
  calories?: number;
  hasRecordedCalories?: boolean;
  /** Speed (m/s) per heartbeat x100; aerobic efficiency, only when HR exists. */
  efficiencyFactor?: number;
  isPaceOutlier?: boolean;
  poolLength?: number | null;
  poolDistanceCorrection?: 'historical-20m';
  waterTemp?: number; // °C
  hasRecordedWaterTemp?: boolean;
  hasWetsuit?: boolean;
  notes?: string;
  source: 'strava_zip' | 'strava_csv' | 'garmin_fit' | 'gpx' | 'tcx';
  splits?: SwimSplit[];
}

export interface OceanmanMilestone {
  km: number;
  label: string;
  description: string;
  officialCutOffTime?: string; // e.g. "2h 15min"
  officialCutOffClock?: string; // e.g. "11:45 AM"
  estimatedPassingTime: string;
  estimatedClockTime?: string;
  cutOffMarginMinutes?: number;
  nutritionAdvice: string;
  isFeedStation?: boolean;
  isCutOffPoint?: boolean;
}

export interface CheckMilestone {
  level: string;
  label: string;
  target: string;
  isCompleted: boolean;
  timeframe?: string;
}

export interface OrtaEnvironmentalCondition {
  id: string;
  title: string;
  value: string;
  subtext: string;
  impact: string;
  recommendation: string;
  category: 'water_temp' | 'air_temp' | 'wind' | 'chop' | 'clarity' | 'solar';
}

export interface ReadinessCheckItem {
  id: string;
  checkNumber: number; // 1 to 6
  category: 'endurance' | 'volume' | 'open_water' | 'efficiency' | 'pacing' | 'nutrition';
  title: string;
  shortTitle?: string;
  description: string;
  baseline: string; // Dynamically computed from swimmer's activities!
  milestones: CheckMilestone[];
  milestone1?: CheckMilestone;
  milestone2?: CheckMilestone;
  currentValue: number;
  targetValue: number;
  currentValueFormatted: string;
  targetValueFormatted: string;
  unit: string;
  status: 'passed' | 'warning' | 'pending';
  isDataAvailable?: boolean;
  isScored?: boolean;
  score: number; // 0 - 100
  weight: number; // % contribution to overall score
  details: string;
  summary?: string;
}

export interface HistoricalReadinessPoint {
  date: string; // YYYY-MM-DD
  label: string;
  readinessScore: number; // 0 - 100
  volumeLast30DaysKm: number;
  volumeLast14DaysKm: number;
  longestSwimKm: number;
  openWaterSessionsTotal: number;
  openWaterKmTotal: number;
  avgPaceSec: number;
  checkScores?: Record<string, number>;
  milestoneUnlocked?: string;
}

export interface MandatoryEquipmentCheck {
  id: string;
  name: string;
  officialRule: string;
  isMandatory: boolean;
  prohibitedDetails?: string;
}

export interface OceanmanReadiness {
  overallScore: number; // 0 - 100
  statusLevel: 'Elite Prepared' | 'Ready to Conquer' | 'Solid Progress' | 'High Endurance Gap';

  // Specific Window Volumes
  volumeLast14DaysMeters: number;
  volumeLast30DaysMeters: number;
  volumeLast60DaysMeters: number;
  volumeLast90DaysMeters: number;

  // Checks and criteria breakdown
  checks: ReadinessCheckItem[];
  passedChecksCount: number;
  totalChecksCount: number;

  longestSwimMeters: number;
  longestDurationSec: number;
  openWaterSessionsCount: number;
  openWaterTotalMeters: number;
  coldWaterSessionsCount: number; // ≤ 20°C

  avgWeeklyVolumeMeters: number;
  targetWeeklyVolumeMeters: number;

  estimatedFinishTimeSec: number;
  estimatedFinishTimeString: string;
  estimatedPacePer100mSec: number;
  estimatedPaceString: string;
  timeRangeMin: string;
  timeRangeMax: string;

  // Official Cut-off safety analysis (Lago d'Orta 6h max limit)
  officialLimitSeconds: number; // 6h = 21600s
  cutOffMarginKm5Min: number;
  cutOffMarginKm10Min: number;
  cutOffMarginFinishMin: number;
  isWithinOfficialCutOff: boolean;

  daysRemaining: number;
  weeksRemaining: number;

  nutritionPlan: {
    carbsPerHourGrams: number;
    hydrationMlPerHour: number;
    sodiumMgPerHour: number;
    totalCarbsGrams: number;
    feedingIntervalMinutes: number;
    gelCount: number;
    feedingsCount: number;
    officialFloatingStationsCount: number; // 2 official stations in 14K
  };

  mandatoryEquipment: MandatoryEquipmentCheck[];
  wetsuitRegulation: {
    lakeExpectedTempC: number;
    ruleStatus: string;
    details: string;
  };
  worldSlotEligibility: string;

  strengths: string[];
  recommendations: string[];
  milestones: OceanmanMilestone[];
  historicalEvolution: HistoricalReadinessPoint[];
}

export interface WeeklyMileage {
  weekKey: string;
  label: string;
  distanceMeters: number;
  distanceKm: number;
  poolDistanceKm: number;
  openWaterDistanceKm: number;
  sessionsCount: number;
  avgPaceSec: number;
  avgCadence: number;
}
