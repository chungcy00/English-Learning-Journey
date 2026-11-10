import assert from 'node:assert/strict';
import test from 'node:test';
import { activeDistributionLevel, donutSegmentPath, donutSegmentOffset } from './donutInteraction';

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

test('segment lift follows the radial midpoint and keeps a bounded displacement', () => {
  for (const [start, size] of [[0,25],[25,25],[50,25],[75,25],[0,100],[27.6,55.2]]) {
    const {x,y}=donutSegmentOffset(start,size);
    assert.ok(Math.abs(Math.hypot(x,y)-5)<1e-9);
    const angle=((start+size/2)/100*2-.5)*Math.PI;
    assert.ok(Math.abs(x/5-Math.cos(angle))<1e-9);
    assert.ok(Math.abs(y/5-Math.sin(angle))<1e-9);
  }
  assert.ok(donutSegmentOffset(0,25).x>0 && donutSegmentOffset(0,25).y<0);
  assert.ok(donutSegmentOffset(50,25).x<0 && donutSegmentOffset(50,25).y>0);
});
