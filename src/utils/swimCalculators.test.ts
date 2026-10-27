import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatPace,
  formatDuration,
  formatDistance,
  findPaceOutlierIds,
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

test('recalculateSwimMetrics corrects historical 25m recordings once and clears unrecorded stroke metrics', () => {
  const baseActivity: SwimActivity = {
    id: 'pool-history',
    date: '2025-03-24',
    title: 'Pool history',
    type: 'pool',
    distance: 2500,
    elapsedTime: 2100,
    hasRecordedElapsedTime: true,
    movingTime: 2000,
    hasRecordedMovingTime: true,
    pacePer100m: 100,
    averageCadence: 64,
    dps: 1.8,
    swolf: 100,
    poolLength: 25,
    hasPoolLength: true,
    source: 'strava_csv',
  };

  const recorded20m = recalculateSwimMetrics({ ...baseActivity, date: '2024-03-24', poolLength: 20 });
  const recorded25m = recalculateSwimMetrics({ ...baseActivity, date: '2024-03-24', poolLength: 25 });
  const unknownType = recalculateSwimMetrics({ ...baseActivity, poolLength: null, hasPoolLength: false, elevationHigh: 0, elevationLow: 0 });
  const elevationDetected = recalculateSwimMetrics({
    ...baseActivity,
    date: '2026-10-20',
    hasPoolLength: false,
    poolLength: null,
    elevationHigh: 4,
    elevationLow: -2,
  });

  assert.equal(recorded20m.poolLength, 20);
  assert.equal(recorded20m.distance, 2500);
  assert.equal(recorded20m.pacePer100m, 80);
  assert.equal(recorded20m.averageCadence, undefined);
  assert.equal(recorded20m.dps, undefined);
  assert.equal(recorded20m.swolf, undefined);
  assert.equal(recorded25m.poolLength, 20);
  assert.equal(recorded25m.distance, 2000);
  assert.equal(recorded25m.pacePer100m, 100);
  assert.equal(recorded25m.poolDistanceCorrection, 'historical-20m');
  assert.deepEqual(recalculateSwimMetrics(recorded25m), recorded25m);
  assert.equal(unknownType.type, 'pool');
  assert.equal(unknownType.distance, 2000);
  assert.equal(unknownType.pacePer100m, 100);
  assert.equal(elevationDetected.type, 'open_water');
});

test('parseStravaCsv classifies only explicit pool length and GPS evidence', () => {
  const sampleCsv = `Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Moving Time,Distance,Pool Length,Average Heart Rate,Elevation High,Elevation Low
1001,"2026-08-15 08:30:00","Entreno Travesía Mar Costa Brava",Swim,3900,3600,3500,25,138,0,0
1002,"2026-08-18 19:00:00","Series Umbral 100m Piscina 50m",Swim,3200,2800,2500,50,145,0,0
1003,"2026-08-20 10:00:00","Tirada Larga Lago",Swim,7200,6800,6000,,140,4,-2
1004,"2026-08-22 09:00:00","Rodaje Suave Bici",Ride,3600,3600,30000,,120,0,0`;

  const parsed = parseStravaCsv(sampleCsv);
  assert.equal(parsed.length, 3); // 3 swims, ignoring the bike ride

  const openWater = parsed.find(a => a.id === '1003');
  const titledLikeOpenWater = parsed.find(a => a.id === '1001');
  assert.ok(openWater);
  assert.equal(openWater?.type, 'open_water');
  assert.equal(titledLikeOpenWater?.type, 'pool');
  assert.equal(openWater?.distance, 6000);
  assert.ok(openWater?.pacePer100m && openWater.pacePer100m > 0);
  assert.equal(openWater?.dps, undefined);
  assert.equal(parsed.find(a => a.id === '1002')?.poolLength, 50);
});

