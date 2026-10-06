export const READING_LEVELS = ['A2', 'B1', 'B2', 'C1', '未知'] as const;

export function readingLevelDistribution(readings: readonly { cefrLevel?: string | null }[]) {
  const counts = new Map<string, number>(READING_LEVELS.map(level => [level, 0]));
  for (const reading of readings) {
    const level = reading.cefrLevel && counts.has(reading.cefrLevel) ? reading.cefrLevel : '未知';
    counts.set(level, counts.get(level)! + 1);
  }
  return READING_LEVELS.map(level => ({
    level,
    count: counts.get(level)!,
    percentage: readings.length ? counts.get(level)! / readings.length * 100 : 0,
  }));
}
