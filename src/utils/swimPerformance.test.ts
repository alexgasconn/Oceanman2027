import test from 'node:test';
import assert from 'node:assert/strict';
import type { SwimActivity } from '../types/swim.ts';
import {
  buildRaceProjection,
  fitFatigueModel,
  getEfficiencyFactor,
  getEfficiencyTrend,
  getLongSwimContinuity,
  getOpenWaterPenaltySec,
  markPaceOutliers,
  projectRacePace,
  projectSwimTimeSec,
} from './swimPerformance.ts';

const swim = (overrides: Partial<SwimActivity> & { id: string; distance: number; movingTime: number }): SwimActivity => ({
  date: '2026-06-01',
  title: overrides.id,
  type: 'pool',
  elapsedTime: overrides.movingTime,
  pacePer100m: Number((overrides.movingTime / overrides.distance * 100).toFixed(1)),
  source: 'strava_csv',
  ...overrides,
});

test('markPaceOutliers uses per-medium fences and ignores sessions without pace', () => {
  const pool = [100, 104, 106, 108, 110, 300].map((pace, index) =>
    swim({ id: `pool-${index}`, type: 'pool', distance: 1000, movingTime: pace * 10 }));
  const open = [130, 134, 138, 140, 142].map((pace, index) =>
    swim({ id: `open-${index}`, type: 'open_water', distance: 1000, movingTime: pace * 10 }));

  const marked = markPaceOutliers([...pool, ...open]);

  assert.equal(marked.find(a => a.id === 'pool-5')?.isPaceOutlier, true);
  assert.equal(marked.find(a => a.id === 'pool-1')?.isPaceOutlier, false);
  // An open-water pace of 140 s/100 m is normal for its own medium.
  assert.equal(marked.find(a => a.id === 'open-4')?.isPaceOutlier, false);
});

test('fitFatigueModel recovers a known exponent and ignores short drills', () => {
  // time = 1.2 * distance^1.05 exactly.
  const activities = [1500, 2000, 2600, 3200, 4000, 5000].map(distance =>
    swim({ id: `d-${distance}`, distance, movingTime: Math.round(1.2 * distance ** 1.05) }));
  const drill = swim({ id: 'drill', distance: 300, movingTime: 600 });

  const model = fitFatigueModel([...activities, drill]);

  assert.ok(model);
  assert.ok(Math.abs(model!.exponentRaw - 1.05) < 0.01);
  assert.equal(model!.sampleSize, 6);
  assert.ok(model!.rSquared > 0.99);
  assert.equal(model!.wasClamped, false);
});

test('fitFatigueModel clamps implausible exponents below 1', () => {
  // Decreasing pace with distance yields k < 1, which must not be used as-is.
  const activities = [1500, 2200, 3000, 3800, 4600].map((distance, index) =>
    swim({ id: `f-${index}`, distance, movingTime: Math.round(distance * (1.6 - index * 0.12)) }));

  const model = fitFatigueModel(activities);

  assert.ok(model);
  assert.ok(model!.exponentRaw < 1);
  assert.equal(model!.exponent, 1.02);
  assert.equal(model!.wasClamped, true);
});

test('projectSwimTimeSec grows with distance and matches the Riegel curve', () => {
  const activities = [1500, 2000, 3000, 4000, 5000].map(distance =>
    swim({ id: `p-${distance}`, distance, movingTime: Math.round(1.2 * distance ** 1.05) }));
  const model = fitFatigueModel(activities)!;

  const at5k = projectSwimTimeSec(model, 5000);
  const at14k = projectSwimTimeSec(model, 14000);

  assert.ok(at14k > at5k * 2.8, 'a 14k must take clearly longer than 2.8x a 5k');
  assert.ok(Math.abs(at14k - 1.2 * 14000 ** 1.05) / at14k < 0.02);
});

