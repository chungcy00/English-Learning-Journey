export function activeDistributionLevel(preview: string | null, selected: string | null, dominant: string) {
  return preview || selected || dominant;
}

// Two arcs per boundary also render a complete 360° ring without coincident-endpoint collapse.
export function donutSegmentPath(startPercent: number, percentage: number, outer = 114, inner = 86) {
  const point = (percent: number, radius: number) => {
    const angle = (percent / 100 * 2 - .5) * Math.PI;
    return `${120 + radius * Math.cos(angle)} ${120 + radius * Math.sin(angle)}`;
  };
  const middle = startPercent + percentage / 2;
  const end = startPercent + percentage;
  return `M ${point(startPercent, outer)} A ${outer} ${outer} 0 0 1 ${point(middle, outer)} A ${outer} ${outer} 0 0 1 ${point(end, outer)} L ${point(end, inner)} A ${inner} ${inner} 0 0 0 ${point(middle, inner)} A ${inner} ${inner} 0 0 0 ${point(startPercent, inner)} Z`;
}
