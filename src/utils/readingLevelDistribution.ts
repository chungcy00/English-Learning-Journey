export const READING_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', '未知'] as const;
export type DistributionReading = { cefrLevel?: string | null; selectedVocabulary?: readonly { cefrLevel?: string | null }[] };
export type DistributionDimension = 'readings' | 'vocabulary';
export function distributionSource(readings: readonly DistributionReading[], dimension: DistributionDimension) {
  return dimension === 'readings' ? readings : readings.flatMap(reading => reading.selectedVocabulary || []);
}
export function filterReadingsByLevel<T extends DistributionReading>(readings: readonly T[], level: string | null, dimension: DistributionDimension): T[] {
  if (!level) return [...readings];
  const matches = (value?: string | null) => (READING_LEVELS.includes(value as typeof READING_LEVELS[number]) ? value : '未知') === level;
  return readings.filter(reading => dimension === 'readings' ? matches(reading.cefrLevel) : reading.selectedVocabulary?.some(word => matches(word.cefrLevel)));
}

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
