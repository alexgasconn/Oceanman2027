import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPace,
  formatDuration,
  formatDistance,
  findPaceOutlierIds,
  calculateDPS,
  calculateStrokeIndex,
  calculateSWOLF,
  parseStravaCsv,
  recalculateSwimMetrics,
  getCalendarWeeklyMileage,
  getWeeklyMileage,
  evaluateReadinessChecks,
  calculateOceanmanReadiness,
  calculateHistoricalReadiness,
} from './swimCalculators.ts';
import { SwimActivity } from '../types/swim.ts';

test('formatPace formats seconds correctly', () => {
  assert.equal(formatPace(95), '1:35/100m');
  assert.equal(formatPace(60), '1:00/100m');
  assert.equal(formatPace(102.4), '1:42/100m');
  assert.equal(formatPace(0), '--:--');
});

test('formatDuration handles hours, minutes and seconds', () => {
  assert.equal(formatDuration(3665), '1h 01m 05s');
  assert.equal(formatDuration(2540), '42m 20s');
  assert.equal(formatDuration(0), '0m 00s');
});

test('formatDistance formats meters and kilometers', () => {
  assert.equal(formatDistance(14000), '14.0 km');
  assert.equal(formatDistance(3200), '3.200 m');
  assert.equal(formatDistance(3200, 'km'), '3.2 km');
});

test('findPaceOutlierIds flags only extreme fast and slow paces', () => {
  const activities: SwimActivity[] = [70, 99, 100, 101, 102, 103, 190].map((pace, index) => ({
    id: `pace-${index}`,
    date: '2026-10-01',
    title: `Swim ${index}`,
    type: 'open_water',
    distance: 3000,
    elapsedTime: pace * 30,
    movingTime: pace * 30,
    pacePer100m: pace,
    source: 'strava_csv',
  }));

  assert.deepEqual(findPaceOutlierIds(activities), ['pace-0', 'pace-6']);
  assert.deepEqual(findPaceOutlierIds(activities.slice(0, 4)), []);
});

test('calculateDPS computes distance per stroke properly', () => {
  // Speed: 1.25 m/s, Cadence: 60 spm (30 cycles/min) -> 0.5 cycles/sec -> DPS = 1.25 / 0.5 = 2.50m
  const dps = calculateDPS(1.25, 60);
  assert.equal(dps, 2.5);

  // If cadence is stroke cycle (30 cpm -> 0.5 cycles/sec), speed 1.5 m/s -> DPS = 3.0m
  const dpsCycle = calculateDPS(1.5, 30);
  assert.equal(dpsCycle, 3.0);
});

test('calculateStrokeIndex computes speed * DPS', () => {
  const si = calculateStrokeIndex(1.4, 1.8);
  assert.equal(si, 2.52);
});

test('calculateSWOLF calculates reasonable score', () => {
  const swolf = calculateSWOLF(100, 1.8, 50); // 1:40/100m in 50m pool = 50s + 56 strokes ≈ 106
  assert.ok(swolf >= 95 && swolf <= 115);
});

