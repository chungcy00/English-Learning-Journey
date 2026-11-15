export interface FamilyNodeBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Point = { x: number; y: number };

/** Uneven, deterministic pen drift with exact endpoints at every junction. */
function handStroke(start: Point, end: Point, phase = 0) {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const steps = Math.max(5, Math.ceil(length / 9));
  const amplitude = Math.min(1.8, length * .035);
  const frequency = Math.max(.8, length / 44);
  const points = Array.from({ length: steps + 1 }, (_, index): Point => {
    if (index === 0) return start;
    if (index === steps) return end;
    const t = index / steps;
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const tangentLength = Math.hypot(dx, dy) || 1;
    const drift = amplitude * Math.sin(Math.PI * t) ** 2
      * (Math.sin(t * frequency * 2 * Math.PI + phase) + .4 * Math.sin(t * frequency * 3.46 * Math.PI + .8));
    return { x: x - dy / tangentLength * drift, y: y + dx / tangentLength * drift };
  });
  const format = (point: Point) => `${Number(point.x.toFixed(3))} ${Number(point.y.toFixed(3))}`;
  const segments = points.slice(1).map((point, index) => {
    const previous = points[index];
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 2)];
    const controlA = index === 0
      ? { x: start.x + (end.x - start.x) / steps / 3, y: start.y + (end.y - start.y) / steps / 3 }
      : { x: previous.x + (point.x - before.x) / 6, y: previous.y + (point.y - before.y) / 6 };
    const controlB = index === steps - 1
      ? { x: end.x - (end.x - start.x) / steps / 3, y: end.y - (end.y - start.y) / steps / 3 }
      : { x: point.x - (after.x - previous.x) / 6, y: point.y - (after.y - previous.y) / 6 };
    return `C ${format(controlA)} ${format(controlB)} ${format(point)}`;
  });
  return `M ${format(start)} ${segments.join(' ')}`;
}

/** Keep each right-angle corner exact while the adjoining strokes drift naturally. */
function handPolyline(points: Point[], phase = 0) {
  const segments = points.slice(1).map((point, index) => handStroke(points[index], point, phase + index * .7));
  return segments.map((segment, index) => index === 0 ? segment : segment.replace(/^M [^ ]+ [^ ]+ /, '')).join(' ');
}

/** Shared endpoints keep every hand-drawn stem and fork physically connected. */
export function familyConnectorPaths(parent: FamilyNodeBounds, children: FamilyNodeBounds[], stacked: boolean): string[] {
  if (!children.length) return [];
  const bottom = parent.top + parent.height - 2;
  if (stacked) {
    const trunkX = Math.min(parent.left + 16, ...children.map(child => child.left - 12));
    let previousY = bottom;
    return children.flatMap(child => {
      const joinY = child.top + child.height / 2;
      const endX = child.left + 2;
      const stem = handStroke({ x: trunkX, y: previousY }, { x: trunkX, y: joinY }, .3);
      const branch = handStroke({ x: trunkX, y: joinY }, { x: endX, y: joinY }, 1.1);
      previousY = joinY;
      return [stem, branch];
    });
  }

  const startX = parent.left + parent.width / 2;
  const childTop = Math.min(...children.map(child => child.top + 2));
  const joinY = bottom + (childTop - bottom) * .42;
  const start = { x: startX, y: bottom };
  const junction = { x: startX, y: joinY };
  const branchPoints = (child: FamilyNodeBounds) => {
    const end = { x: child.left + child.width / 2, y: child.top + 2 };
    return end.x === startX ? [junction, end] : [junction, { x: end.x, y: joinY }, end];
  };
  if (children.length === 1) return [handPolyline([start, ...branchPoints(children[0])])];
  const stem = handStroke(start, junction, .3);
  const branches = children.map((child, index) => handPolyline(branchPoints(child), .7 + index * .9));
  return [stem, ...branches];
}