test('parseStravaCsv defaults to pool without pool length or GPS evidence', () => {
  const csv = `Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Moving Time,Distance,Pool Length,Elevation High,Elevation Low
lake,2026-10-01,"Road to Lago d'Orta",Swim,2400,2300,2000,,0,0
pool,2026-10-02,Pool name with noise,Swim,2400,2300,2000,25,1.0,0.2`;

  const parsed = parseStravaCsv(csv);

  assert.equal(parsed.find(activity => activity.id === 'lake')?.type, 'pool');
  assert.equal(parsed.find(activity => activity.id === 'pool')?.type, 'pool');
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
  assert.equal(parsed.find(activity => activity.id === 'old-pool')?.distance, 1600);
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

test('parseStravaCsv preserves recorded swim cadence and local start time', () => {
  const csv = `Activity ID,Activity Date,Activity Name,Activity Type,Moving Time,Distance,Pool Length,Average Cadence
cadence,"Oct 26, 2026, 6:18:12 AM",Morning swim,Swim,1200,1000,25,22`;

  const parsed = parseStravaCsv(csv);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].averageCadence, 22);
  assert.equal(parsed[0].hasRecordedCadence, true);
  assert.equal(parsed[0].startedAt, '2026-10-26T06:18:12');
});

test('parseStravaCsv imports explicit cycle, stroke, SWOLF and SPL columns separately', () => {
  const csv = `Activity ID,Activity Date,Activity Name,Activity Type,Moving Time,Elapsed Time,Distance,Pool Length,Total Cycles,Total Strokes,SWOLF,SPL
lap-data,"Oct 26, 2026",Pool,Swim,600,700,500,25,48,96,72,24`;

  const activity = parseStravaCsv(csv)[0];

  assert.equal(activity.totalCycles, 48);
  assert.equal(activity.totalStrokes, 96);
  assert.equal(activity.swolf, 72);
  assert.equal(activity.hasRecordedSwolf, true);
  assert.equal(activity.strokesPerLength, 24);
  assert.equal(activity.hasRecordedSpl, true);
});

test('parseStravaCsv leaves pace and moving ratio unavailable when source times are missing', () => {
  const csv = `Activity ID,Activity Date,Activity Name,Activity Type,Distance,Pool Length
no-times,"Oct 26, 2026",Pool,Swim,1000,25`;

  const activity = parseStravaCsv(csv)[0];

  assert.equal(activity.movingTime, 0);
  assert.equal(activity.elapsedTime, 0);
  assert.equal(activity.pacePer100m, 0);
  assert.equal(activity.movingRatio, undefined);
  assert.equal(activity.averageCadence, undefined);
  assert.equal(activity.swolf, undefined);
});

test('activities.csv does not create SWOLF or SPL when those columns are absent', () => {
  const csv = readFileSync(new URL('../../data/activities.csv', import.meta.url), 'utf8');
  const activities = parseStravaCsv(csv);

  assert.ok(activities.length > 0);
  assert.equal(activities.filter(activity => activity.hasRecordedSwolf).length, 0);
  assert.equal(activities.filter(activity => activity.hasRecordedSpl).length, 0);
  assert.equal(activities.filter(activity => activity.totalCycles !== undefined).length, 0);
});

