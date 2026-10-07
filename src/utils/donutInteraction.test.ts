import assert from 'node:assert/strict';
import test from 'node:test';
import { activeDistributionLevel, donutSegmentPath } from './donutInteraction';

test('preview takes priority without replacing the persisted filter', () => {
  assert.equal(activeDistributionLevel('A2', 'B1', 'C1'), 'A2');
  assert.equal(activeDistributionLevel(null, 'B1', 'C1'), 'B1');
  assert.equal(activeDistributionLevel(null, null, 'C1'), 'C1');
});
test('full and fractional rings have four valid arcs and close both boundaries', () => {
  for (const [start, percentage] of [[0, 100], [0, 50], [50, 25], [75, 25]]) {
    const path = donutSegmentPath(start, percentage);
    assert.equal((path.match(/ A /g) || []).length, 4);
    assert.ok(path.endsWith(' Z'));
    assert.doesNotMatch(path, /NaN|Infinity/);
  }
});
