/**
 * Pure calculation utilities for Oceanman swim readiness.
 */
import {
  OceanmanMilestone,
  OceanmanReadiness,
  ReadinessCheckItem,
  HistoricalReadinessPoint,
  SwimActivity,
  WeeklyMileage,
  OrtaEnvironmentalCondition
} from '../types/swim.ts';
import { getCalendarWeek, getRecentCompletedTrainingWeeks, getTrainingWorkWeek } from './trainingWeeks.ts';
import {
  buildRaceProjection,
  getEfficiencyTrend,
  getLongSwimContinuity,
  getOpenWaterPenaltySec,
  markPaceOutliers,
} from './swimPerformance.ts';
function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let insideQuotes = false;
  const text = csvText.replace(/^\uFEFF/, '');

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (insideQuotes && text[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === ',' && !insideQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !insideQuotes) {
      row.push(field.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
      if (character === '\r' && text[index + 1] === '\n') index++;
    } else {
      field += character;
    }
  }

  row.push(field.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

export const OCEANMAN_DATE = new Date('2027-06-13T09:30:00Z');
export const OCEANMAN_DISTANCE_METERS = 14000;
export const OFFICIAL_CUTOFF_TOTAL_SEC = 6 * 3600;
export const RECOMMENDED_WEEKLY_VOLUME_METERS = 20000;
export const RECOMMENDED_LONGEST_SWIM_METERS = 10000;

export function formatPace(secondsPer100m: number): string {
  if (!secondsPer100m || isNaN(secondsPer100m) || secondsPer100m <= 0) return '--:--';
  const mins = Math.floor(secondsPer100m / 60);
  const secs = Math.round(secondsPer100m % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}/100m`;
}

export function findPaceOutlierIds(activities: SwimActivity[]): string[] {
  const medianOf = (values: number[]) => {
    const middle = Math.floor(values.length / 2);
    return values.length % 2
      ? values[middle]
      : (values[middle - 1] + values[middle]) / 2;
  };
  const groups = new Map<SwimActivity['type'], SwimActivity[]>();
  activities.forEach(activity => {
    const group = groups.get(activity.type) || [];
    group.push(activity);
    groups.set(activity.type, group);
  });

  return Array.from(groups.values()).flatMap(group => {
    const paces = group
      .filter(activity => Number.isFinite(activity.pacePer100m) && activity.pacePer100m > 0)
      .map(activity => ({ id: activity.id, pace: activity.pacePer100m }))
      .sort((a, b) => a.pace - b.pace);
    if (paces.length < 5) return [];

    const values = paces.map(item => item.pace);
    const median = medianOf(values);
    const mad = medianOf(values.map(value => Math.abs(value - median)).sort((a, b) => a - b));
    const lowerHalf = values.slice(0, Math.floor(values.length / 2));
    const upperHalf = values.slice(Math.ceil(values.length / 2));
    const interquartileRange = medianOf(upperHalf) - medianOf(lowerHalf);

    return paces
      .filter(({ pace }) => {
        if (mad > 0) return 0.6745 * Math.abs(pace - median) / mad > 3.5;
        if (interquartileRange > 0) {
          return pace < median - 3 * interquartileRange || pace > median + 3 * interquartileRange;
        }
        return Math.abs(pace - median) > median * 0.5;
      })
      .map(item => item.id);
  });
}

/**
 * Format total seconds into human duration "Xh Ym Zs" or "Ym Zs"
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0m 00s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins < 10 ? '0' : ''}${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }
  return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
}

/**
 * Format distance nicely
 */
export function formatDistance(meters: number, precision: 'meters' | 'km' | 'auto' = 'auto'): string {
  if (!meters || isNaN(meters)) return '0 m';
  if (precision === 'km' || (precision === 'auto' && meters >= 5000)) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  const formatted = Math.round(meters).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted} m`;
}

/** Open water if elevation varies significantly, or GPS elevation exists without a recorded pool length. */
export function detectOpenWater(elevationHigh: number, elevationLow: number, hasPoolLength: boolean | undefined): boolean {
  if (hasPoolLength === true) return false;
  if (elevationHigh - elevationLow >= 1.5) return true;
  return hasPoolLength === false && (elevationHigh !== 0 || elevationLow !== 0);
}

export function recalculateSwimMetrics(activity: SwimActivity): SwimActivity {
  const movingTime = activity.hasRecordedMovingTime ? activity.movingTime : 0;
  const elapsedTime = activity.hasRecordedElapsedTime ? activity.elapsedTime : 0;
  const elevationHigh = activity.elevationHigh ?? 0;
  const elevationLow = activity.elevationLow ?? 0;
  const type = activity.hasPoolLength && activity.poolLength && activity.poolLength > 0
    ? 'pool'
    : detectOpenWater(elevationHigh, elevationLow, activity.hasPoolLength)
      ? 'open_water'
      : 'pool';
  const isHistoricalPool = type === 'pool' && activity.date.slice(0, 10) < '2025-03-25' && activity.date !== '';
  const needsDistanceCorrection = isHistoricalPool && !activity.poolDistanceCorrection &&
    (activity.poolLength == null || activity.poolLength === 25);
  const distance = needsDistanceCorrection ? Math.round(activity.distance * 20 / 25) : activity.distance;
  const poolDistanceCorrection = needsDistanceCorrection ? 'historical-20m' : activity.poolDistanceCorrection;
  const poolLength = type === 'pool'
    ? poolDistanceCorrection === 'historical-20m' ? 20 : activity.poolLength ?? null
    : null;
  const pacePer100m = distance > 0 && movingTime > 0
    ? movingTime / distance * 100
    : 0;
  const movingRatio = elapsedTime > 0 && movingTime > 0
    ? Number((movingTime / elapsedTime * 100).toFixed(1))
    : undefined;
  const averageCadence = activity.hasRecordedCadence ? activity.averageCadence : undefined;

  return {
    ...activity,
    type,
    distance,
    movingTime,
    elapsedTime,
    isOpenWaterDetected: type === 'open_water',
    openWaterTrigger: type === 'open_water'
      ? `Cambio de elevación GPS: ${(elevationHigh - elevationLow).toFixed(1)}m`
      : activity.hasPoolLength ? 'Longitud de piscina registrada' : 'Piscina por defecto',
    movingRatio,
    pacePer100m: Number(pacePer100m.toFixed(1)),
    poolLength,
    averageCadence,
    totalStrokes: activity.hasRecordedTotalStrokes ? activity.totalStrokes : undefined,
    totalCycles: activity.totalCycles,
    swolf: activity.hasRecordedSwolf ? activity.swolf : undefined,
    strokesPerLength: activity.hasRecordedSpl ? activity.strokesPerLength : undefined,
    dps: undefined,
    strokeIndex: undefined,
    calories: activity.hasRecordedCalories ? activity.calories : undefined,
    waterTemp: activity.hasRecordedWaterTemp ? activity.waterTemp : undefined,
    hasWetsuit: undefined,
    poolDistanceCorrection,
  };
}

/**
 * Normalize strings stripping diacritics and casing
 */
export function normalizeText(s: string): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Parse CSV activities from Strava bulk export or Garmin CSV
 */
export function parseStravaCsv(csvText: string): SwimActivity[] {
  if (!csvText || typeof csvText !== 'string') return [];
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(header => String(header || '').trim().toLowerCase());

  const idIdx = headers.findIndex(h => h && (h.includes('activity id') || h === 'id'));
  const dateIdx = headers.findIndex(h => h && (h.includes('date') || h.includes('start time') || h.includes('hora')));
  const titleIdx = headers.findIndex(h => h && (h.includes('activity name') || h.includes('title') || h.includes('nombre') || h.includes('name')));
  const typeIdx = headers.findIndex(h => h && (h.includes('activity type') || h.includes('type') || h.includes('tipo')));
  const distIdx = headers.findIndex(h => h && (h.includes('distance') || h.includes('distancia')));
  const poolLengthIdx = headers.findIndex(h => h && (h === 'pool length' || h.includes('pool length') || h.includes('longitud piscina')));
  const cadenceIdx = headers.findIndex(h => h && (h === 'average cadence' || h.includes('average cadence') || h.includes('avg cadence')));
  const cyclesIdx = headers.findIndex(h => h === 'total cycles' || h === 'total cycles/strokes');
  const strokesIdx = headers.findIndex(h => h === 'total strokes');
  const swolfIdx = headers.findIndex(h => h === 'swolf' || h === 'average swolf');
  const splIdx = headers.findIndex(h => h === 'spl' || h.includes('strokes per length') || h.includes('strokes per lap'));

  // Precise detection of moving time vs elapsed time in Strava exports
  const movingTimeIdx = headers.findIndex(h => h && (
    h === 'moving time' || h.includes('moving time') ||
    h === 'tiempo en movimiento' || h.includes('en movimiento')
  ));
  const elapsedTimeIdx = headers.findIndex(h => h && (
    h === 'elapsed time' || h.includes('elapsed time') ||
    h === 'tiempo transcurrido' || h.includes('transcurrido') ||
    h === 'tiempo total'
  ));
  // Elevation High / Low strictly used for Open Water vs Pool classification
  const elevationHighIdx = headers.findIndex(h => h && (
    h === 'elevation high' || h === 'elevation_high' || h.includes('elevation high') ||
    h.includes('altitud maxima') || h.includes('altitud máxima') || h.includes('elevacion alta') || h.includes('elevación alta')
  ));
  const elevationLowIdx = headers.findIndex(h => h && (
    h === 'elevation low' || h === 'elevation_low' || h.includes('elevation low') ||
    h.includes('altitud minima') || h.includes('altitud mínima') || h.includes('elevacion baja') || h.includes('elevación baja')
  ));

  const hrIdx = headers.findIndex(h => h && (h.includes('average heart rate') || h.includes('avg hr') || h.includes('frecuencia cardíaca')));
  const maxHrIdx = headers.findIndex(h => h === 'max heart rate' || h.includes('max heart rate'));
  const calIdx = headers.findIndex(h => h && (h.includes('calories') || h.includes('calorías')));
  const effortIdx = headers.findIndex(h => h === 'relative effort');
  // Strava reports swim water temperature in the Average Temperature column.
  const tempIdx = headers.findIndex(h => h === 'average temperature');

  const parseTimeValue = (valStr: string): number => {
    if (!valStr) return 0;
    const clean = valStr.trim();
    if (clean.includes(':')) {
      const parts = clean.split(':').map(Number);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }
    return parseFloat(clean) || 0;
  };

  const parsedActivities: SwimActivity[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];

    // Safe column extraction
    const rawType = (typeIdx >= 0 && typeIdx < cols.length) ? cols[typeIdx] : '';
    const normType = normalizeText(rawType);

    // STRICT RULE: Only consider Activity Type = Swim (ignoring Run, Ride, etc.)
    const isSwim = normType === 'swim' ||
      normType === 'open water swim' ||
      normType.includes('swim') ||
      normType.includes('nataci') ||
      typeIdx === -1;

    if (!isSwim) continue;

    const rawTitle = (titleIdx >= 0 && titleIdx < cols.length) ? cols[titleIdx] : `Natación #${i}`;
    const actTitle = String(rawTitle || `Natación #${i}`);

    // Distance safe parsing
    let rawDist = 0;
    if (distIdx >= 0 && distIdx < cols.length && cols[distIdx]) {
      const cleanDistStr = String(cols[distIdx]).replace(/,/g, '').trim();
      rawDist = parseFloat(cleanDistStr) || 0;
    }
    if (isNaN(rawDist) || rawDist <= 0) continue;
    // Moving time & Elapsed time parsing
    let movingTime = 0;
    if (movingTimeIdx >= 0 && movingTimeIdx < cols.length) {
      movingTime = parseTimeValue(cols[movingTimeIdx]);
    }

    let elapsedTime = 0;
    if (elapsedTimeIdx >= 0 && elapsedTimeIdx < cols.length) {
      elapsedTime = parseTimeValue(cols[elapsedTimeIdx]);
    }

    const movingRatio = elapsedTime > 0 && movingTime > 0
      ? Number(((movingTime / elapsedTime) * 100).toFixed(1))
      : undefined;

    // Date safe parsing
    let actDate = '';
    let startedAt: string | undefined;
    if (dateIdx >= 0 && dateIdx < cols.length && cols[dateIdx]) {
      const parsedDate = new Date(String(cols[dateIdx]));
      if (!isNaN(parsedDate.getTime())) {
        const pad = (value: number) => String(value).padStart(2, '0');
        actDate = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`;
        startedAt = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}T${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`;
      }
    }

    // Elevation-based detection: Open Water swims have Elevation High / Low != 0; Pool swims have 0.0
    let elevationHigh: number | undefined;
    if (elevationHighIdx >= 0 && elevationHighIdx < cols.length && cols[elevationHighIdx]) {
      elevationHigh = parseFloat(cols[elevationHighIdx]) || 0;
    }

    let elevationLow: number | undefined;
    if (elevationLowIdx >= 0 && elevationLowIdx < cols.length && cols[elevationLowIdx]) {
      elevationLow = parseFloat(cols[elevationLowIdx]) || 0;
    }

    const elevationRange = (elevationHigh ?? 0) - (elevationLow ?? 0);
    const importedPoolLength = poolLengthIdx >= 0 ? parseFloat(cols[poolLengthIdx]) : Number.NaN;
    const hasPoolLength = Number.isFinite(importedPoolLength) && importedPoolLength > 0;
    const isOpenWater = detectOpenWater(elevationHigh ?? 0, elevationLow ?? 0, poolLengthIdx >= 0 ? hasPoolLength : undefined);
    const activityType: SwimActivity['type'] = hasPoolLength ? 'pool' : isOpenWater ? 'open_water' : 'unknown';
    const poolLength = activityType === 'pool' ? importedPoolLength : null;
    const distance = Math.round(rawDist);

    const pacePer100m = movingTime > 0 ? (movingTime / distance) * 100 : 0;

    const recordedCadence = cadenceIdx >= 0 ? parseFloat(cols[cadenceIdx]) : Number.NaN;
    const hasRecordedCadence = Number.isFinite(recordedCadence) && recordedCadence > 0;
    const avgCadence = hasRecordedCadence ? recordedCadence : undefined;
    const totalCycles = cyclesIdx >= 0 ? parseFloat(cols[cyclesIdx]) : Number.NaN;
    const totalStrokes = strokesIdx >= 0 ? parseFloat(cols[strokesIdx]) : Number.NaN;
    const recordedSwolf = swolfIdx >= 0 ? parseFloat(cols[swolfIdx]) : Number.NaN;
    const recordedSpl = splIdx >= 0 ? parseFloat(cols[splIdx]) : Number.NaN;
    const hasRecordedSwolf = Number.isFinite(recordedSwolf) && recordedSwolf > 0;
    const hasRecordedSpl = Number.isFinite(recordedSpl) && recordedSpl > 0;

    const avgHr = hrIdx >= 0 ? parseInt(cols[hrIdx], 10) || undefined : undefined;
    const maxHr = maxHrIdx >= 0 ? parseInt(cols[maxHrIdx], 10) || undefined : undefined;
    const cal = calIdx >= 0 ? parseInt(cols[calIdx], 10) || undefined : undefined;
    const effort = effortIdx >= 0 ? parseFloat(cols[effortIdx]) : Number.NaN;
    const waterTemp = tempIdx >= 0 ? parseFloat(cols[tempIdx]) : Number.NaN;
    const hasRecordedWaterTemp = Number.isFinite(waterTemp);

    parsedActivities.push(recalculateSwimMetrics({
      id: (idIdx >= 0 && cols[idIdx]) ? cols[idIdx] : `swim-${Date.now()}-${i}`,
      date: actDate,
      startedAt,
      title: actTitle,
      type: activityType,
      distance,
      elapsedTime: Math.round(elapsedTime),
      movingTime: Math.round(movingTime),
      hasRecordedElapsedTime: elapsedTime > 0,
      hasRecordedMovingTime: movingTime > 0,
      movingRatio,
      elevationHigh: elevationHigh === undefined ? undefined : Number(elevationHigh.toFixed(1)),
      elevationLow: elevationLow === undefined ? undefined : Number(elevationLow.toFixed(1)),
      isOpenWaterDetected: isOpenWater,
      hasPoolLength: poolLengthIdx >= 0 ? hasPoolLength : undefined,
      openWaterTrigger: activityType === 'open_water'
        ? `Cambio de elevación GPS: ${elevationRange.toFixed(1)}m`
        : activityType === 'pool' ? 'Longitud de piscina registrada' : 'Datos insuficientes para clasificar',
      pacePer100m: Number(pacePer100m.toFixed(1)),
      averageCadence: avgCadence,
      hasRecordedCadence,
      totalCycles: Number.isFinite(totalCycles) && totalCycles > 0 ? totalCycles : undefined,
      totalStrokes: Number.isFinite(totalStrokes) && totalStrokes > 0 ? totalStrokes : undefined,
      hasRecordedTotalStrokes: Number.isFinite(totalStrokes) && totalStrokes > 0,
      swolf: hasRecordedSwolf ? recordedSwolf : undefined,
      hasRecordedSwolf,
      strokesPerLength: hasRecordedSpl ? recordedSpl : undefined,
      hasRecordedSpl,
      avgHeartRate: avgHr,
      maxHeartRate: maxHr,
      relativeEffort: Number.isFinite(effort) ? effort : undefined,
      calories: cal,
      hasRecordedCalories: cal !== undefined,
      waterTemp: hasRecordedWaterTemp ? waterTemp : undefined,
      hasRecordedWaterTemp,
      poolLength,
      source: 'strava_csv',
    }));
  }

  return parsedActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Group activities by calendar week to assess volume progression
 */
function getMileageByWeek(
  activities: SwimActivity[],
  getWeek: typeof getTrainingWorkWeek,
): WeeklyMileage[] {
  if (!activities || activities.length === 0) return [];

  const map = new Map<string, {
    label: string;
    distanceMeters: number;
    poolDistanceMeters: number;
    openWaterDistanceMeters: number;
    sessionsCount: number;
    totalTimeSec: number;
    cadenceSum: number;
    cadenceCount: number;
  }>();

  for (const act of activities) {
    const week = getWeek(act.date);
    if (!week) continue;
    const weekKey = week.key;
    const label = week.label;

    const current = map.get(weekKey) || {
      label,
      distanceMeters: 0,
      poolDistanceMeters: 0,
      openWaterDistanceMeters: 0,
      sessionsCount: 0,
      totalTimeSec: 0,
      cadenceSum: 0,
      cadenceCount: 0,
    };

    current.distanceMeters += act.distance;
    if (act.type === 'open_water') {
      current.openWaterDistanceMeters += act.distance;
    } else {
      current.poolDistanceMeters += act.distance;
    }
    current.sessionsCount += 1;
    current.totalTimeSec += act.movingTime;
    if (act.averageCadence) {
      current.cadenceSum += act.averageCadence;
      current.cadenceCount += 1;
    }

    map.set(weekKey, current);
  }

  const keys = Array.from(map.keys()).sort();
  return keys.map(k => {
    const item = map.get(k)!;
    const avgPace = item.distanceMeters > 0 ? (item.totalTimeSec / item.distanceMeters) * 100 : 0;
    const avgCad = item.cadenceCount > 0 ? Math.round(item.cadenceSum / item.cadenceCount) : 62;

    return {
      weekKey: k,
      label: item.label,
      distanceMeters: item.distanceMeters,
      distanceKm: Number((item.distanceMeters / 1000).toFixed(1)),
      poolDistanceKm: Number((item.poolDistanceMeters / 1000).toFixed(1)),
      openWaterDistanceKm: Number((item.openWaterDistanceMeters / 1000).toFixed(1)),
      sessionsCount: item.sessionsCount,
      avgPaceSec: Math.round(avgPace),
      avgCadence: avgCad,
    };
  });
}

export function getWeeklyMileage(activities: SwimActivity[]): WeeklyMileage[] {
  return getMileageByWeek(activities, getTrainingWorkWeek);
}

export function getCalendarWeeklyMileage(activities: SwimActivity[]): WeeklyMileage[] {
  return getMileageByWeek(activities, getCalendarWeek);
}

/**
 * Filter activities within the last X days from reference date
 */
function getVolumeInWindowDays(activities: SwimActivity[], days: number, referenceDate: Date): number {
  const refTime = referenceDate.getTime();
  const startTime = refTime - days * 24 * 3600 * 1000;
  return activities
    .filter(a => {
      const t = new Date(a.date).getTime();
      return t >= startTime && t <= refTime;
    })
    .reduce((sum, a) => sum + a.distance, 0);
}

/**
 * Calculate the 10 specific readiness checks for Oceanman 14K
 */
/**
 * Historical climate, temperature, wind, and water conditions for Lago d'Orta in June
 */
export const ORTA_HISTORICAL_CONDITIONS: OrtaEnvironmentalCondition[] = [
  {
    id: 'env-water-temp',
    title: 'Temperatura del Agua (Superficie)',
    value: '18.5°C – 20.5°C',
    subtext: 'Agua dulce fresca de origen glaciar · Termoclina a partir de 4-5m de profundidad',
    impact: 'Temperatura ideal para esfuerzos prolongados de ultrafondo; evita el recalentamiento corporal y la deshidratación masiva de aguas tropicales.',
    recommendation: 'Neopreno integral de natación (3mm-4mm) permitido y muy aconsejado. Testar lubricante anti-rozaduras en cuello.',
    category: 'water_temp',
  },
  {
    id: 'env-air-temp',
    title: 'Temperatura Ambiente (Salida 09:30 AM)',
    value: '22°C – 28°C',
    subtext: 'Mañana templada en Omegna (Norte), alcanzando pico térmico en Lido di Gozzano (Sur)',
    impact: 'Entrada al agua sin choque térmico brusco. En las últimas 2 horas, la radiación dorsal acumulada es notable.',
    recommendation: 'Permanecer en sombra en la Piazza de Omegna durante la cámara de llamadas previa a las 09:15 AM.',
    category: 'air_temp',
  },
  {
    id: 'env-wind',
    title: 'Régimen de Vientos ("Inverna" & Brisa Alpina)',
    value: '6 – 14 km/h (Fuerza 2 Beaufort)',
    subtext: 'Calma matinal 09:30-11:30 AM · Brisa térmica de ladera a partir del mediodía',
    impact: 'La primera mitad norte del lago ofrece condiciones de agua espejo. Al entrar al canal este de Isola San Giulio la brisa se activa de costado/proa.',
    recommendation: 'Aprovechar las 2 primeras horas para nadar largo y eficiente sin gastar energía en avistamiento excesivo.',
    category: 'wind',
  },
  {
    id: 'env-chop',
    title: 'Oleaje Lacustre & Estado de la Superficie',
    value: '0.1m – 0.35m (Rizado leve a medio)',
    subtext: 'Lago alpino protegido entre montañas · Sin mareas ni corrientes de marea marinas',
    impact: 'Agua extremadamente rápida en Omegna; rizado corto a partir del km 8.5 que exige levantar la vista cada 6-8 ciclos de brazada.',
    recommendation: 'Respiración bilateral (cada 3 brazadas) para mantener visión periférica en ambos márgenes y no tragar agua del rizado.',
    category: 'chop',
  },
  {
    id: 'env-clarity',
    title: 'Transparencia & Visibilidad Subacuática',
    value: '4 – 6 metros de visibilidad nítida',
    subtext: 'Uno de los lagos más limpios de Europa tras su recuperación biológica natural',
    impact: 'Fondo rocoso y agua cristalina que genera una excelente sensación de confort mental y facilita el drafting detrás de otros nadadores.',
    recommendation: 'Gafas de natación polarizadas o espejadas con filtro UV para amortiguar los reflejos luminosos sobre el agua clara.',
    category: 'clarity',
  },
  {
    id: 'env-solar',
    title: 'Radiación Solar & Exposición UV',
    value: 'Índice UV 7 – 8 (Muy Alto)',
    subtext: 'Máxima insolación entre 11:30 AM y 02:30 PM en aguas abiertas',
    impact: 'La posición horizontal prolongada durante 4 a 5 horas expone intensamente hombros, nuca y parte trasera de las piernas.',
    recommendation: 'Aplicar protector solar SPF 50+ de base mineral resistente al agua en nuca y hombros 30 minutos antes del neopreno.',
    category: 'solar',
  },
];

/**
 * Readiness checks built only on fields present for virtually every swim in the export:
 * distance, moving time, elapsed time and heart rate.
 */
export function evaluateReadinessChecks(
  activities: SwimActivity[],
  referenceDate: Date
): { checks: ReadinessCheckItem[]; overallScore: number; passedCount: number } {
  if (activities.length === 0) {
    return { checks: [], overallScore: 0, passedCount: 0 };
  }

  const marked = markPaceOutliers(activities);
  const clean = marked.filter(activity => !activity.isPaceOutlier);

  // 1. Projected 14 km time against the 6 h cut-off, using the athlete's own fatigue curve.
  const openWaterPenalty = getOpenWaterPenaltySec(marked) ?? 0;
  const projection = buildRaceProjection(clean, OCEANMAN_DISTANCE_METERS);
  const projectedSec = projection?.swimTimeSec ?? 0;
  const marginMin = projection ? Math.round((OFFICIAL_CUTOFF_TOTAL_SEC - projectedSec) / 60) : 0;
  const check1M1 = projection !== null && projectedSec <= OFFICIAL_CUTOFF_TOTAL_SEC;
  const check1M2 = projection !== null && projectedSec <= OFFICIAL_CUTOFF_TOTAL_SEC - 20 * 60;
  const check1M3 = projection !== null && projectedSec <= OFFICIAL_CUTOFF_TOTAL_SEC - 45 * 60;
  const check1Score = projection
    ? Math.max(0, Math.min(100, Math.round((OFFICIAL_CUTOFF_TOTAL_SEC / Math.max(projectedSec, 1)) * 60)))
    : 0;

  const check1: ReadinessCheckItem = {
    id: 'check-1-race-projection',
    checkNumber: 1,
    category: 'pacing',
    title: 'Proyección 14 km frente al corte de 6 h',
    shortTitle: 'Proyección 14K',
    description: 'Extrapola tu tiempo a 14 km con el exponente de fatiga ajustado sobre tus propias sesiones de 1,5 km o más, más la penalización medida de aguas abiertas.',
    baseline: projection
      ? `k=${projection.model.exponent} (R²=${projection.model.rSquared}, n=${projection.model.sampleSize}) · penalización aguas abiertas +${openWaterPenalty.toFixed(0)} s/100m`
      : 'Faltan sesiones de 1,5 km o más para ajustar la curva de fatiga',
    milestones: [
      { level: 'Dentro de corte', label: 'Corte', target: 'Terminar en menos de 6h 00m', isCompleted: check1M1 },
      { level: 'Margen de seguridad', label: 'Margen', target: '20 min de colchón', isCompleted: check1M2 },
      { level: 'Holgado', label: 'Holgado', target: '45 min de colchón', isCompleted: check1M3 },
    ],
    currentValue: projectedSec,
    targetValue: OFFICIAL_CUTOFF_TOTAL_SEC,
    currentValueFormatted: projection ? formatDuration(projectedSec) : 'N/D',
    targetValueFormatted: '< 6h 00m',
    unit: 'tiempo',
    status: check1M3 ? 'passed' : check1M1 ? 'warning' : 'pending',
    isDataAvailable: projection !== null,
    score: check1Score,
    weight: 25,
    details: projection
      ? `Ritmo proyectado ${formatPace(projection.pacePer100mSec)} · margen ${marginMin >= 0 ? '+' : ''}${marginMin} min. Extrapola ${projection.extrapolationFactor}× tu nado más largo (${formatDistance(projection.model.longestDistanceM)}), así que pierde precisión cuanto mayor sea ese factor.`
      : 'Necesitas al menos cinco sesiones de 1,5 km o más para estimar la curva.',
    summary: check1M1 ? 'La proyección entra dentro del corte oficial.' : 'La proyección actual supera el corte de 6 h.',
  };

  // 2. Longest open-water swim: the specific demand of the event.
  const owSwims = marked.filter(a => a.type === 'open_water');
  const maxOwKm = owSwims.length > 0 ? Number((Math.max(...owSwims.map(a => a.distance)) / 1000).toFixed(2)) : 0;
  const check2M1 = maxOwKm >= 5;
  const check2M2 = maxOwKm >= 8;
  const check2M3 = maxOwKm >= 10;

  const check2: ReadinessCheckItem = {
    id: 'check-2-ow-longest',
    checkNumber: 2,
    category: 'open_water',
    title: 'Tirada continua más larga en aguas abiertas',
    shortTitle: 'Max Aguas Abiertas',
    description: 'La distancia máxima ya cubierta en aguas abiertas marca cuánto extrapola la proyección.',
    baseline: owSwims.length > 0
      ? `${owSwims.length} sesiones en aguas abiertas detectadas por elevación GPS`
      : 'Sin sesiones en aguas abiertas detectadas',
    milestones: [
      { level: 'Hito 1', label: 'Hito 1', target: '5 km continuos', isCompleted: check2M1 },
      { level: 'Hito 2', label: 'Hito 2', target: '8 km continuos', isCompleted: check2M2 },
      { level: 'Hito 3', label: 'Hito 3', target: '10 km continuos', isCompleted: check2M3 },
    ],
    currentValue: maxOwKm,
    targetValue: 10,
    currentValueFormatted: `${maxOwKm.toFixed(2)} km`,
    targetValueFormatted: '10 km',
    unit: 'km',
    status: check2M3 ? 'passed' : check2M1 ? 'warning' : 'pending',
    score: Math.round(Math.min(1, maxOwKm / 10) ** 1.5 * 100),
    weight: 20,
    details: `Tu nado más largo en aguas abiertas es de ${maxOwKm.toFixed(2)} km frente a los 14 km de la prueba.`,
    summary: check2M3 ? 'Distancia específica consolidada.' : 'Aumenta progresivamente la tirada en aguas abiertas.',
  };

  // 3. Weekly volume across the last eight completed work weeks.
  const recentWeeks = getRecentCompletedTrainingWeeks(referenceDate, 8);
  const weeklyByKey = new Map(getWeeklyMileage(activities).map(week => [week.weekKey, week.distanceMeters]));
  const weeklyKm = Number((recentWeeks.reduce((sum, week) => sum + (weeklyByKey.get(week.key) || 0), 0) / Math.max(1, recentWeeks.length) / 1000).toFixed(1));
  const check3M1 = weeklyKm >= 10;
  const check3M2 = weeklyKm >= 15;
  const check3M3 = weeklyKm >= 20;

  const check3: ReadinessCheckItem = {
    id: 'check-3-weekly-volume',
    checkNumber: 3,
    category: 'volume',
    title: 'Volumen semanal reciente',
    shortTitle: 'Volumen Semanal',
    description: 'Media de kilómetros nadados en las ocho semanas completas anteriores.',
    baseline: `Semanas de lunes a viernes; una semana sin nadar cuenta como 0 km`,
    milestones: [
      { level: 'Hito 1', label: 'Hito 1', target: '10 km/semana', isCompleted: check3M1 },
      { level: 'Hito 2', label: 'Hito 2', target: '15 km/semana', isCompleted: check3M2 },
      { level: 'Hito 3', label: 'Hito 3', target: '20 km/semana', isCompleted: check3M3 },
    ],
    currentValue: weeklyKm,
    targetValue: 20,
    currentValueFormatted: `${weeklyKm} km/sem`,
    targetValueFormatted: '20 km/sem',
    unit: 'km/sem',
    status: check3M3 ? 'passed' : check3M1 ? 'warning' : 'pending',
    score: Math.round(Math.min(1, weeklyKm / 20) ** 1.5 * 100),
    weight: 20,
    details: `Media de ${weeklyKm} km/sem en las últimas ${recentWeeks.length} semanas completas.`,
    summary: check3M3 ? 'Volumen en objetivo.' : 'El volumen semanal es el principal limitante.',
  };

  // 4. Continuity: race time is elapsed time, so stopping habits matter.
  const continuity = getLongSwimContinuity(marked);
  const continuityPct = continuity?.medianRatio ?? 0;
  const check4M1 = continuityPct >= 80;
  const check4M2 = continuityPct >= 90;

  const check4: ReadinessCheckItem = {
    id: 'check-4-continuity',
    checkNumber: 4,
    category: 'endurance',
    title: 'Continuidad en nados largos',
    shortTitle: 'Continuidad',
    description: 'Porcentaje mediano de tiempo en movimiento sobre tiempo total en sesiones de 2 km o más. En carrera cuenta el tiempo total, no el de nado.',
    baseline: continuity
      ? `${continuity.sampleSize} sesiones de 2 km o más con tiempo total registrado`
      : 'Sin sesiones largas con tiempo total registrado',
    milestones: [
      { level: 'Hito 1', label: 'Hito 1', target: '80% del tiempo nadando', isCompleted: check4M1 },
      { level: 'Hito 2', label: 'Hito 2', target: '90% del tiempo nadando', isCompleted: check4M2 },
    ],
    currentValue: continuityPct,
    targetValue: 90,
    currentValueFormatted: continuity ? `${continuityPct}%` : 'N/D',
    targetValueFormatted: '≥90%',
    unit: '%',
    status: check4M2 ? 'passed' : check4M1 ? 'warning' : 'pending',
    isDataAvailable: continuity !== null,
    score: Math.max(0, Math.min(100, Math.round((continuityPct - 50) / 40 * 100))),
    weight: 15,
    details: continuity
      ? `Mediana de ${continuityPct}% en movimiento: cada parada aumenta el tiempo oficial de carrera.`
      : 'Sin datos de continuidad disponibles.',
    summary: check4M2 ? 'Nado continuo sólido.' : 'Reduce las paradas en las tiradas largas.',
  };

  // 5. Consistency from session dates alone.
  const consistencyWeekKeys = new Set(recentWeeks.map(week => week.key));
  const sessionsPerWeek = new Map<string, number>();
  activities.forEach(activity => {
    const week = getTrainingWorkWeek(activity.date);
    if (!week || !consistencyWeekKeys.has(week.key)) return;
    sessionsPerWeek.set(week.key, (sessionsPerWeek.get(week.key) || 0) + 1);
  });
  const weeksWithThree = recentWeeks.filter(week => (sessionsPerWeek.get(week.key) || 0) >= 3).length;
  const check5M1 = weeksWithThree >= 4;
  const check5M2 = weeksWithThree >= 6;

  const check5: ReadinessCheckItem = {
    id: 'check-5-consistency',
    checkNumber: 5,
    category: 'volume',
    title: 'Constancia semanal',
    shortTitle: 'Constancia',
    description: 'Semanas con tres o más sesiones registradas.',
    baseline: `${weeksWithThree} de ${recentWeeks.length} semanas con 3 o más sesiones`,
    milestones: [
      { level: 'Hito 1', label: 'Hito 1', target: '4 de 8 semanas', isCompleted: check5M1 },
      { level: 'Hito 2', label: 'Hito 2', target: '6 de 8 semanas', isCompleted: check5M2 },
    ],
    currentValue: weeksWithThree,
    targetValue: 6,
    currentValueFormatted: `${weeksWithThree} / ${recentWeeks.length} semanas`,
    targetValueFormatted: '6 de 8',
    unit: 'semanas',
    status: check5M2 ? 'passed' : check5M1 ? 'warning' : 'pending',
    score: Math.round(weeksWithThree / 8 * 100),
    weight: 10,
    details: 'Una semana cuenta si incluye tres o más sesiones.',
    summary: check5M2 ? 'Frecuencia estable.' : 'Busca sostener tres sesiones por semana.',
  };

  // 6. Aerobic efficiency: speed per heartbeat, available for ~99% of sessions.
  const efficiency = getEfficiencyTrend(clean);
  const efficiencyChange = efficiency?.changePct ?? 0;
  const check6M1 = efficiency !== null && efficiencyChange >= 0;
  const check6M2 = efficiency !== null && efficiencyChange >= 3;

  const check6: ReadinessCheckItem = {
    id: 'check-6-aerobic-efficiency',
    checkNumber: 6,
    category: 'efficiency',
    title: 'Eficiencia aeróbica (velocidad por pulsación)',
    shortTitle: 'Eficiencia',
    description: 'Metros por latido de las últimas 10 sesiones frente a las 10 anteriores. Subir significa nadar más rápido al mismo coste cardíaco.',
    baseline: efficiency
      ? `Actual ${efficiency.recentAverage} vs previo ${efficiency.previousAverage} (m/s por ppm ×100)`
      : 'Faltan sesiones con pulsómetro para comparar dos bloques',
    milestones: [
      { level: 'Hito 1', label: 'Mantiene', target: 'No perder eficiencia', isCompleted: check6M1 },
      { level: 'Hito 2', label: 'Mejora', target: 'Mejorar un 3%', isCompleted: check6M2 },
    ],
    currentValue: efficiencyChange,
    targetValue: 3,
    currentValueFormatted: efficiency ? `${efficiencyChange >= 0 ? '+' : ''}${efficiencyChange}%` : 'N/D',
    targetValueFormatted: '+3%',
    unit: '%',
    status: check6M2 ? 'passed' : check6M1 ? 'warning' : 'pending',
    isDataAvailable: efficiency !== null,
    score: Math.max(0, Math.min(100, Math.round(50 + efficiencyChange * 10))),
    weight: 10,
    details: efficiency
      ? `Comparación de ${efficiency.recentCount} sesiones recientes con ${efficiency.previousCount} anteriores.`
      : 'Se necesitan 20 sesiones con frecuencia cardíaca registrada.',
    summary: check6M2 ? 'La eficiencia aeróbica mejora.' : check6M1 ? 'Eficiencia estable.' : 'La eficiencia aeróbica está cayendo.',
  };

  const checks: ReadinessCheckItem[] = [check1, check2, check3, check4, check5, check6];

  const scoredChecks = checks.filter(check => check.isScored !== false);
  const scoredWeight = scoredChecks.reduce((sum, check) => sum + check.weight, 0);
  const weightedScore = scoredWeight > 0
    ? scoredChecks.reduce((sum, check) => sum + (check.isDataAvailable === false ? 0 : check.score * check.weight), 0) / scoredWeight
    : 0;
  const passedCount = checks.filter(c => c.status === 'passed').length;

  return {
    checks,
    overallScore: Math.round(weightedScore),
    passedCount,
  };
}

/**
 * Historical Readiness Progression Engine:
 * Recomputes the Oceanman readiness index chronologically day by day, week by week, or month by month.
 */
export function calculateHistoricalReadiness(
  activities: SwimActivity[],
  granularity: 'daily' | 'weekly' | 'monthly' = 'weekly'
): HistoricalReadinessPoint[] {
  if (activities.length === 0) return [];

  const sorted = [...activities].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const points: HistoricalReadinessPoint[] = [];

  // Group timestamps according to granularity
  const datesSet = new Set<string>();
  for (const act of sorted) {
    const d = new Date(act.date);
    if (granularity === 'daily') {
      datesSet.add(act.date);
    } else if (granularity === 'weekly') {
      const workWeek = getTrainingWorkWeek(act.date);
      if (workWeek) datesSet.add(workWeek.key);
    } else {
      datesSet.add(`${d.getFullYear()}-${d.getMonth() + 1 < 10 ? '0' : ''}${d.getMonth() + 1}`);
    }
  }

  // Iterate chronologically through points
  let previousLongest = 0;
  let previous30dVol = 0;

  Array.from(datesSet).forEach(timeKey => {
    // Find the latest activity in this bucket
    const subActivities = sorted.filter(act => {
      const d = new Date(act.date);
      if (granularity === 'daily') {
        return act.date <= timeKey;
      } else if (granularity === 'weekly') {
        const workWeek = getTrainingWorkWeek(act.date);
        return workWeek !== null && workWeek.key <= timeKey;
      } else {
        const key = `${d.getFullYear()}-${d.getMonth() + 1 < 10 ? '0' : ''}${d.getMonth() + 1}`;
        return key <= timeKey;
      }
    });

    if (subActivities.length === 0) return;

    const latestAct = subActivities[subActivities.length - 1];
    const refDate = new Date(latestAct.date);

    const { overallScore, checks } = evaluateReadinessChecks(subActivities, refDate);
    const vol30d = getVolumeInWindowDays(subActivities, 30, refDate);
    const vol14d = getVolumeInWindowDays(subActivities, 14, refDate);
    const longest = Math.max(...subActivities.map(a => a.distance));
    const ow = subActivities.filter(a => a.type === 'open_water');
    const owCount = ow.length;
    const owKm = ow.reduce((sum, a) => sum + a.distance, 0) / 1000;
    const avgPace = (subActivities.reduce((sum, a) => sum + a.movingTime, 0) / subActivities.reduce((sum, a) => sum + a.distance, 0)) * 100;

    let milestone: string | undefined = undefined;
    if (longest >= 12000 && previousLongest < 12000) {
      milestone = '¡Hito Épico: Test 12.000m Completado!';
      previousLongest = 12000;
    } else if (longest >= 10000 && previousLongest < 10000) {
      milestone = '¡Test 10K Superado!';
      previousLongest = 10000;
    } else if (longest >= 8000 && previousLongest < 8000) {
      milestone = '¡Primera Tirada 8.000m superada!';
      previousLongest = 8000;
    } else if (vol30d >= 70000 && previous30dVol < 70000) {
      milestone = '¡Desbloqueado bloque mensual de 70 km!';
      previous30dVol = 70000;
    }

    let label = latestAct.date;
    if (granularity === 'weekly') {
      label = getTrainingWorkWeek(latestAct.date)?.label || timeKey;
    } else if (granularity === 'monthly') {
      const [year, month] = timeKey.split('-');
      const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      label = dateObj.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
    }

    points.push({
      date: latestAct.date,
      label,
      readinessScore: overallScore,
      volumeLast30DaysKm: Number((vol30d / 1000).toFixed(1)),
      volumeLast14DaysKm: Number((vol14d / 1000).toFixed(1)),
      longestSwimKm: Number((longest / 1000).toFixed(1)),
      openWaterSessionsTotal: owCount,
      openWaterKmTotal: Number(owKm.toFixed(1)),
      avgPaceSec: Math.round(avgPace),
      checkScores: Object.fromEntries(checks.filter(check => check.isScored !== false).map(check => [check.id, check.score])),
      milestoneUnlocked: milestone,
    });
  });

  return points;
}

/**
 * Calculate Oceanman 14K Lago d'Orta Readiness index, projections and plan
 */
export function calculateOceanmanReadiness(
  activities: SwimActivity[],
  currentDate: Date = new Date('2026-10-24T12:00:00Z')
): OceanmanReadiness {
  const targetDate = OCEANMAN_DATE;
  const msRemaining = targetDate.getTime() - currentDate.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const weeksRemaining = Math.max(0, Math.ceil(daysRemaining / 7));

  if (!activities || activities.length === 0) {
    return {
      overallScore: 0,
      statusLevel: 'High Endurance Gap',
      volumeLast14DaysMeters: 0,
      volumeLast30DaysMeters: 0,
      volumeLast60DaysMeters: 0,
      volumeLast90DaysMeters: 0,
      checks: [],
      passedChecksCount: 0,
      totalChecksCount: 0,
      longestSwimMeters: 0,
      longestDurationSec: 0,
      openWaterSessionsCount: 0,
      openWaterTotalMeters: 0,
      coldWaterSessionsCount: 0,
      avgWeeklyVolumeMeters: 0,
      targetWeeklyVolumeMeters: RECOMMENDED_WEEKLY_VOLUME_METERS,
      estimatedFinishTimeSec: 0,
      estimatedFinishTimeString: '--:--',
      estimatedPacePer100mSec: 0,
      estimatedPaceString: '--:--',
      timeRangeMin: '--:--',
      timeRangeMax: '--:--',
      officialLimitSeconds: OFFICIAL_CUTOFF_TOTAL_SEC,
      cutOffMarginKm5Min: 0,
      cutOffMarginKm10Min: 0,
      cutOffMarginFinishMin: 0,
      isWithinOfficialCutOff: false,
      daysRemaining,
      weeksRemaining,
      nutritionPlan: {
        carbsPerHourGrams: 75,
        hydrationMlPerHour: 650,
        sodiumMgPerHour: 550,
        totalCarbsGrams: 300,
        feedingIntervalMinutes: 35,
        gelCount: 10,
        feedingsCount: 7,
        officialFloatingStationsCount: 2,
      },
      mandatoryEquipment: [],
      wetsuitRegulation: {
        lakeExpectedTempC: 19.0,
        ruleStatus: 'Permitido / Altamente Recomendable',
        details: 'Regla oficial: <18°C Obligatorio | 18-24°C Permitido | >24°C Prohibido. En Lago d\'Orta a ~19°C está permitido.',
      },
      worldSlotEligibility: 'Top 10 en Grupo de Edad clasifica a la Final Mundial.',
      strengths: [],
      recommendations: ['Importa tus nados de Strava para calcular tu preparación.'],
      milestones: [],
      historicalEvolution: [],
    };
  }

  // Windows
  const volumeLast14DaysMeters = getVolumeInWindowDays(activities, 14, currentDate);
  const volumeLast30DaysMeters = getVolumeInWindowDays(activities, 30, currentDate);
  const volumeLast60DaysMeters = getVolumeInWindowDays(activities, 60, currentDate);
  const volumeLast90DaysMeters = getVolumeInWindowDays(activities, 90, currentDate);

  const longestSwimMeters = Math.max(...activities.map(a => a.distance));
  const longestDurationSec = Math.max(...activities.map(a => a.movingTime));
  const openWaterSessions = activities.filter(a => a.type === 'open_water');
  const openWaterSessionsCount = openWaterSessions.length;
  const openWaterTotalMeters = openWaterSessions.reduce((sum, a) => sum + a.distance, 0);
  const coldWaterSessionsCount = activities.filter(a => a.hasRecordedWaterTemp && a.waterTemp !== undefined && a.waterTemp <= 20.0).length;

  const weeklyData = getWeeklyMileage(activities);
  const recentWeeks = weeklyData.slice(-6);
  const avgWeeklyVolumeMeters = recentWeeks.length > 0
    ? Math.round(recentWeeks.reduce((acc, w) => acc + w.distanceMeters, 0) / recentWeeks.length)
    : Math.round(activities.reduce((s, a) => s + a.distance, 0) / Math.max(1, weeklyData.length));

  // Run the 10 specific readiness checks
  const { checks, overallScore, passedCount } = evaluateReadinessChecks(activities, currentDate);

  let statusLevel: OceanmanReadiness['statusLevel'] = 'High Endurance Gap';
  if (overallScore >= 85) statusLevel = 'Elite Prepared';
  else if (overallScore >= 70) statusLevel = 'Ready to Conquer';
  else if (overallScore >= 50) statusLevel = 'Solid Progress';

  // Pace projection for 14,000 m from the athlete's own fatigue curve.
  const markedForProjection = markPaceOutliers(activities);
  const cleanForProjection = markedForProjection.filter(activity => !activity.isPaceOutlier);
  const raceProjection = buildRaceProjection(cleanForProjection, OCEANMAN_DISTANCE_METERS);

  const estimatedPacePer100mSec = raceProjection ? Math.round(raceProjection.pacePer100mSec) : 0;
  const estimatedFinishTimeSec = raceProjection ? raceProjection.swimTimeSec : 0;

  const estimatedFinishTimeString = estimatedFinishTimeSec > 0 ? formatDuration(estimatedFinishTimeSec) : '--:--';
  const estimatedPaceString = formatPace(estimatedPacePer100mSec);

  const minTimeSec = Math.round(estimatedFinishTimeSec * 0.96);
  const maxTimeSec = Math.round(estimatedFinishTimeSec * 1.06);
  const timeRangeMin = minTimeSec > 0 ? formatDuration(minTimeSec) : '--:--';
  const timeRangeMax = maxTimeSec > 0 ? formatDuration(maxTimeSec) : '--:--';

  const totalHours = estimatedFinishTimeSec / 3600;
  const carbsPerHourGrams = 75;
  const hydrationMlPerHour = 650;
  const sodiumMgPerHour = 550;
  const totalCarbsGrams = Math.round(totalHours * carbsPerHourGrams);
  const feedingIntervalMinutes = 35;
  const feedingsCount = estimatedFinishTimeSec > 0
    ? Math.max(3, Math.floor((estimatedFinishTimeSec / 60) / feedingIntervalMinutes))
    : 0;
  const gelCount = Math.round(totalCarbsGrams / 30);

  // Dynamic strengths & recommendations based on checks
  const strengths: string[] = [];
  const recommendations: string[] = [];

  const passedTitles = checks.filter(c => c.status === 'passed').map(c => c.title);
  const failedChecks = checks.filter(c => c.status !== 'passed');

  if (longestSwimMeters >= 10000) {
    strengths.push(`Tirada colosal de ${formatDistance(longestSwimMeters)} completada: barrera de los 10k superada con éxito.`);
  } else if (longestSwimMeters >= 7500) {
    strengths.push(`Tirada base de ${formatDistance(longestSwimMeters)}: buena resistencia de fondo.`);
  }

  if (volumeLast30DaysMeters >= 60000) {
    strengths.push(`Carga mensual de ${(volumeLast30DaysMeters / 1000).toFixed(1)} km en los últimos 30 días, garantizando tolerancia aeróbica.`);
  }

  if (openWaterSessionsCount >= 8) {
    strengths.push(`Gran bagaje en aguas abiertas (${openWaterSessionsCount} sesiones, ${(openWaterTotalMeters / 1000).toFixed(1)} km) para dominar el oleaje lacustre.`);
  }

  for (const f of failedChecks.slice(0, 3)) {
    recommendations.push(`Refuerza ${f.title}: ${f.details}`);
  }

  // Official Cut-off safety analysis (Lago d'Orta 6h max limit)
  const estKm5Min = Math.round((50 * estimatedPacePer100mSec) / 60);
  const estKm10Min = Math.round((100 * estimatedPacePer100mSec) / 60);
  const estFinishMin = Math.round(estimatedFinishTimeSec / 60);

  const cutOffMarginKm5Min = estimatedPacePer100mSec > 0 ? 135 - estKm5Min : 0;
  const cutOffMarginKm10Min = estimatedPacePer100mSec > 0 ? 270 - estKm10Min : 0;
  const cutOffMarginFinishMin = estimatedPacePer100mSec > 0 ? 360 - estFinishMin : 0;
  const isWithinOfficialCutOff = estimatedFinishTimeSec > 0 && estimatedFinishTimeSec <= OFFICIAL_CUTOFF_TOTAL_SEC;

  // Clock time helper from 09:30 AM start
  const getClockFromSec = (seconds: number) => {
    const totalMinutes = 9 * 60 + 30 + Math.round(seconds / 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`;
  };

  const milestones: OceanmanMilestone[] = [
    {
      km: 0,
      label: 'Salida: Piazza de Omegna (09:30 AM)',
      description: "Arranque oficial desde la Piazza de Omegna en el extremo norte del lago. Aguas tranquilas matinales a ~19°C. Traslados en barco previo desde Gozzano.",
      estimatedPassingTime: '00:00:00',
      estimatedClockTime: '09:30 AM',
      officialCutOffTime: 'Salida 09:30 AM',
      officialCutOffClock: '09:30 AM',
      nutritionAdvice: 'Pre-hidratación con sales 15 min antes en la cámara de llamadas.',
      isFeedStation: false,
      isCutOffPoint: false,
    },
    {
      km: 5.0,
      label: 'Punto de Corte 1 & Estación Flotante #1',
      description: 'Primer tercio del lago (canal central hacia Ronco). Primera de las 2 plataformas oficiales de hidratación/geles de la organización.',
      estimatedPassingTime: estimatedPacePer100mSec > 0 ? formatDuration(Math.round(estimatedPacePer100mSec * 50)) : 'N/D',
      estimatedClockTime: estimatedPacePer100mSec > 0 ? getClockFromSec(estimatedPacePer100mSec * 50) : undefined,
      officialCutOffTime: '2h 15min',
      officialCutOffClock: '11:45 AM',
      cutOffMarginMinutes: cutOffMarginKm5Min,
      nutritionAdvice: 'Avituallamiento oficial #1: Hidrogel 40g HC + 150ml agua en plataforma flotante.',
      isFeedStation: true,
      isCutOffPoint: true,
    },
    {
      km: 8.5,
      label: 'Paso por Isola San Giulio & Pella',
      description: 'El icono mundial del Oceanman. Bordeando la mística isla de San Giulio con vistas a Pella. Posible brisa alpina.',
      estimatedPassingTime: estimatedPacePer100mSec > 0 ? formatDuration(Math.round(estimatedPacePer100mSec * 85)) : 'N/D',
      estimatedClockTime: estimatedPacePer100mSec > 0 ? getClockFromSec(estimatedPacePer100mSec * 85) : undefined,
      nutritionAdvice: 'Autonomía personal: 1 gel tomado desde el compartimento estanco de tu boya de seguridad.',
      isFeedStation: false,
      isCutOffPoint: false,
    },
    {
      km: 10.0,
      label: 'Punto de Corte 2 & Estación Flotante #2 (Buccione)',
      description: 'Tramo decisivo hacia el golfo sur. Segunda y última estación oficial flotante. Tiempo de corte estricto.',
      estimatedPassingTime: estimatedPacePer100mSec > 0 ? formatDuration(Math.round(estimatedPacePer100mSec * 100)) : 'N/D',
      estimatedClockTime: estimatedPacePer100mSec > 0 ? getClockFromSec(estimatedPacePer100mSec * 100) : undefined,
      officialCutOffTime: '4h 30min',
      officialCutOffClock: '02:00 PM',
      cutOffMarginMinutes: cutOffMarginKm10Min,
      nutritionAdvice: 'Avituallamiento oficial #2: Gel con cafeína + sales isotónicas para evitar calambres en los 4km finales.',
      isFeedStation: true,
      isCutOffPoint: true,
    },
    {
      km: 14.0,
      label: 'Meta: Playa de Lido di Gozzano (Finisher)',
      description: "Arribo triunfal en la playa de Lido di Gozzano tras cruzar el Lago d'Orta de norte a sur. Medalla oficial de Finisher, comida y recuperación.",
      estimatedPassingTime: estimatedFinishTimeString,
      estimatedClockTime: estimatedFinishTimeSec > 0 ? getClockFromSec(estimatedFinishTimeSec) : undefined,
      officialCutOffTime: '6h 00min (Cierre)',
      officialCutOffClock: '03:30 PM',
      cutOffMarginMinutes: cutOffMarginFinishMin,
      nutritionAdvice: 'Zona de meta: Recuperador 4:1 CH/Proteína + fruta + hidratación continua.',
      isFeedStation: false,
      isCutOffPoint: true,
    },
  ];

  const mandatoryEquipment = [
    {
      id: 'eq-buoy',
      name: 'Boya de Seguridad Personal',
      officialRule: 'Estrictamente obligatoria. Hinchada y atada a la cintura con cuerda de 20 a 60 cm. Mínimo 41x31cm deshinchada (30cm de alto hinchada). Prohibido color negro.',
      isMandatory: true,
    },
    {
      id: 'eq-cap',
      name: 'Gorro Oficial de Silicona',
      officialRule: 'Obligatorio nadar únicamente con el gorro suministrado por la organización en la bolsa de carrera (identifica distancia y ola).',
      isMandatory: true,
    },
    {
      id: 'eq-goggles',
      name: 'Gafas de Natación',
      officialRule: 'Uso obligatorio durante la totalidad del recorrido para protección y avistamiento visual.',
      isMandatory: true,
    },
    {
      id: 'eq-chip',
      name: 'Chip Electrónico de Cronometraje',
      officialRule: 'Obligatorio llevarlo en tobillo o muñeca según las indicaciones de carrera.',
      isMandatory: true,
    },
    {
      id: 'eq-prohibited',
      name: 'Material Prohibido',
      officialRule: 'Prohibidas palas/manoplas, tubos de snorkel, pull buoys, guantes con membrana y reproductores de música acuáticos (solo reloj GPS/pulsómetro permitido).',
      isMandatory: true,
      prohibitedDetails: 'No se permite asistencia externa privada desde kayaks o barcos particulares.',
    },
  ];

  const wetsuitRegulation = {
    lakeExpectedTempC: 19.0,
    ruleStatus: 'Permitido / Altamente Recomendable',
    details: 'Regla oficial: <18°C Obligatorio | 18°C a 24°C Opcional/Permitido | >24°C Prohibido. En Lago d\'Orta a ~19°C está permitido y aporta ventaja de flotabilidad de ~4-5s/100m.',
  };

  const worldSlotEligibility = 'Los 10 primeros clasificados de cada grupo de edad (por año de nacimiento) obtienen plaza directa (slot) para el OCEANMAN World Final Championship.';

  // Historical evolution
  const historicalEvolution = calculateHistoricalReadiness(activities, 'weekly');

  return {
    overallScore,
    statusLevel,
    volumeLast14DaysMeters,
    volumeLast30DaysMeters,
    volumeLast60DaysMeters,
    volumeLast90DaysMeters,
    checks,
    passedChecksCount: passedCount,
    totalChecksCount: checks.filter(check => check.isScored !== false && check.isDataAvailable !== false).length,
    longestSwimMeters,
    longestDurationSec,
    openWaterSessionsCount,
    openWaterTotalMeters,
    coldWaterSessionsCount,
    avgWeeklyVolumeMeters,
    targetWeeklyVolumeMeters: RECOMMENDED_WEEKLY_VOLUME_METERS,
    estimatedFinishTimeSec,
    estimatedFinishTimeString,
    estimatedPacePer100mSec,
    estimatedPaceString,
    timeRangeMin,
    timeRangeMax,
    officialLimitSeconds: OFFICIAL_CUTOFF_TOTAL_SEC,
    cutOffMarginKm5Min,
    cutOffMarginKm10Min,
    cutOffMarginFinishMin,
    isWithinOfficialCutOff,
    daysRemaining,
    weeksRemaining,
    nutritionPlan: {
      carbsPerHourGrams,
      hydrationMlPerHour,
      sodiumMgPerHour,
      totalCarbsGrams,
      feedingIntervalMinutes,
      gelCount,
      feedingsCount,
      officialFloatingStationsCount: 2,
    },
    mandatoryEquipment,
    wetsuitRegulation,
    worldSlotEligibility,
    strengths,
    recommendations,
    milestones,
    historicalEvolution,
  };
}

