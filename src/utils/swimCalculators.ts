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
import { getRecentCompletedTrainingWeeks, getTrainingWorkWeek } from './trainingWeeks.ts';
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
export const OFFICIAL_CUTOFF_TOTAL_SEC = 6 * 3600; // 6h 00m = 21600 seconds
export const RECOMMENDED_WEEKLY_VOLUME_METERS = 20000; // 20km/week for 14K readiness
export const RECOMMENDED_LONGEST_SWIM_METERS = 10000; // 10km benchmark test before race
export const HISTORICAL_POOL_LENGTH_CUTOFF = '2025-03-25';
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

/**
 * Calculate Distance Per Stroke (DPS) in meters per complete stroke cycle (2 arm pulls).
 * If cadence is single-arm (typically 50-80 SPM):
 * 1 complete stroke cycle = 2 arm pulls
 */
export function calculateDPS(speedMps: number, cadenceSpm: number): number {
  if (!speedMps || !cadenceSpm || cadenceSpm <= 0) return 0;
  const cycleCadence = cadenceSpm >= 45 ? cadenceSpm / 2 : cadenceSpm;
  const cyclesPerSec = cycleCadence / 60;
  const dps = speedMps / cyclesPerSec;
  return Number(dps.toFixed(2));
}

/**
 * Calculate Stroke Index (SI): SI = Speed (m/s) * DPS (m)
 * Standard hydrodynamic swimming efficiency marker (higher = more efficient)
 */
export function calculateStrokeIndex(speedMps: number, dps: number): number {
  if (!speedMps || !dps) return 0;
  return Number((speedMps * dps).toFixed(2));
}

/**
 * Calculate estimate SWOLF for a 50m pool length based on pace and DPS
 */
export function calculateSWOLF(pacePer100mSec: number, dps: number, poolLength: number = 50): number {
  if (!pacePer100mSec || !dps || dps <= 0) return 50;
  const timeForPool = (pacePer100mSec / 100) * poolLength;
  const cyclesForPool = poolLength / dps;
  // Single arm strokes = cycles * 2
  const strokesForPool = cyclesForPool * 2;
  return Math.round(timeForPool + strokesForPool);
}

