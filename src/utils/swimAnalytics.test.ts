import test from 'node:test';
import assert from 'node:assert/strict';
import type { SwimActivity } from '../types/swim.ts';
import { createHistogram, getWeeklyRollingMean } from './swimAnalytics.ts';
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