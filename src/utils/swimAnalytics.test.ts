import test from 'node:test';
import assert from 'node:assert/strict';
import type { SwimActivity } from '../types/swim.ts';
import { createHistogram, getSwolfEfficiencyStats, getWeekdayHourKilometers, getWeeklyRollingMean } from './swimAnalytics.ts';
import { getRecentCompletedTrainingWeeks, getTrainingWorkWeek } from './trainingWeeks.ts';

test('createHistogram counts every value, including the maximum', () => {
  const bins = createHistogram([1, 2, 2, 4], 2);

  assert.deepEqual(bins.map(bin => bin.count), [3, 1]);
  assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), 4);
});

test('getWeeklyRollingMean includes empty weeks in the rolling window', () => {
  const activities: SwimActivity[] = [
    { id: '1', date: '2026-10-05', title: 'A', type: 'pool', distance: 1000, elapsedTime: 600, movingTime: 600, pacePer100m: 60, source: 'strava_csv' },
    { id: '2', date: '2026-10-07', title: 'B', type: 'pool', distance: 3000, elapsedTime: 1800, movingTime: 1800, pacePer100m: 60, source: 'strava_csv' },
    { id: '3', date: '2026-10-19', title: 'C', type: 'open_water', distance: 2000, elapsedTime: 1200, movingTime: 1200, pacePer100m: 60, source: 'strava_csv' },
  ];

  const weekly = getWeeklyRollingMean(activities);
  assert.deepEqual(weekly.map(point => point.weeklyKm), [4, 0, 2]);
  assert.deepEqual(weekly.map(point => point.rollingMeanKm), [4, 2, 2]);
});

test('training weeks run Monday through Friday and ignore weekend swims', () => {
  assert.equal(getTrainingWorkWeek('2026-10-26')?.key, '2026-10-26');
  assert.equal(getTrainingWorkWeek('2026-10-30')?.key, '2026-10-26');
  assert.equal(getTrainingWorkWeek('2026-10-31'), null);
  assert.equal(getTrainingWorkWeek('2026-11-01'), null);
  assert.deepEqual(
    getRecentCompletedTrainingWeeks(new Date(2026, 9, 26), 2).map(week => week.key),
    ['2026-10-12', '2026-10-19']
  );

  const activities: SwimActivity[] = [
    { id: 'mon', date: '2026-10-26', title: 'Monday', type: 'pool', distance: 1000, elapsedTime: 600, movingTime: 600, pacePer100m: 60, source: 'strava_csv' },
    { id: 'sat', date: '2026-10-31', title: 'Saturday', type: 'pool', distance: 2000, elapsedTime: 1200, movingTime: 1200, pacePer100m: 60, source: 'strava_csv' },
    { id: 'sun', date: '2026-11-01', title: 'Sunday', type: 'pool', distance: 3000, elapsedTime: 1800, movingTime: 1800, pacePer100m: 60, source: 'strava_csv' },
  ];

  assert.deepEqual(getWeeklyRollingMean(activities).map(point => point.weeklyKm), [1]);
});

test('getWeekdayHourKilometers groups local training times and sums distance in km', () => {
  const activities: SwimActivity[] = [
    { id: 'm1', date: '2026-10-26', startedAt: '2026-10-26T06:15:00', title: 'Monday', type: 'pool', distance: 1250, elapsedTime: 800, movingTime: 750, pacePer100m: 60, source: 'strava_csv' },
    { id: 'm2', date: '2026-10-26', startedAt: '2026-10-26T06:45:00', title: 'Monday 2', type: 'pool', distance: 750, elapsedTime: 500, movingTime: 450, pacePer100m: 60, source: 'strava_csv' },
    { id: 't1', date: '2026-10-27', startedAt: '2026-10-27T18:30:00', title: 'Tuesday', type: 'pool', distance: 2500, elapsedTime: 1600, movingTime: 1500, pacePer100m: 60, source: 'strava_csv' },
  ];

  const totals = getWeekdayHourKilometers(activities);

  assert.equal(totals[0][6], 2);
  assert.equal(totals[1][18], 2.5);
  assert.equal(totals.flat().reduce((sum, value) => sum + value, 0), 4.5);
});

test('getSwolfEfficiencyStats excludes estimated cadence and compares distance within one pool length', () => {
  const activities: SwimActivity[] = [
    { id: 'short-1', date: '2026-10-01', title: 'Short 1', type: 'pool', distance: 1000, elapsedTime: 800, movingTime: 750, pacePer100m: 75, poolLength: 20, swolf: 40, averageCadence: 24, hasRecordedCadence: true, source: 'strava_csv' },
    { id: 'short-2', date: '2026-10-02', title: 'Short 2', type: 'pool', distance: 1500, elapsedTime: 1100, movingTime: 1000, pacePer100m: 67, poolLength: 20, swolf: 42, averageCadence: 24, hasRecordedCadence: true, source: 'strava_csv' },
    { id: 'long-1', date: '2026-10-03', title: 'Long 1', type: 'pool', distance: 2500, elapsedTime: 1800, movingTime: 1700, pacePer100m: 68, poolLength: 20, swolf: 44, averageCadence: 24, hasRecordedCadence: true, source: 'strava_csv' },
    { id: 'long-2', date: '2026-10-04', title: 'Long 2', type: 'pool', distance: 3000, elapsedTime: 2200, movingTime: 2100, pacePer100m: 70, poolLength: 20, swolf: 46, averageCadence: 24, hasRecordedCadence: true, source: 'strava_csv' },
    { id: 'estimated', date: '2026-10-05', title: 'Estimated', type: 'pool', distance: 3000, elapsedTime: 2200, movingTime: 2100, pacePer100m: 70, poolLength: 25, swolf: 50, averageCadence: 64, source: 'strava_csv' },
  ];

  const stats = getSwolfEfficiencyStats(activities);

  assert.equal(stats.measuredSessions, 4);
  assert.equal(stats.average25mEquivalent, 53.75);
  assert.ok(Math.abs(stats.longSwimDriftPct! - ((45 / 41 - 1) * 100)) < 0.001);
  assert.equal(stats.shortSwimCount, 2);
  assert.equal(stats.longSwimCount, 2);
});