test('recalculateSwimMetrics uses a 20m pool before 2025-03-25 only', () => {
  const baseActivity: SwimActivity = {
    id: 'pool-history',
    date: '2025-03-24',
    title: 'Pool history',
    type: 'pool',
    distance: 2500,
    elapsedTime: 2100,
    movingTime: 2000,
    pacePer100m: 100,
    averageCadence: 64,
    dps: 1.8,
    swolf: 100,
    poolLength: 25,
    source: 'strava_csv',
  };

  const corrected = recalculateSwimMetrics(baseActivity);
  const currentPool = recalculateSwimMetrics({ ...baseActivity, date: '2025-03-25', poolLength: 50 });
  const migratedLegacyPool = recalculateSwimMetrics({ ...baseActivity, poolLength: 20 });
  const misclassifiedTitle = recalculateSwimMetrics({
    ...baseActivity,
    date: '2026-10-20',
    title: "Road to Lago d'Orta",
    type: 'open_water',
    elevationHigh: 0,
    elevationLow: 0,
  });
  const elevationDetected = recalculateSwimMetrics({
    ...baseActivity,
    date: '2026-10-20',
    type: 'pool',
    elevationHigh: 4,
    elevationLow: -2,
  });

  assert.equal(corrected.poolLength, 20);
  assert.equal(corrected.distance, 2000);
  assert.equal(corrected.pacePer100m, 100);
  assert.equal(corrected.swolf, calculateSWOLF(corrected.pacePer100m, corrected.dps || 0, 20));
  const correctedAgain = recalculateSwimMetrics(corrected);
  assert.equal(correctedAgain.distance, 2000);
  assert.equal(correctedAgain.pacePer100m, 100);
  assert.equal(migratedLegacyPool.distance, 2000);
  assert.equal(migratedLegacyPool.pacePer100m, 100);
  assert.equal(misclassifiedTitle.type, 'pool');
  assert.equal(elevationDetected.type, 'open_water');
  assert.equal(currentPool.poolLength, 50);
  assert.equal(currentPool.distance, 2500);
  assert.equal(currentPool.pacePer100m, 80);
  assert.equal(currentPool.swolf, calculateSWOLF(currentPool.pacePer100m, currentPool.dps || 0, 50));
});

test('parseStravaCsv parses CSV format into valid swim activities', () => {
  const sampleCsv = `Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Moving Time,Distance,Average Heart Rate,Elevation High,Elevation Low
1001,"2026-08-15 08:30:00","Entreno Travesía Mar Costa Brava",Swim,3900,3600,3500,138,0,0
1002,"2026-08-18 19:00:00","Series Umbral 100m Piscina 50m",Swim,3200,2800,2500,145,0,0
1003,"2026-08-20 10:00:00","Tirada Larga Lago",Swim,7200,6800,6000,140,4,-2
1004,"2026-08-22 09:00:00","Rodaje Suave Bici",Ride,3600,3600,30000,120,0,0`;

  const parsed = parseStravaCsv(sampleCsv);
  assert.equal(parsed.length, 3); // 3 swims, ignoring the bike ride

  const openWater = parsed.find(a => a.id === '1003');
  const titledLikeOpenWater = parsed.find(a => a.id === '1001');
  assert.ok(openWater);
  assert.equal(openWater?.type, 'open_water');
  assert.equal(titledLikeOpenWater?.type, 'pool');
  assert.equal(openWater?.distance, 6000);
  assert.ok(openWater?.pacePer100m && openWater.pacePer100m > 0);
  assert.ok(openWater?.dps && openWater.dps > 0);
});

test('parseStravaCsv does not infer open water from a lake title without elevation change', () => {
  const csv = `Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Moving Time,Distance,Elevation High,Elevation Low
lake,2026-10-01,"Road to Lago d'Orta",Swim,2400,2300,2000,0,0
climb,2026-10-02,Pool name with noise,Swim,2400,2300,2000,1.0,0.2`;

  const parsed = parseStravaCsv(csv);

  assert.equal(parsed.find(activity => activity.id === 'lake')?.type, 'pool');
  assert.equal(parsed.find(activity => activity.id === 'climb')?.type, 'pool');
});

test('parseStravaCsv uses recorded pool length to distinguish low-elevation open water', () => {
  const csv = `Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Moving Time,Distance,Pool Length,Elevation High,Elevation Low
open-water,2026-10-01,Open water,Swim,2400,2300,2000,,182.8,182.8
pool,2026-10-02,Pool session,Swim,2400,2300,2000,25,3.3,0.6
old-pool,2024-10-03,Old pool,Swim,2400,2300,2000,,0,0`;

  const parsed = parseStravaCsv(csv);

  assert.equal(parsed.find(activity => activity.id === 'open-water')?.type, 'open_water');
  assert.equal(parsed.find(activity => activity.id === 'pool')?.type, 'pool');
  assert.equal(parsed.find(activity => activity.id === 'old-pool')?.type, 'pool');
});