export function recalculateSwimMetrics(activity: SwimActivity): SwimActivity {
  if (activity.distance <= 0 || activity.movingTime <= 0) return activity;

  const pacePer100m = activity.movingTime / activity.distance * 100;
  const speedMps = activity.distance / activity.movingTime;
  const averageCadence = activity.averageCadence || (activity.type === 'open_water' ? 62 : 64);
  const poolLength = activity.type === 'pool'
    ? activity.date.slice(0, 10) < HISTORICAL_POOL_LENGTH_CUTOFF ? 20 : activity.poolLength || 25
    : activity.poolLength ?? null;
  const dps = calculateDPS(speedMps, averageCadence);

  return {
    ...activity,
    pacePer100m: Number(pacePer100m.toFixed(1)),
    poolLength,
    averageCadence,
    totalStrokes: Math.round((activity.movingTime / 60) * averageCadence),
    dps,
    swolf: calculateSWOLF(pacePer100m, dps, activity.type === 'open_water' ? 50 : poolLength || 25),
    strokeIndex: calculateStrokeIndex(speedMps, dps),
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
 * Detect open water swims using official keyword dictionary:
 * "snl", "aigues obertes", "aguas abiertas", "oncoswim", "travesia", "travessia"
 */
export function detectOpenWater(
  activityType: string,
  title: string,
  notes?: string
): { isOpenWater: boolean; matchedTrigger?: string } {
  const normType = normalizeText(activityType);
  const normTitle = normalizeText(title);
  const normNotes = normalizeText(notes || '');
  const combined = `${normType} ${normTitle} ${normNotes}`;

  // 1. SNL (Swim Night / Natación Lago)
  if (/\b(snl|s\.n\.l)\b/.test(normTitle) || normTitle.includes('snl') || normNotes.includes('snl')) {
    return { isOpenWater: true, matchedTrigger: 'SNL' };
  }
  // 2. Aigües Obertes
  if (combined.includes('aigues obertes') || combined.includes('aiguesobertes')) {
    return { isOpenWater: true, matchedTrigger: 'Aigües Obertes' };
  }
  // 3. Aguas Abiertas
  if (combined.includes('aguas abiertas') || combined.includes('aguasabiertas')) {
    return { isOpenWater: true, matchedTrigger: 'Aguas Abiertas' };
  }
  // 4. Oncoswim
  if (combined.includes('oncoswim')) {
    return { isOpenWater: true, matchedTrigger: 'Oncoswim' };
  }
  // 5. Travessia
  if (combined.includes('travessia')) {
    return { isOpenWater: true, matchedTrigger: 'Travessia' };
  }
  // 6. Travesía
  if (combined.includes('travesia')) {
    return { isOpenWater: true, matchedTrigger: 'Travesía' };
  }
  // 7. General open water indicators
  if (
    normType.includes('open water') ||
    normType.includes('openwater') ||
    combined.includes('oceanman') ||
    combined.includes('lago') ||
    combined.includes('embalse') ||
    combined.includes('pantano') ||
    combined.includes('costa') ||
    combined.includes('playa') ||
    combined.includes('mar') ||
    combined.includes('ocean')
  ) {
    return { isOpenWater: true, matchedTrigger: 'Aguas Abiertas' };
  }

  return { isOpenWater: false };
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
  const genericTimeIdx = headers.findIndex(h => h && (
    h.includes('time') || h.includes('tiempo') || h.includes('duration')
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
  const calIdx = headers.findIndex(h => h && (h.includes('calories') || h.includes('calorías')));

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
    if (rawDist < 80) {
      rawDist = rawDist * 1000;
    }

    // Moving time & Elapsed time parsing
    let movingTime = 0;
    if (movingTimeIdx >= 0 && movingTimeIdx < cols.length) {
      movingTime = parseTimeValue(cols[movingTimeIdx]);
    }

    let elapsedTime = 0;
    if (elapsedTimeIdx >= 0 && elapsedTimeIdx < cols.length) {
      elapsedTime = parseTimeValue(cols[elapsedTimeIdx]);
    }

    if (movingTime <= 0 && genericTimeIdx >= 0 && genericTimeIdx < cols.length) {
      movingTime = parseTimeValue(cols[genericTimeIdx]);
    }

    if (movingTime <= 0) {
      movingTime = Math.round((rawDist / 100) * 100);
    }

    if (elapsedTime <= 0) {
      elapsedTime = Math.round(movingTime * 1.08);
    }

    if (elapsedTime < movingTime) {
      elapsedTime = movingTime;
    }

    const movingRatio = elapsedTime > 0 ? Number(((movingTime / elapsedTime) * 100).toFixed(1)) : 100;

    // Date safe parsing
    let actDate = new Date().toISOString().slice(0, 10);
    if (dateIdx >= 0 && dateIdx < cols.length && cols[dateIdx]) {
      const parsedDate = new Date(String(cols[dateIdx]));
      if (!isNaN(parsedDate.getTime())) {
        actDate = parsedDate.toISOString().slice(0, 10);
      }
    }

    // Elevation-based detection: Open Water swims have Elevation High / Low != 0; Pool swims have 0.0
    let elevationHigh = 0;
    if (elevationHighIdx >= 0 && elevationHighIdx < cols.length && cols[elevationHighIdx]) {
      elevationHigh = parseFloat(cols[elevationHighIdx]) || 0;
    }

    let elevationLow = 0;
    if (elevationLowIdx >= 0 && elevationLowIdx < cols.length && cols[elevationLowIdx]) {
      elevationLow = parseFloat(cols[elevationLowIdx]) || 0;
    }

    const detectedOpenWater = detectOpenWater(rawType, actTitle).isOpenWater;
    const hasOpenWaterElevation = Math.abs(elevationHigh) > 0.05 || Math.abs(elevationLow) > 0.05;
    const isOpenWater = detectedOpenWater || hasOpenWaterElevation;
    const activityType: 'open_water' | 'pool' = isOpenWater ? 'open_water' : 'pool';
    const importedPoolLength = poolLengthIdx >= 0 ? parseFloat(cols[poolLengthIdx]) : Number.NaN;
    const poolLength = activityType === 'pool'
      ? actDate < HISTORICAL_POOL_LENGTH_CUTOFF
        ? 20
        : Number.isFinite(importedPoolLength) && importedPoolLength > 0 ? importedPoolLength : 25
      : null;

    const pacePer100m = (movingTime / rawDist) * 100; // STRICTLY movingTime
    const speedMps = rawDist / movingTime;

    const baseCadence = isOpenWater ? 62 : 64;
    const avgCadence = baseCadence + Math.round((speedMps - 1.1) * 10);
    const dps = calculateDPS(speedMps, avgCadence);
    const swolf = calculateSWOLF(pacePer100m, dps, isOpenWater ? 50 : poolLength || 25);
    const strokeIndex = calculateStrokeIndex(speedMps, dps);

    const avgHr = hrIdx >= 0 ? parseInt(cols[hrIdx], 10) || undefined : undefined;
    const cal = calIdx >= 0 ? parseInt(cols[calIdx], 10) || undefined : undefined;

    parsedActivities.push({
      id: (idIdx >= 0 && cols[idIdx]) ? cols[idIdx] : `swim-${Date.now()}-${i}`,
      date: actDate,
      title: actTitle,
      type: activityType,
      distance: Math.round(rawDist),
      elapsedTime: Math.round(elapsedTime),
      movingTime: Math.round(movingTime),
      movingRatio,
      elevationHigh: Number(elevationHigh.toFixed(1)),
      elevationLow: Number(elevationLow.toFixed(1)),
      isOpenWaterDetected: isOpenWater,
      openWaterTrigger: isOpenWater ? `Aguas Abiertas (Elev: ${elevationHigh.toFixed(0)}m / ${elevationLow.toFixed(0)}m)` : 'Piscina (Elev: 0m)',
      pacePer100m: Number(pacePer100m.toFixed(1)),
      averageCadence: avgCadence,
      totalStrokes: Math.round((movingTime / 60) * avgCadence),
      dps,
      swolf,
      strokeIndex,
      avgHeartRate: avgHr,
      calories: cal || Math.round((rawDist / 100) * 28),
      poolLength,
      waterTemp: isOpenWater ? 19.5 : 27,
      hasWetsuit: isOpenWater,
      source: 'strava_csv',
    });
  }

  return parsedActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Group activities by calendar week to assess volume progression
 */
export function getWeeklyMileage(activities: SwimActivity[]): WeeklyMileage[] {
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
    const workWeek = getTrainingWorkWeek(act.date);
    if (!workWeek) continue;
    const weekKey = workWeek.key;
    const label = workWeek.label;

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
 * Calculate the 7 specific readiness checks for Oceanman 14K
 * 100% dynamic: derives all baselines, milestones, and status from the swimmer's own activities!
 */
export function evaluateReadinessChecks(
  activities: SwimActivity[],
  referenceDate: Date
): { checks: ReadinessCheckItem[]; overallScore: number; passedCount: number } {
  if (activities.length === 0) {
    return { checks: [], overallScore: 0, passedCount: 0 };
  }

  // 1. Check 1: Sesión de piscina más larga
  const poolSwims = activities.filter(a => a.type === 'pool');
  const maxPoolDistMeters = poolSwims.length > 0 ? Math.max(...poolSwims.map(a => a.distance)) : 0;
  const maxPoolKm = Number((maxPoolDistMeters / 1000).toFixed(2));
  const earliestPool = poolSwims.length > 0 ? poolSwims[poolSwims.length - 1] : null;
  const poolBaseline = earliestPool
    ? `Primera sesión: ${formatDistance(earliestPool.distance)} (${earliestPool.date}) a ${formatPace(earliestPool.pacePer100m)}`
    : 'Sin sesiones de piscina registradas todavía';

  const check1M1Passed = maxPoolKm >= 6.0;
  const check1M2Passed = maxPoolKm >= 8.0;
  const check1M3Passed = maxPoolKm >= 10.0;
  const check1Status: ReadinessCheckItem['status'] = maxPoolKm >= 8.0 ? 'passed' : maxPoolKm >= 6.0 ? 'warning' : 'pending';
  const check1Score = Math.min(100, Math.round((maxPoolKm / 10.0) * 100));

  const check1: ReadinessCheckItem = {
    id: 'check-1-pool-longest',
    checkNumber: 1,
    category: 'endurance',
    title: 'Check 1: Sesión de piscina más larga',
    shortTitle: 'Max Piscina',
    description: 'Capacidad de nado continuo en piscina para consolidar la base aeróbica y resistencia muscular.',
    baseline: poolBaseline,
    milestones: [
      { level: 'Hito 1 (Base)', label: 'Hito 1', target: '6,0 km en piscina', isCompleted: check1M1Passed },
      { level: 'Hito 2 (Consolidación)', label: 'Hito 2', target: '8,0 km en piscina', isCompleted: check1M2Passed },
      { level: 'Hito 3 (Pico Gran Fondo)', label: 'Hito 3', target: '10,0 km de test ultra', isCompleted: check1M3Passed },
    ],
    currentValue: maxPoolKm,
    targetValue: 10.0,
    currentValueFormatted: `${maxPoolKm.toFixed(2)} km`,
    targetValueFormatted: '10,0 km',
    unit: 'km',
    status: check1Status,
    score: check1Score,
    weight: 12,
    details: maxPoolKm > 0 ? `Máxima sesión en piscina registrada: ${maxPoolKm.toFixed(2)} km.` : 'Registra sesiones de piscina para activar este check.',
    summary: check1M2Passed ? 'Resistencia en piscina sobresaliente.' : check1M1Passed ? 'Hito base 6k superado.' : 'Aumenta tiradas largas en piscina.',
  };

  // 2. Check 2: Sesión de Aguas Abiertas más larga
  // Open Water strictly detected by Elevation High/Low != 0 on Activity Type = Swim
  const owSwims = activities.filter(a => a.type === 'open_water');
  const maxOwDistMeters = owSwims.length > 0 ? Math.max(...owSwims.map(a => a.distance)) : 0;
  const maxOwKm = Number((maxOwDistMeters / 1000).toFixed(2));
  const earliestOw = owSwims.length > 0 ? owSwims[owSwims.length - 1] : null;
  const owBaseline = earliestOw
    ? `Primera salida: ${formatDistance(earliestOw.distance)} (${earliestOw.date}) a ${formatPace(earliestOw.pacePer100m)}`
    : 'Sin sesiones de aguas abiertas con elevación GPS detectada';

  const check2M1Passed = maxOwKm >= 5.0;
  const check2M2Passed = maxOwKm >= 8.0;
  const check2M3Passed = maxOwKm >= 10.0;
  const check2Status: ReadinessCheckItem['status'] = maxOwKm >= 10.0 ? 'passed' : maxOwKm >= 5.0 ? 'warning' : 'pending';
  const check2Score = Math.min(100, Math.round((maxOwKm / 12.0) * 100));

  const check2: ReadinessCheckItem = {
    id: 'check-2-ow-longest',
    checkNumber: 2,
    category: 'open_water',
    title: 'Check 2: Sesión de Aguas Abiertas más larga',
    shortTitle: 'Max Aguas Abiertas',
    description: 'Tirada específica continua en aguas vivas (mar, lago o embalse) con logística de carrera.',
    baseline: owBaseline,
    milestones: [
      { level: 'Hito 1 (Iniciación mar/lago)', label: 'Hito 1', target: '5,0 km continuos con neopreno', isCompleted: check2M1Passed },
      { level: 'Hito 2 (Fondo largo)', label: 'Hito 2', target: '8,0 km en aguas abiertas', isCompleted: check2M2Passed },
      { level: 'Hito 3 (Simulacro Estrella)', label: 'Hito 3', target: '10,0 a 12,0 km continuos', isCompleted: check2M3Passed },
    ],
    currentValue: maxOwKm,
    targetValue: 12.0,
    currentValueFormatted: `${maxOwKm.toFixed(2)} km`,
    targetValueFormatted: '10,0 – 12,0 km',
    unit: 'km',
    status: check2Status,
    score: check2Score,
    weight: 15,
    details: maxOwKm > 0 ? `Tirada máxima en aguas abiertas: ${maxOwKm.toFixed(2)} km.` : 'Detectadas a partir de altitud GPS no nula.',
    summary: check2M3Passed ? 'Simulacro estrella completado.' : check2M1Passed ? 'Hito 5k superado en aguas vivas.' : 'Planifica tu primer test continuo > 5k.',
  };

  // 3. Check 3: Volumen semanal y mensual de carga
  const vol14d = getVolumeInWindowDays(activities, 14, referenceDate);
  const vol30d = getVolumeInWindowDays(activities, 30, referenceDate);
  const weeklyData = getWeeklyMileage(activities);
  const avgWeeklyKm = weeklyData.length > 0
    ? Number((weeklyData.reduce((s, w) => s + w.distanceMeters, 0) / weeklyData.length / 1000).toFixed(1))
    : 0;
  const recentWeeklyKm = Number((vol14d / 2000).toFixed(1));
  const monthlyKm = Number((vol30d / 1000).toFixed(1));

  const check3M1Passed = recentWeeklyKm >= 10.0 || monthlyKm >= 40.0;
  const check3M2Passed = recentWeeklyKm >= 15.0 || monthlyKm >= 60.0;
  const check3M3Passed = recentWeeklyKm >= 25.0 || monthlyKm >= 100.0;
  const check3Status: ReadinessCheckItem['status'] = recentWeeklyKm >= 25.0 ? 'passed' : recentWeeklyKm >= 15.0 ? 'warning' : 'pending';
  const check3Score = Math.min(100, Math.round((recentWeeklyKm / 25.0) * 100));

  const check3: ReadinessCheckItem = {
    id: 'check-3-volume-weekly-monthly',
    checkNumber: 3,
    category: 'volume',
    title: 'Check 3: Volumen semanal y mensual de carga',
    shortTitle: 'Volumen Semanal',
    description: 'Carga de entrenamiento constante para asimilar la fatiga y construir densidad mitocondrial.',
    baseline: `Promedio histórico: ${avgWeeklyKm} km/sem (Mes reciente: ${monthlyKm} km)`,
    milestones: [
      { level: 'Hito 1 (Hábito)', label: 'Hito 1', target: '10 km/semana (~40 km/mes)', isCompleted: check3M1Passed },
      { level: 'Hito 2 (Consolidación)', label: 'Hito 2', target: '15 km/semana (~60 km/mes)', isCompleted: check3M2Passed },
      { level: 'Hito 3 (Pico Gran Fondo)', label: 'Hito 3', target: '25 a 28 km/semana (~100 km/mes)', isCompleted: check3M3Passed },
    ],
    currentValue: recentWeeklyKm,
    targetValue: 25.0,
    currentValueFormatted: `${recentWeeklyKm} km/sem (${monthlyKm} km/mes)`,
    targetValueFormatted: '25 – 28 km/sem',
    unit: 'km/sem',
    status: check3Status,
    score: check3Score,
    weight: 12,
    details: `Volumen reciente: ${recentWeeklyKm} km/sem y ${monthlyKm} km en los últimos 30 días.`,
    summary: check3M3Passed ? 'Volumen pico de gran fondo alcanzado.' : check3M2Passed ? 'Volumen sólido de 15 km/semana.' : 'Incrementar gradualmente el kilometraje semanal.',
  };

  // 4. Check 4: Volumen total acumulado de la preparación
  const totalMeters = activities.reduce((sum, a) => sum + a.distance, 0);
  const totalAccumulatedKm = Number((totalMeters / 1000).toFixed(1));

  const check4M1Passed = totalAccumulatedKm >= 200.0;
  const check4M2Passed = totalAccumulatedKm >= 400.0;
  const check4M3Passed = totalAccumulatedKm >= 600.0;
  const check4Status: ReadinessCheckItem['status'] = totalAccumulatedKm >= 600.0 ? 'passed' : totalAccumulatedKm >= 350.0 ? 'warning' : 'pending';
  const check4Score = Math.min(100, Math.round((totalAccumulatedKm / 600.0) * 100));

  const check4: ReadinessCheckItem = {
    id: 'check-4-total-accumulated-volume',
    checkNumber: 4,
    category: 'volume',
    title: 'Check 4: Volumen total acumulado de la preparación',
    shortTitle: 'Volumen Acumulado',
    description: 'Kilometraje total registrado en tu historial para garantizar solidez articular y muscular.',
    baseline: `Historial importado: ${activities.length} sesiones acumuladas (${totalAccumulatedKm} km totales)`,
    milestones: [
      { level: 'Hito 1 (Base)', label: 'Hito 1', target: '200 km acumulados', isCompleted: check4M1Passed },
      { level: 'Hito 2 (Avance)', label: 'Hito 2', target: '400 km acumulados', isCompleted: check4M2Passed },
      { level: 'Hito 3 (Meta 14K)', label: 'Hito 3', target: '≥ 600 km acumulados', isCompleted: check4M3Passed },
    ],
    currentValue: totalAccumulatedKm,
    targetValue: 600.0,
    currentValueFormatted: `${totalAccumulatedKm} km`,
    targetValueFormatted: '≥ 600 km',
    unit: 'km',
    status: check4Status,
    score: check4Score,
    weight: 12,
    details: `${totalAccumulatedKm} km acumulados registrados en ${activities.length} sesiones.`,
    summary: check4M3Passed ? 'Base de volumen de más de 600 km completada.' : `Faltan ${(Math.max(0, 600 - totalAccumulatedKm)).toFixed(1)} km para la meta de 600 km.`,
  };

  // 5. Check 5: Test de Nutrición e Hidratación en Agua
  const nutritionSessions = activities.filter(a => {
    const isLongDuration = a.movingTime >= 9000; // 2h 30m = 9000s
    const notesLower = (a.notes || '').toLowerCase();
    const titleLower = a.title.toLowerCase();
    const mentionsNutrition = /avituall|nutrici|gel|boya|carbohidrat/i.test(notesLower) || /avituall|simulaci/i.test(titleLower);
    return isLongDuration || (a.distance >= 7000 && mentionsNutrition);
  });
  const nutritionCount = nutritionSessions.length;
  const check5M1Passed = nutritionCount >= 1;
  const check5M2Passed = nutritionCount >= 2;
  const check5Status: ReadinessCheckItem['status'] = nutritionCount >= 2 ? 'passed' : nutritionCount >= 1 ? 'warning' : 'pending';
  const check5Score = Math.min(100, Math.round((nutritionCount / 2) * 100));

  const check5: ReadinessCheckItem = {
    id: 'check-5-nutrition-hydration-test',
    checkNumber: 5,
    category: 'nutrition',
    title: 'Check 5: Test de Nutrición e Hidratación en Agua',
    shortTitle: 'Nutrición en Agua',
    description: 'Ensayar la toma de geles (30-60 g CH/h) y sales en agua cada 45 min sin detenerse en tierra.',
    baseline: nutritionCount > 0
      ? `${nutritionCount} sesión(es) de larga duración o con ensayo nutricional registradas`
      : 'Sin ensayos de nutrición prolongada en agua detectados',
    milestones: [
      { level: 'Hito 1 (Primer Ensayo)', label: 'Hito 1', target: '1 sesión > 2h 30m ensayando geles/sales', isCompleted: check5M1Passed },
      { level: 'Hito 2 (Validación)', label: 'Hito 2', target: '≥ 2 sesiones continuas > 3h con 30-60 g CH/hora', isCompleted: check5M2Passed },
    ],
    currentValue: nutritionCount,
    targetValue: 2,
    currentValueFormatted: `${nutritionCount} de 2 tests`,
    targetValueFormatted: '2 sesiones > 3h',
    unit: 'sesiones',
    status: check5Status,
    score: check5Score,
    weight: 8,
    details: `${nutritionCount} sesiones con protocolo de larga duración o nutrición completadas.`,
    summary: check5M2Passed ? 'Estrategia nutricional y digestiva validada.' : 'Realizar tiradas > 3h ensayando avituallamientos.',
  };

  // Compare pacing between long open-water swims; this does not infer within-session fade.
  const longOpenWaterPaces = activities
    .filter(activity => activity.type === 'open_water' && activity.distance >= 4000 && activity.movingTime > 0)
    .map(activity => activity.movingTime / activity.distance * 100);
  const meanLongPace = longOpenWaterPaces.length > 0
    ? longOpenWaterPaces.reduce((sum, pace) => sum + pace, 0) / longOpenWaterPaces.length
    : 0;
  const paceVariationPct = longOpenWaterPaces.length > 0 && meanLongPace > 0
    ? Number((Math.sqrt(longOpenWaterPaces.reduce((sum, pace) => sum + (pace - meanLongPace) ** 2, 0) / longOpenWaterPaces.length) / meanLongPace * 100).toFixed(1))
    : 0;
  const check6M1Passed = longOpenWaterPaces.length >= 3;
  const check6M2Passed = longOpenWaterPaces.length >= 5 && paceVariationPct <= 8;
  const check6Status: ReadinessCheckItem['status'] = check6M2Passed ? 'passed' : check6M1Passed ? 'warning' : 'pending';
  const check6Score = check6M1Passed ? Math.max(0, Math.min(100, Math.round(100 - paceVariationPct * 5))) : 0;

  const check6: ReadinessCheckItem = {
    id: 'check-6-long-swim-pace-consistency',
    checkNumber: 6,
    category: 'pacing',
    title: 'Consistencia de ritmo en tiradas largas',
    shortTitle: 'Ritmo en fondos',
    description: 'Compara el ritmo medio entre tiradas de aguas abiertas ≥4 km; no estima el fade dentro de cada sesión.',
    baseline: check6M1Passed
      ? `${longOpenWaterPaces.length} tiradas largas · variación entre ritmos: ${paceVariationPct}%`
      : `${longOpenWaterPaces.length} de 3 tiradas largas necesarias`,
    milestones: [
      { level: 'Hito 1', label: 'Hito 1', target: '3 tiradas ≥4 km con ritmo válido', isCompleted: check6M1Passed },
      { level: 'Hito 2', label: 'Hito 2', target: '5 tiradas y variación ≤8%', isCompleted: check6M2Passed },
    ],
    currentValue: paceVariationPct,
    targetValue: 8,
    currentValueFormatted: check6M1Passed ? `${paceVariationPct}% variación` : 'Datos insuficientes',
    targetValueFormatted: '≤ 8% entre tiradas',
    unit: '%',
    status: check6Status,
    score: check6Score,
    weight: 10,
    details: check6M1Passed
      ? `Variación calculada sobre ${longOpenWaterPaces.length} ritmos medios de tiradas ≥4 km.`
      : 'El CSV no incluye splits por largos; hacen falta al menos 3 tiradas de aguas abiertas ≥4 km.',
    summary: check6M2Passed ? 'Ritmos de fondo consistentes.' : check6M1Passed ? 'Suma más tiradas para consolidar la referencia.' : 'Aún no hay sesiones suficientes para medirlo.',
  };

  // 7. Check 7: Travesías de Competición (Simulacros Oficiales)
  const competitionSwims = activities.filter(a => {
    const isOver5k = a.distance >= 5000;
    const isOw = a.type === 'open_water';
    const isCompName = /travesia|travessia|neda el mon|marnaton|oncoswim|oceanman|illes medes|begur|competicion/i.test(a.title);
    return isOw && (isOver5k || (isCompName && a.distance >= 4000));
  });
  const compCount = competitionSwims.length;
  const check7M1Passed = compCount >= 1;
  const check7M2Passed = compCount >= 2;
  const check7Status: ReadinessCheckItem['status'] = compCount >= 2 ? 'passed' : compCount >= 1 ? 'warning' : 'pending';
  const check7Score = Math.min(100, Math.round((compCount / 2) * 100));

  const check7: ReadinessCheckItem = {
    id: 'check-7-competition-simulations',
    checkNumber: 7,
    category: 'open_water',
    title: 'Check 7: Travesías de Competición (Simulacros Oficiales)',
    shortTitle: 'Travesías Oficiales',
    description: 'Experiencia en eventos masivos oficiales (> 5 km) con boyas de giro, neopreno y avituallamiento.',
    baseline: compCount > 0
      ? `${compCount} travesía(s) en aguas abiertas de ≥ 4k registrada(s) en Strava`
      : 'Sin travesías de media/larga distancia registradas todavía',
    milestones: [
      { level: 'Hito 1 (Simulacro 1)', label: 'Hito 1', target: '1 travesía oficial de 3k – 5k completada', isCompleted: check7M1Passed },
      { level: 'Hito 2 (Simulacro 2)', label: 'Hito 2', target: '≥ 2 travesías oficiales > 5 km con neopreno', isCompleted: check7M2Passed },
    ],
    currentValue: compCount,
    targetValue: 2,
    currentValueFormatted: `${compCount} de 2 travesías`,
    targetValueFormatted: '≥ 2 travesías > 5 km',
    unit: 'eventos',
    status: check7Status,
    score: check7Score,
    weight: 12,
    details: `${compCount} travesías oficiales o eventos de larga distancia registrados.`,
    summary: check7M2Passed ? 'Experiencia competitiva previa consolidada.' : 'Programar 1-2 travesías oficiales antes de la carrera.',
  };

  const recentWorkWeeks = getRecentCompletedTrainingWeeks(referenceDate, 8);
  const recentWorkWeekKeys = new Set(recentWorkWeeks.map(week => week.key));
  const sessionCountsByWeek = new Map<string, number>();
  activities.forEach(activity => {
    const workWeek = getTrainingWorkWeek(activity.date);
    if (!workWeek || !recentWorkWeekKeys.has(workWeek.key)) return;
    sessionCountsByWeek.set(workWeek.key, (sessionCountsByWeek.get(workWeek.key) || 0) + 1);
  });
  const weeksWithThreeSessions = recentWorkWeeks.filter(week => (sessionCountsByWeek.get(week.key) || 0) >= 3).length;
  const check8Status: ReadinessCheckItem['status'] = weeksWithThreeSessions >= 6 ? 'passed' : weeksWithThreeSessions >= 4 ? 'warning' : 'pending';
  const check8Score = Math.round(weeksWithThreeSessions / 8 * 100);
  const check8: ReadinessCheckItem = {
    id: 'check-8-weekly-consistency',
    checkNumber: 8,
    category: 'volume',
    title: 'Constancia semanal',
    shortTitle: 'Constancia',
    description: 'Semanas laborales completas con tres o más sesiones de natación.',
    baseline: `${weeksWithThreeSessions} de ${recentWorkWeeks.length} semanas recientes con 3+ sesiones`,
    milestones: [
      { level: 'Hito 1', label: 'Hito 1', target: '4 de 8 semanas con 3+ sesiones', isCompleted: weeksWithThreeSessions >= 4 },
      { level: 'Hito 2', label: 'Hito 2', target: '6 de 8 semanas con 3+ sesiones', isCompleted: weeksWithThreeSessions >= 6 },
      { level: 'Hito 3', label: 'Hito 3', target: '8 de 8 semanas con 3+ sesiones', isCompleted: weeksWithThreeSessions >= 8 },
    ],
    currentValue: weeksWithThreeSessions,
    targetValue: 6,
    currentValueFormatted: `${weeksWithThreeSessions} / ${recentWorkWeeks.length} semanas`,
    targetValueFormatted: '6 de 8 semanas',
    unit: 'semanas',
    status: check8Status,
    score: check8Score,
    weight: 8,
    details: 'Una semana se cuenta de lunes a viernes; los entrenos del fin de semana no alteran esta métrica.',
    summary: check8Status === 'passed' ? 'Buena regularidad de entrenamiento.' : 'Busca mantener tres sesiones por semana.',
  };

  const longOpenWaterSwims = activities.filter(activity => activity.type === 'open_water' && activity.distance >= 3000);
  const continuousOpenWaterSwims = longOpenWaterSwims.filter(activity => {
    const movingRatio = activity.movingRatio ?? (activity.elapsedTime > 0 ? activity.movingTime / activity.elapsedTime * 100 : 100);
    return movingRatio >= 90;
  }).length;
  const openWaterContinuityPct = longOpenWaterSwims.length > 0
    ? Math.round(continuousOpenWaterSwims / longOpenWaterSwims.length * 100)
    : 0;
  const check9Status: ReadinessCheckItem['status'] = longOpenWaterSwims.length >= 4 && openWaterContinuityPct >= 80
    ? 'passed'
    : longOpenWaterSwims.length >= 2 && openWaterContinuityPct >= 60 ? 'warning' : 'pending';
  const check9: ReadinessCheckItem = {
    id: 'check-9-open-water-continuity',
    checkNumber: 9,
    category: 'open_water',
    title: 'Continuidad en aguas abiertas',
    shortTitle: 'Continuidad OW',
    description: 'Sesiones de aguas abiertas ≥3 km con al menos el 90% del tiempo en movimiento.',
    baseline: `${continuousOpenWaterSwims} de ${longOpenWaterSwims.length} sesiones largas con ≥90% de continuidad`,
    milestones: [
      { level: 'Hito 1', label: 'Hito 1', target: '2 sesiones largas · continuidad ≥60%', isCompleted: longOpenWaterSwims.length >= 2 && openWaterContinuityPct >= 60 },
      { level: 'Hito 2', label: 'Hito 2', target: '4 sesiones largas · continuidad ≥80%', isCompleted: longOpenWaterSwims.length >= 4 && openWaterContinuityPct >= 80 },
    ],
    currentValue: openWaterContinuityPct,
    targetValue: 80,
    currentValueFormatted: `${openWaterContinuityPct}% (${continuousOpenWaterSwims}/${longOpenWaterSwims.length})`,
    targetValueFormatted: '≥80% continuas',
    unit: '%',
    status: check9Status,
    score: longOpenWaterSwims.length >= 2 ? openWaterContinuityPct : 0,
    weight: 6,
    details: 'La continuidad se calcula con moving time / elapsed time; no depende del ritmo medio.',
    summary: check9Status === 'passed' ? 'Buena continuidad en aguas abiertas.' : 'Practica mantener el nado continuo en fondos.',
  };

  const longSwimsLastEightWeeks = activities.filter(activity => {
    const workWeek = getTrainingWorkWeek(activity.date);
    return Boolean(workWeek && recentWorkWeekKeys.has(workWeek.key) && activity.distance >= 5000);
  }).length;
  const check10Status: ReadinessCheckItem['status'] = longSwimsLastEightWeeks >= 4
    ? 'passed'
    : longSwimsLastEightWeeks >= 2 ? 'warning' : 'pending';
  const check10: ReadinessCheckItem = {
    id: 'check-10-repeat-long-swims',
    checkNumber: 10,
    category: 'endurance',
    title: 'Repetición de tiradas largas',
    shortTitle: 'Fondos repetidos',
    description: 'Nados de 5 km o más en las últimas ocho semanas laborales completas.',
    baseline: `${longSwimsLastEightWeeks} tiradas ≥5 km en las últimas 8 semanas`,
    milestones: [
      { level: 'Hito 1', label: 'Hito 1', target: '2 tiradas ≥5 km', isCompleted: longSwimsLastEightWeeks >= 2 },
      { level: 'Hito 2', label: 'Hito 2', target: '4 tiradas ≥5 km', isCompleted: longSwimsLastEightWeeks >= 4 },
    ],
    currentValue: longSwimsLastEightWeeks,
    targetValue: 4,
    currentValueFormatted: `${longSwimsLastEightWeeks} tiradas`,
    targetValueFormatted: '4 tiradas',
    unit: 'sesiones',
    status: check10Status,
    score: Math.min(100, Math.round(longSwimsLastEightWeeks / 4 * 100)),
    weight: 5,
    details: 'Cada sesión se cuenta una sola vez y solo si cae de lunes a viernes dentro de las ocho semanas completas.',
    summary: check10Status === 'passed' ? 'Fondos largos repetidos recientemente.' : 'Añade más sesiones largas con recuperación suficiente.',
  };

  const checks: ReadinessCheckItem[] = [
    check1,
    check2,
    check3,
    check4,
    check5,
    check6,
    check7,
    check8,
    check9,
    check10,
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const weightedScore = checks.reduce((sum, c) => sum + (c.score * c.weight), 0) / totalWeight;
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
      checkScores: Object.fromEntries(checks.map(check => [check.id, check.score])),
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
      totalChecksCount: 7,
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
  const coldWaterSessionsCount = activities.filter(a => (a.waterTemp || 25) <= 20.0).length;

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

  // Pace projection for 14,000m
  const openWaterSwims = activities.filter(a => a.type === 'open_water' && a.distance >= 3000);
  let basePaceSec = 105;
  if (openWaterSwims.length > 0) {
    basePaceSec = openWaterSwims.reduce((acc, a) => acc + a.pacePer100m, 0) / openWaterSwims.length;
  } else {
    const longerSwims = activities.filter(a => a.distance >= 2500);
    if (longerSwims.length > 0) {
      basePaceSec = (longerSwims.reduce((acc, a) => acc + a.pacePer100m, 0) / longerSwims.length) * 1.05;
    }
  }

  const racePaceFactor = 1.035 * 1.045 * 0.97;
  const estimatedPacePer100mSec = Math.round(basePaceSec * racePaceFactor);
  const estimatedFinishTimeSec = Math.round(estimatedPacePer100mSec * (OCEANMAN_DISTANCE_METERS / 100));

  const estimatedFinishTimeString = formatDuration(estimatedFinishTimeSec);
  const estimatedPaceString = formatPace(estimatedPacePer100mSec);

  const minTimeSec = Math.round(estimatedFinishTimeSec * 0.96);
  const maxTimeSec = Math.round(estimatedFinishTimeSec * 1.06);
  const timeRangeMin = formatDuration(minTimeSec);
  const timeRangeMax = formatDuration(maxTimeSec);

  const totalHours = estimatedFinishTimeSec / 3600;
  const carbsPerHourGrams = 75;
  const hydrationMlPerHour = 650;
  const sodiumMgPerHour = 550;
  const totalCarbsGrams = Math.round(totalHours * carbsPerHourGrams);
  const feedingIntervalMinutes = 35;
  const feedingsCount = Math.max(3, Math.floor((estimatedFinishTimeSec / 60) / feedingIntervalMinutes));
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

  const cutOffMarginKm5Min = Math.max(0, 135 - estKm5Min); // Limit: 2h 15m = 135 min
  const cutOffMarginKm10Min = Math.max(0, 270 - estKm10Min); // Limit: 4h 30m = 270 min
  const cutOffMarginFinishMin = Math.max(0, 360 - estFinishMin); // Limit: 6h 00m = 360 min
  const isWithinOfficialCutOff = estimatedFinishTimeSec <= OFFICIAL_CUTOFF_TOTAL_SEC;

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
      estimatedPassingTime: formatDuration(Math.round(estimatedPacePer100mSec * 50)),
      estimatedClockTime: getClockFromSec(estimatedPacePer100mSec * 50),
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
      estimatedPassingTime: formatDuration(Math.round(estimatedPacePer100mSec * 85)),
      estimatedClockTime: getClockFromSec(estimatedPacePer100mSec * 85),
      nutritionAdvice: 'Autonomía personal: 1 gel tomado desde el compartimento estanco de tu boya de seguridad.',
      isFeedStation: false,
      isCutOffPoint: false,
    },
    {
      km: 10.0,
      label: 'Punto de Corte 2 & Estación Flotante #2 (Buccione)',
      description: 'Tramo decisivo hacia el golfo sur. Segunda y última estación oficial flotante. Tiempo de corte estricto.',
      estimatedPassingTime: formatDuration(Math.round(estimatedPacePer100mSec * 100)),
      estimatedClockTime: getClockFromSec(estimatedPacePer100mSec * 100),
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
      estimatedClockTime: getClockFromSec(estimatedFinishTimeSec),
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
    totalChecksCount: checks.length,
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

export interface OrtaFeedStationAnalysis {
  stationIndex: 1 | 2;
  km: number;
  name: string;
  officialCutOffSec: number;
  officialCutOffString: string;
  officialCutOffClock: string;

  // Projected arrival & departure
  estimatedArrivalSec: number;
  estimatedArrivalClock: string;
  marginBeforeCutoffMin: number;
  isCutoffSafe: boolean;

  // Dynamic Pause & Rest Model
  recommendedPauseSec: number;
  recommendedPauseString: string;
  fatigueIndexPct: number; // 0 - 100%
  glycogenDepletionPct: number; // estimated % burned
  strokeCountAtArrival: number;
  thermalExposureHours: number;
  restDescription: string;
  nutritionAction: string;
}

export interface OrtaRaceTimeBreakdown {
  effectivePaceSec: number;
  effectiveDistanceMeters: number;
  pureSwimMovingSec: number;
  pureSwimMovingString: string;
  station1PauseSec: number;
  station2PauseSec: number;
  totalRestPauseSec: number;
  totalOfficialRaceSec: number;
  totalOfficialRaceString: string;
  officialCutoffSec: number; // 21600 (6h)
  finishMarginMin: number;
  isWithinOfficialCutoff: boolean;
  station1: OrtaFeedStationAnalysis;
  station2: OrtaFeedStationAnalysis;
}

/**
 * Dynamic calculation of the official Oceanman 14K Lago d'Orta race strategy:
 * Exactly 2 official floating feed stations: Km 5.0 (Ronco) and Km 10.0 (Buccione).
 * Models dynamic rest pauses based on pace, fatigue accumulation, and lake conditions.
 */
export function calculateOrtaFeedPauses(
  basePacePer100mSec: number,
  wetsuit: boolean = true,
  sightingStrokes: number = 6,
  lakeCondition: 'calm' | 'light_chop' | 'headwind' = 'calm',
  swimmerFatigueTolerance: 'high' | 'medium' | 'conservative' = 'medium'
): OrtaRaceTimeBreakdown {
  // Environmental modifiers
  const wetsuitMod = wetsuit ? 0 : 4.5;
  let surfacePenaltySec = 0;
  if (lakeCondition === 'light_chop') surfacePenaltySec = 2.0;
  else if (lakeCondition === 'headwind') surfacePenaltySec = 4.5;

  let sightingPenaltyPct = 3.5;
  if (sightingStrokes === 4) sightingPenaltyPct = 2.0;
  else if (sightingStrokes === 6) sightingPenaltyPct = 3.5;
  else if (sightingStrokes === 8) sightingPenaltyPct = 5.0;
  else if (sightingStrokes === 12) sightingPenaltyPct = 7.5;

  const effectivePaceSec = Math.round(basePacePer100mSec + wetsuitMod + surfacePenaltySec);
  const effectiveDistanceMeters = Math.round(14000 * (1 + sightingPenaltyPct / 100));
  const pureSwimMovingSec = Math.round((effectiveDistanceMeters / 100) * effectivePaceSec);

  // Station 1: Km 5.0 (Ronco)
  const distKm5 = 5000 * (1 + sightingPenaltyPct / 100);
  const swimSecKm5 = Math.round((distKm5 / 100) * effectivePaceSec);
  const arrivalKm5Sec = swimSecKm5;
  const cutoffKm5Sec = 2 * 3600 + 15 * 60; // 2h 15m (11:45 AM)
  const marginKm5Min = Math.round((cutoffKm5Sec - arrivalKm5Sec) / 60);

  // Dynamic pause model for Station 1:
  // Swimmer has covered ~35% of race. Moderate fatigue.
  let pauseStation1Sec = 45;
  if (effectivePaceSec < 95) pauseStation1Sec += 15;
  if (lakeCondition === 'headwind') pauseStation1Sec += 15;
  if (swimmerFatigueTolerance === 'conservative') pauseStation1Sec += 20;

  // Station 2: Km 10.0 (Buccione)
  const distKm10 = 10000 * (1 + sightingPenaltyPct / 100);
  const swimSecKm10 = Math.round((distKm10 / 100) * effectivePaceSec);
  // Arrival at Station 2 includes Station 1 pause
  const arrivalKm10Sec = swimSecKm10 + pauseStation1Sec;
  const cutoffKm10Sec = 4 * 3600 + 30 * 60; // 4h 30m (02:00 PM)
  const marginKm10Min = Math.round((cutoffKm10Sec - arrivalKm10Sec) / 60);

  // Dynamic pause model for Station 2:
  // Swimmer has swum 10 km continuously (2h45 - 3h30). Thermal stress, shoulder fatigue, glycogen dropping.
  let pauseStation2Sec = 90;
  if (effectivePaceSec < 95) pauseStation2Sec += 20;
  if (!wetsuit) pauseStation2Sec += 25; // Cold water thermal stress without neoprene
  if (lakeCondition === 'headwind') pauseStation2Sec += 20;
  if (swimmerFatigueTolerance === 'conservative') pauseStation2Sec += 35;

  // Total Official Race Time
  const totalRestPauseSec = pauseStation1Sec + pauseStation2Sec;
  const totalOfficialRaceSec = pureSwimMovingSec + totalRestPauseSec;
  const cutoffFinishSec = 6 * 3600; // 6h 00m (03:30 PM)
  const finishMarginMin = Math.round((cutoffFinishSec - totalOfficialRaceSec) / 60);

  const formatClock = (secondsFromStart: number) => {
    const totalMinutes = 9 * 60 + 30 + Math.round(secondsFromStart / 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  const station1: OrtaFeedStationAnalysis = {
    stationIndex: 1,
    km: 5.0,
    name: "Estación Flotante #1 (Ronco - Canal Central)",
    officialCutOffSec: cutoffKm5Sec,
    officialCutOffString: "2h 15min",
    officialCutOffClock: "11:45 AM",
    estimatedArrivalSec: arrivalKm5Sec,
    estimatedArrivalClock: formatClock(arrivalKm5Sec),
    marginBeforeCutoffMin: marginKm5Min,
    isCutoffSafe: marginKm5Min > 0,
    recommendedPauseSec: pauseStation1Sec,
    recommendedPauseString: formatDuration(pauseStation1Sec),
    fatigueIndexPct: 38,
    glycogenDepletionPct: 32,
    strokeCountAtArrival: Math.round((swimSecKm5 / 60) * 62),
    thermalExposureHours: Number((arrivalKm5Sec / 3600).toFixed(1)),
    restDescription: `Pausa calculada de ${pauseStation1Sec}s para hidratación con electrolitos y absorción de hidrogel sin elevar la frecuencia cardíaca.`,
    nutritionAction: "Hidrogel 40g carbohidratos + 200ml sales isotónicas",
  };

  const station2: OrtaFeedStationAnalysis = {
    stationIndex: 2,
    km: 10.0,
    name: "Estación Flotante #2 (Buccione - Golfo Sur)",
    officialCutOffSec: cutoffKm10Sec,
    officialCutOffString: "4h 30min",
    officialCutOffClock: "02:00 PM",
    estimatedArrivalSec: arrivalKm10Sec,
    estimatedArrivalClock: formatClock(arrivalKm10Sec),
    marginBeforeCutoffMin: marginKm10Min,
    isCutoffSafe: marginKm10Min > 0,
    recommendedPauseSec: pauseStation2Sec,
    recommendedPauseString: formatDuration(pauseStation2Sec),
    fatigueIndexPct: 76,
    glycogenDepletionPct: 68,
    strokeCountAtArrival: Math.round((swimSecKm10 / 60) * 62),
    thermalExposureHours: Number((arrivalKm10Sec / 3600).toFixed(1)),
    restDescription: `Pausa estratégica de ${formatDuration(pauseStation2Sec)}. Recuperación muscular de dorsales, cafeína para el SNC y recolocación de gafas previo a los 4 km finales.`,
    nutritionAction: "Gel con cafeína (100mg) + 250ml isotónico + cápsula de sodio",
  };

  return {
    effectivePaceSec,
    effectiveDistanceMeters,
    pureSwimMovingSec,
    pureSwimMovingString: formatDuration(pureSwimMovingSec),
    station1PauseSec: pauseStation1Sec,
    station2PauseSec: pauseStation2Sec,
    totalRestPauseSec,
    totalOfficialRaceSec,
    totalOfficialRaceString: formatDuration(totalOfficialRaceSec),
    officialCutoffSec: cutoffFinishSec,
    finishMarginMin,
    isWithinOfficialCutoff: finishMarginMin >= 0,
    station1,
    station2,
  };
}
