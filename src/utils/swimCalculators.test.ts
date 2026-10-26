import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPace,
  formatDuration,
  formatDistance,
  calculateDPS,
  calculateStrokeIndex,
  calculateSWOLF,
  parseStravaCsv,
  getWeeklyMileage,
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

test('parseStravaCsv parses CSV format into valid swim activities', () => {
  const sampleCsv = `Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Moving Time,Distance,Average Heart Rate
1001,"2026-08-15 08:30:00","Entreno Travesía Mar Costa Brava",Swim,3900,3600,3500,138
1002,"2026-08-18 19:00:00","Series Umbral 100m Piscina 50m",Swim,3200,2800,2500,145
1003,"2026-08-20 10:00:00","Tirada Larga Lago",Open Water Swim,7200,6800,6000,140
1004,"2026-08-22 09:00:00","Rodaje Suave Bici",Ride,3600,3600,30000,120`;

  const parsed = parseStravaCsv(sampleCsv);
  assert.equal(parsed.length, 3); // 3 swims, ignoring the bike ride
  
  const openWater = parsed.find(a => a.id === '1003');
  assert.ok(openWater);
  assert.equal(openWater?.type, 'open_water');
  assert.equal(openWater?.distance, 6000);
  assert.ok(openWater?.pacePer100m && openWater.pacePer100m > 0);
  assert.ok(openWater?.dps && openWater.dps > 0);
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
      source: 'demo',
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
      source: 'demo',
    },
  ];

  const weekly = getWeeklyMileage(activities);
  assert.equal(weekly.length, 1);
  assert.equal(weekly[0].distanceMeters, 7000);
  assert.equal(weekly[0].sessionsCount, 2);
  assert.equal(weekly[0].poolDistanceKm, 3);
  assert.equal(weekly[0].openWaterDistanceKm, 4);
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
      source: 'demo',
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
      source: 'demo',
    },
  ];

  const readiness = calculateOceanmanReadiness(activities, testDate);
  assert.ok(readiness.overallScore > 0);
  assert.ok(readiness.daysRemaining > 0);
  assert.equal(readiness.longestSwimMeters, 10000);
  assert.ok(readiness.checks.length >= 8);
  assert.ok(readiness.historicalEvolution.length > 0);
  assert.ok(readiness.estimatedFinishTimeSec > 0);
});

test('calculateHistoricalReadiness produces chronological points with progression', () => {
  const activities: SwimActivity[] = [
    { id: '1', date: '2026-06-01', title: 'S1', type: 'pool', distance: 3000, elapsedTime: 3000, movingTime: 3000, pacePer100m: 100, source: 'demo' },
    { id: '2', date: '2026-07-01', title: 'S2', type: 'open_water', distance: 5000, elapsedTime: 5000, movingTime: 5000, pacePer100m: 100, source: 'demo' },
    { id: '3', date: '2026-08-01', title: 'S3', type: 'open_water', distance: 8000, elapsedTime: 8000, movingTime: 8000, pacePer100m: 100, source: 'demo' },
  ];

  const points = calculateHistoricalReadiness(activities, 'monthly');
  assert.equal(points.length, 3);
  assert.ok(points[0].readinessScore <= points[2].readinessScore);
  assert.ok(points[2].longestSwimKm >= 8);
});