test('projectRacePace adds the open-water penalty and reports extrapolation reach', () => {
  const activities = [1500, 1800, 2000, 3000, 3500].map(distance =>
    swim({ id: `r-${distance}`, distance, movingTime: Math.round(1.3 * distance ** 1.06) }));

  const plain = projectRacePace(activities, 14000, 0)!;
  const penalised = projectRacePace(activities, 14000, 10)!;

  assert.ok(plain);
  assert.equal(Number((penalised.pacePer100mSec - plain.pacePer100mSec).toFixed(1)), 10);
  assert.equal(penalised.extrapolationFactor, 4);
  assert.ok(penalised.swimTimeSec > plain.swimTimeSec);
});

test('buildRaceProjection fits on pool data and applies the open-water penalty once', () => {
  const pool = [1500, 1800, 2200, 3000, 3600].map(distance =>
    swim({ id: `pool-${distance}`, type: 'pool', distance, movingTime: Math.round(1.2 * distance ** 1.05) }));
  const open = [1600, 2000, 2400].map(distance =>
    swim({ id: `open-${distance}`, type: 'open_water', distance, movingTime: Math.round(1.45 * distance ** 1.05) }));

  const marked = markPaceOutliers([...pool, ...open]);
  const projection = buildRaceProjection(marked, 14000)!;
  const penalty = getOpenWaterPenaltySec(marked)!;
  const poolOnly = projectRacePace(pool, 14000, 0)!;

  assert.equal(projection.basis, 'pool');
  assert.equal(projection.openWaterPenaltySec, penalty);
  // The penalty is added exactly once on top of the pool-based curve.
  assert.ok(Math.abs(projection.pacePer100mSec - (poolOnly.pacePer100mSec + penalty)) < 0.2);
});

test('buildRaceProjection falls back to all sessions without enough pool endurance data', () => {
  const open = [1500, 1900, 2300, 2800, 3300].map(distance =>
    swim({ id: `ow-${distance}`, type: 'open_water', distance, movingTime: Math.round(1.4 * distance ** 1.05) }));

  const projection = buildRaceProjection(markPaceOutliers(open), 14000)!;

  assert.equal(projection.basis, 'all');
  assert.equal(projection.openWaterPenaltySec, 0);
});

test('getOpenWaterPenaltySec measures the athlete own pool to open-water gap', () => {
  const pool = [100, 102, 104, 106, 108].map((pace, index) =>
    swim({ id: `po-${index}`, type: 'pool', distance: 1000, movingTime: pace * 10 }));
  const open = [124, 126, 128].map((pace, index) =>
    swim({ id: `ow-${index}`, type: 'open_water', distance: 1000, movingTime: pace * 10 }));

  const penalty = getOpenWaterPenaltySec(markPaceOutliers([...pool, ...open]));

  assert.equal(penalty, 22);
});

test('getEfficiencyFactor and trend reflect speed per heartbeat', () => {
  const fast = swim({ id: 'fast', distance: 1000, movingTime: 1000, avgHeartRate: 125 });
  assert.equal(getEfficiencyFactor(fast), 0.8);
  assert.equal(getEfficiencyFactor(swim({ id: 'nohr', distance: 1000, movingTime: 1000 })), null);

  const improving: SwimActivity[] = [];
  for (let index = 0; index < 20; index++) {
    improving.push(swim({
      id: `e-${index}`,
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      distance: 1000,
      movingTime: 1200 - index * 10,
      avgHeartRate: 130,
    }));
  }
  const trend = getEfficiencyTrend(improving)!;
  assert.ok(trend.changePct > 0, 'faster swims at equal HR must raise efficiency');
  assert.equal(trend.recentCount, 10);
});

test('getLongSwimContinuity reports the median moving ratio of long sessions', () => {
  const activities = [
    swim({ id: 'c1', distance: 2500, movingTime: 2000, elapsedTime: 2500, movingRatio: 80 }),
    swim({ id: 'c2', distance: 3000, movingTime: 2000, elapsedTime: 4000, movingRatio: 50 }),
    swim({ id: 'c3', distance: 2200, movingTime: 1800, elapsedTime: 2400, movingRatio: 75 }),
    swim({ id: 'short', distance: 800, movingTime: 700, elapsedTime: 1400, movingRatio: 50 }),
  ];

  const continuity = getLongSwimContinuity(activities)!;

  assert.equal(continuity.sampleSize, 3);
  assert.equal(continuity.medianRatio, 75);
});
