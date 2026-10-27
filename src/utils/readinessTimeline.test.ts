import test from 'node:test';
import assert from 'node:assert/strict';
import type { SwimActivity } from '../types/swim.ts';
import { buildReadinessTimeline } from './readinessTimeline.ts';

const swim = (id: string, date: string, distance: number, movingTime: number, type: SwimActivity['type'] = 'open_water'): SwimActivity => ({
  id,
  date,
  title: id,
  type,
  distance,
  movingTime,
  elapsedTime: Math.round(movingTime * 1.1),
  movingRatio: 91,
  pacePer100m: Number((movingTime / distance * 100).toFixed(1)),
  avgHeartRate: 135,
  source: 'strava_csv',
});

const sample: SwimActivity[] = [
  swim('a', '2026-01-05', 1600, 2200),
  swim('b', '2026-01-08', 2000, 2700),
  swim('c', '2026-02-03', 2500, 3300),
  swim('d', '2026-02-18', 3000, 3900),
  swim('e', '2026-03-09', 3500, 4500),
  swim('f', '2026-03-24', 4000, 5100),
];

test('buildReadinessTimeline groups by month and stays inside 0-100', () => {
  const monthly = buildReadinessTimeline(sample, 'monthly');

  assert.deepEqual(monthly.map(point => point.periodKey), ['2026-01', '2026-02', '2026-03']);
  for (const point of monthly) {
    assert.ok(point.readinessPct >= 0 && point.readinessPct <= 100);
  }
});

test('timeline accumulates sessions period after period', () => {
  const monthly = buildReadinessTimeline(sample, 'monthly');

  assert.equal(monthly[0].sessionsToDate, 2);
  assert.equal(monthly[1].sessionsToDate, 4);
  assert.equal(monthly[2].sessionsToDate, 6);
});

test('weekly and daily granularity produce their own period keys', () => {
  const weekly = buildReadinessTimeline(sample, 'weekly');
  const daily = buildReadinessTimeline(sample, 'daily');

  // 2026-01-05 is a Monday, so its week key is the date itself.
  assert.equal(weekly[0].periodKey, '2026-01-05');
  assert.equal(daily.length, sample.length);
  assert.equal(daily[0].periodKey, '2026-01-05');
});

test('timeline exposes per-check scores and respects the point cap', () => {
  const daily = buildReadinessTimeline(sample, 'daily', 2);

  assert.equal(daily.length, 2);
  assert.ok('check-3-weekly-volume' in daily[0].checkScores);
});

test('timeline is empty without dated activities', () => {
  assert.deepEqual(buildReadinessTimeline([], 'weekly'), []);
});