test('parseStravaCsv preserves commas, apostrophes, escaped quotes, and multiline cells', () => {
  const csv = `Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Moving Time,Distance
501,"Oct 26, 2026, 6:18:12 AM","Travesía d'Orta, tramo ""norte""",Swim,"nota con, coma
segunda línea",3000,2600,"2,000"`;

  const parsed = parseStravaCsv(csv);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, "Travesía d'Orta, tramo \"norte\"");
  assert.equal(parsed[0].distance, 2000);
  assert.equal(parsed[0].movingTime, 2600);
});

test('parseStravaCsv recalculates historical pool SWOLF with 20m length', () => {
  const csv = `Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Moving Time,Distance,Pool Length
old,2025-03-24,Old pool,Swim,2100,2000,2000,25
current,2025-03-25,Current pool,Swim,2100,2000,2000,50`;

  const parsed = parseStravaCsv(csv);
  const oldPool = parsed.find(activity => activity.id === 'old');
  const currentPool = parsed.find(activity => activity.id === 'current');

  assert.equal(oldPool?.poolLength, 20);
  assert.equal(oldPool?.distance, 1600);
  assert.equal(oldPool?.pacePer100m, 125);
  assert.equal(oldPool?.poolDistanceCorrection, 'historical-20m');
  assert.equal(oldPool?.swolf, calculateSWOLF(oldPool!.pacePer100m, oldPool!.dps || 0, 20));
  assert.equal(currentPool?.poolLength, 50);
  assert.equal(currentPool?.distance, 2000);
  assert.equal(currentPool?.pacePer100m, 100);
  assert.equal(currentPool?.swolf, calculateSWOLF(currentPool!.pacePer100m, currentPool!.dps || 0, 50));
});

test('getWeeklyMileage groups swimming volume by week', () => {
  const activities: SwimActivity[] = [
    {
      id: '1',
      date: '2026-08-10',
      title: 'Sesion 1',
      type: 'pool',
      distance: 3000,
      elapsedTime: 3200,
      movingTime: 3000,
      pacePer100m: 100,
      source: 'strava_csv',
    },
    {
      id: '2',
      date: '2026-08-12',
      title: 'Sesion 2',
      type: 'open_water',
      distance: 4000,
      elapsedTime: 4200,
      movingTime: 4000,
      pacePer100m: 100,
      source: 'strava_csv',
    },
  ];

  const weekly = getWeeklyMileage(activities);
  assert.equal(weekly.length, 1);
  assert.equal(weekly[0].distanceMeters, 7000);
  assert.equal(weekly[0].sessionsCount, 2);
  assert.equal(weekly[0].poolDistanceKm, 3);
  assert.equal(weekly[0].openWaterDistanceKm, 4);
});

test('getWeeklyMileage groups Monday to Friday and excludes weekend swims', () => {
  const activities: SwimActivity[] = [
    { id: 'mon', date: '2026-10-26', title: 'Monday', type: 'pool', distance: 1000, elapsedTime: 600, movingTime: 600, pacePer100m: 60, source: 'strava_csv' },
    { id: 'fri', date: '2026-10-30', title: 'Friday', type: 'open_water', distance: 2000, elapsedTime: 1200, movingTime: 1200, pacePer100m: 60, source: 'strava_csv' },
    { id: 'sat', date: '2026-10-31', title: 'Saturday', type: 'pool', distance: 3000, elapsedTime: 1800, movingTime: 1800, pacePer100m: 60, source: 'strava_csv' },
    { id: 'sun', date: '2026-11-01', title: 'Sunday', type: 'pool', distance: 4000, elapsedTime: 2400, movingTime: 2400, pacePer100m: 60, source: 'strava_csv' },
  ];

  const weekly = getWeeklyMileage(activities);
  assert.equal(weekly.length, 1);
  assert.equal(weekly[0].weekKey, '2026-10-26');
  assert.equal(weekly[0].distanceMeters, 3000);
  assert.equal(weekly[0].sessionsCount, 2);
});

