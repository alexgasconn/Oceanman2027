import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRacePlan,
  CALM_CONDITIONS,
  FEED_POINTS,
  formatRaceClock,
  RACE_CUTOFF_SEC,
  suggestStopPlan,
} from './raceModel.ts';

test('formatRaceClock converts race seconds into 12-hour local time', () => {
  assert.equal(formatRaceClock(0), '9:30 AM');
  assert.equal(formatRaceClock(90 * 60), '11:00 AM');
  assert.equal(formatRaceClock(150 * 60), '12:00 PM');
  assert.equal(formatRaceClock(5 * 3600), '2:30 PM');
});

test('buildRacePlan produces 14 cumulative kilometre splits', () => {
  const plan = buildRacePlan({ basePacePer100mSec: 120 });

  assert.equal(plan.splits.length, 14);
  assert.equal(plan.splits[13].km, 14);
  for (let index = 1; index < plan.splits.length; index++) {
    assert.ok(plan.splits[index].cumulativeSec > plan.splits[index - 1].cumulativeSec);
  }
  assert.equal(plan.totalRaceSec, plan.swimTimeSec + plan.totalStopSec);
  assert.equal(plan.splits[13].cumulativeSec, plan.totalRaceSec);
});

test('buildRacePlan applies navigation deviation and surface penalty to pace', () => {
  const calm = buildRacePlan({ basePacePer100mSec: 120 });
  const rough = buildRacePlan({
    basePacePer100mSec: 120,
    conditions: { ...CALM_CONDITIONS, surfacePenaltySec: 5 },
  });

  assert.equal(calm.effectivePaceSec, 120);
  assert.equal(rough.effectivePaceSec, 125);
  assert.equal(calm.effectiveDistanceM, 14490);
  assert.ok(rough.swimTimeSec > calm.swimTimeSec);
});

test('buildRacePlan reports cut-off margins at both feeding points', () => {
  const plan = buildRacePlan({ basePacePer100mSec: 120, stopSecByKm: { 5: 60, 10: 90 } });

  assert.equal(plan.feedPoints.length, FEED_POINTS.length);
  const [first, second] = plan.feedPoints;
  assert.equal(first.km, 5);
  assert.equal(first.plannedStopSec, 60);
  assert.equal(first.marginSec, first.cutoffSec - first.arrivalSec);
  assert.equal(second.km, 10);
  // The second arrival must already include the first stop.
  assert.ok(second.arrivalSec > plan.swimTimeSec * (10 / 14));
  assert.equal(plan.totalStopSec, 150);
});

test('stop budget shrinks as swimming gets slower and flags cut-off breach', () => {
  const fast = buildRacePlan({ basePacePer100mSec: 110 });
  const slow = buildRacePlan({ basePacePer100mSec: 160 });

  assert.ok(fast.stopBudgetSec > slow.stopBudgetSec);
  assert.equal(fast.stopBudgetSec, RACE_CUTOFF_SEC - fast.swimTimeSec);
  assert.equal(slow.isWithinCutoff, false);
  assert.ok(slow.finishMarginSec < 0);
});

test('suggestStopPlan keeps the finish inside the cut-off with a reserve', () => {
  const pace = 125;
  const stops = suggestStopPlan(pace);
  const plan = buildRacePlan({ basePacePer100mSec: pace, stopSecByKm: stops });

  assert.ok(plan.isWithinCutoff);
  assert.ok(plan.finishMarginSec >= 600);
  assert.ok(plan.totalStopSec > 0);
});

test('suggestStopPlan yields no stop time when swimming already exceeds the cut-off', () => {
  const stops = suggestStopPlan(170);
  assert.deepEqual(Object.values(stops), [0, 0]);
});