test('parseStravaCsv corrects historical distance and pace strictly before March 25 without deriving SWOLF', () => {
  const csv = `Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Moving Time,Distance,Pool Length
old,2025-03-24,Old pool,Swim,2100,2000,2000,25
current,2025-03-25,Current pool,Swim,2100,2000,2000,25`;

  const parsed = parseStravaCsv(csv);
  const oldPool = parsed.find(activity => activity.id === 'old');
  const currentPool = parsed.find(activity => activity.id === 'current');

  assert.equal(oldPool?.poolLength, 20);
  assert.equal(oldPool?.distance, 1600);
  assert.equal(oldPool?.pacePer100m, 125);
  assert.equal(oldPool?.swolf, undefined);
  assert.equal(currentPool?.poolLength, 25);
  assert.equal(currentPool?.distance, 2000);
  assert.equal(currentPool?.pacePer100m, 100);
  assert.equal(currentPool?.swolf, undefined);
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

test('calculateOceanmanReadiness projects a 14k pace slower than the training pace', () => {
  const testDate = new Date('2026-10-24T12:00:00Z');
  const activities: SwimActivity[] = [2000, 2500, 3000, 3500, 4000].map((distance, index) => ({
    id: `ow-${index}`,
    date: `2026-09-0${index + 1}`,
    title: `Travesia ${index}`,
    type: 'open_water',
    distance,
    movingTime: Math.round(1.25 * distance ** 1.05),
    elapsedTime: Math.round(1.25 * distance ** 1.05 * 1.1),
    movingRatio: 91,
    pacePer100m: Number((1.25 * distance ** 1.05 / distance * 100).toFixed(1)),
    avgHeartRate: 135,
    source: 'strava_csv',
  }));

  const readiness = calculateOceanmanReadiness(activities, testDate);
  const longestPace = activities[activities.length - 1].pacePer100m;

  assert.ok(readiness.overallScore > 0);
  assert.ok(readiness.daysRemaining > 0);
  assert.ok(
    readiness.estimatedPacePer100mSec > longestPace,
    'a 14k projection must be slower than the longest training swim',
  );
  assert.equal(readiness.longestSwimMeters, 4000);
  assert.equal(readiness.checks.length, 6);
  assert.ok(readiness.historicalEvolution.length > 0);
  assert.ok(readiness.estimatedFinishTimeSec > 0);
});

test('readiness has six measurable weighted checks', () => {
  const activities: SwimActivity[] = [
    { id: 'ow-1', date: '2026-10-12', title: 'Long open water', type: 'open_water', distance: 5000, elapsedTime: 5200, movingTime: 5000, pacePer100m: 100, source: 'strava_csv' },
    { id: 'pool-1', date: '2026-10-14', title: 'Pool', type: 'pool', distance: 3000, elapsedTime: 3100, movingTime: 3000, pacePer100m: 100, source: 'strava_csv' },
  ];

  const { checks } = evaluateReadinessChecks(activities, new Date('2026-10-26T12:00:00'));
  assert.equal(checks.length, 6);
  assert.equal(checks.reduce((sum, check) => sum + check.weight, 0), 100);
  assert.deepEqual(checks.map(check => check.id), [
    'check-1-race-projection',
    'check-2-ow-longest',
    'check-3-weekly-volume',
    'check-4-continuity',
    'check-5-consistency',
    'check-6-aerobic-efficiency',
  ]);
});

test('readiness does not redistribute missing evidence and rewards partial endurance conservatively', () => {
  const activities: SwimActivity[] = [
    { id: 'ow', date: '2026-10-12', title: 'Open water', type: 'open_water', distance: 5000, elapsedTime: 6250, movingTime: 5000, movingRatio: 80, pacePer100m: 100, source: 'strava_csv' },
  ];
  const { checks, overallScore } = evaluateReadinessChecks(activities, new Date('2026-10-26T12:00:00'));

  assert.equal(checks.find(check => check.id === 'check-2-ow-longest')?.score, 35);
  assert.equal(checks.find(check => check.id === 'check-4-continuity')?.score, 75);
  assert.ok(checks.some(check => check.isDataAvailable === false));
  const earnedPoints = checks.reduce((sum, check) => sum + (check.isDataAvailable === false ? 0 : check.score * check.weight), 0);
  assert.equal(overallScore, Math.round(earnedPoints / 100));
  assert.ok(overallScore < 25);
});

test('historical open water keeps its distance and pace', () => {
  const csv = `Activity ID,Activity Date,Activity Name,Activity Type,Moving Time,Distance,Pool Length,Elevation High,Elevation Low
ow,2025-03-24,Open water,Swim,2000,2000,,4,-2`;
  const activity = parseStravaCsv(csv)[0];

  assert.equal(activity.type, 'open_water');
  assert.equal(activity.distance, 2000);
  assert.equal(activity.pacePer100m, 100);
  assert.equal(activity.poolDistanceCorrection, undefined);
  assert.deepEqual(recalculateSwimMetrics(activity), activity);
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
  assert.equal(typeof points[2].checkScores?.['check-5-consistency'], 'number');
});