test('getCalendarWeeklyMileage includes open-water swims on weekends', () => {
  const activities: SwimActivity[] = [
    { id: 'fri', date: '2026-10-30', title: 'Friday', type: 'pool', distance: 2000, elapsedTime: 1200, movingTime: 1200, pacePer100m: 60, source: 'strava_csv' },
    { id: 'sat', date: '2026-10-31', title: 'Saturday', type: 'open_water', distance: 4000, elapsedTime: 2400, movingTime: 2400, pacePer100m: 60, source: 'strava_csv' },
    { id: 'sun', date: '2026-11-01', title: 'Sunday', type: 'open_water', distance: 3000, elapsedTime: 1800, movingTime: 1800, pacePer100m: 60, source: 'strava_csv' },
  ];

  const weekly = getCalendarWeeklyMileage(activities);
  assert.equal(weekly.length, 1);
  assert.equal(weekly[0].weekKey, '2026-10-26');
  assert.equal(weekly[0].distanceMeters, 9000);
  assert.equal(weekly[0].openWaterDistanceKm, 7);
});

test('calculateOceanmanReadiness computes readiness score and projections', () => {
  const testDate = new Date('2026-10-24T12:00:00Z');
  const activities: SwimActivity[] = [
    {
      id: '1',
      date: '2026-10-10',
      title: 'Test 10k Ultra',
      type: 'open_water',
      distance: 10000,
      elapsedTime: 11000,
      movingTime: 10500, // 105s / 100m = 1:45
      pacePer100m: 105,
      averageCadence: 64,
      dps: 1.85,
      waterTemp: 19.0,
      source: 'strava_csv',
    },
    {
      id: '2',
      date: '2026-10-15',
      title: 'Piscina Aeróbica',
      type: 'pool',
      distance: 4000,
      elapsedTime: 4200,
      movingTime: 4000,
      pacePer100m: 100,
      averageCadence: 66,
      dps: 1.8,
      source: 'strava_csv',
    },
  ];

  const readiness = calculateOceanmanReadiness(activities, testDate);
  assert.ok(readiness.overallScore > 0);
  assert.ok(readiness.daysRemaining > 0);
  assert.equal(readiness.longestSwimMeters, 10000);
  assert.equal(readiness.checks.length, 5);
  assert.ok(readiness.historicalEvolution.length > 0);
  assert.ok(readiness.estimatedFinishTimeSec > 0);
});

test('readiness has five measurable weighted checks', () => {
  const activities: SwimActivity[] = [
    { id: 'ow-1', date: '2026-10-12', title: 'Long open water', type: 'open_water', distance: 5000, elapsedTime: 5200, movingTime: 5000, pacePer100m: 100, source: 'strava_csv' },
    { id: 'pool-1', date: '2026-10-14', title: 'Pool', type: 'pool', distance: 3000, elapsedTime: 3100, movingTime: 3000, pacePer100m: 100, source: 'strava_csv' },
  ];

  const { checks } = evaluateReadinessChecks(activities, new Date('2026-10-26T12:00:00'));
  assert.equal(checks.length, 5);
  assert.equal(checks.reduce((sum, check) => sum + check.weight, 0), 100);
  assert.deepEqual(checks.map(check => check.id), [
    'check-1-pool-longest',
    'check-2-ow-longest',
    'check-3-volume-weekly-monthly',
    'check-4-open-water-continuity',
    'check-5-weekly-consistency',
  ]);
});

test('calculateHistoricalReadiness produces chronological points with progression', () => {
  const activities: SwimActivity[] = [
    { id: '1', date: '2026-06-01', title: 'S1', type: 'pool', distance: 3000, elapsedTime: 3000, movingTime: 3000, pacePer100m: 100, source: 'strava_csv' },
    { id: '2', date: '2026-07-01', title: 'S2', type: 'open_water', distance: 5000, elapsedTime: 5000, movingTime: 5000, pacePer100m: 100, source: 'strava_csv' },
    { id: '3', date: '2026-08-01', title: 'S3', type: 'open_water', distance: 8000, elapsedTime: 8000, movingTime: 8000, pacePer100m: 100, source: 'strava_csv' },
  ];

  const points = calculateHistoricalReadiness(activities, 'monthly');
  assert.equal(points.length, 3);
  assert.ok(points[0].readinessScore <= points[2].readinessScore);
  assert.ok(points[2].longestSwimKm >= 8);
  assert.equal(typeof points[2].checkScores?.['check-5-weekly-consistency'], 'number');
});
