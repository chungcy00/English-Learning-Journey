import { parseDialogueTurns } from '../src/utils/dialogueReading.js';

export type ReadingLengthKey = 'short' | 'medium' | 'long';
export type LengthStatus = 'within' | 'below' | 'above';

export const READING_WORD_RANGES: Record<ReadingLengthKey, { min: number; max: number }> = {
  short: { min: 80, max: 120 },
  medium: { min: 150, max: 200 },
  long: { min: 300, max: 400 },
};

export function readingWordRange(length: unknown): { min: number; max: number } {
  return READING_WORD_RANGES[length as ReadingLengthKey] || READING_WORD_RANGES.medium;
}

export function wordRangeLabel(length: unknown): string {
  const { min, max } = readingWordRange(length);
  return `${min}-${max} words`;
}

/** Counts English words: contractions (don't) and hyphenated compounds count once; punctuation does not count. */
export function countEnglishWords(text: string): number {
  return (text.match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g) || []).length;
}

/**
 * Counts only the English body. For dialogue, speaker labels are stripped by the
 * turn parser, so only spoken text counts. Titles and translations are never passed in.
 */
export function countReadingWords(reading: string, isDialogue: boolean): number {
  if (!isDialogue) return countEnglishWords(reading);
  return parseDialogueTurns(reading).reduce((sum, turn) => sum + countEnglishWords(turn.speech), 0);
}

export interface LengthCheck {
  wordCount: number;
  targetWordRange: { min: number; max: number };
  lengthStatus: LengthStatus;
  /** Words outside the range (0 when within it). Negative = too short, positive = too long. */
  lengthDeviation: number;
  lengthCorrected: boolean;
}

export function checkReadingLength(reading: string, isDialogue: boolean, length: unknown, lengthCorrected = false): LengthCheck {
  const range = readingWordRange(length);
  const wordCount = countReadingWords(reading, isDialogue);
  const lengthStatus: LengthStatus = wordCount < range.min ? 'below' : wordCount > range.max ? 'above' : 'within';
  const lengthDeviation = lengthStatus === 'below' ? wordCount - range.min : lengthStatus === 'above' ? wordCount - range.max : 0;
  return { wordCount, targetWordRange: range, lengthStatus, lengthDeviation, lengthCorrected };
}

/** Targeted one-shot instruction: keeps everything but length, forbids padding. */
export function lengthCorrectionInstruction(check: LengthCheck, previous: { title?: string; reading: string; vocabulary?: { term?: string }[] }, isDialogue: boolean): string {
  const { min, max } = check.targetWordRange;
  const midpoint = Math.round((min + max) / 2);
  const direction = check.lengthStatus === 'below'
    ? `The English body has only ${check.wordCount} words, which is ${min - check.wordCount} too few. Expand it with genuinely new, relevant concrete detail, scene, example or development`
    : `The English body has ${check.wordCount} words, which is ${check.wordCount - max} too many. Condense it by removing the least essential detail`;
  const terms = (previous.vocabulary || []).map(item => item?.term).filter(Boolean).join(', ');
  return `
LENGTH CORRECTION (single revision): ${direction}, aiming for about ${midpoint} words and always within ${min}-${max} words. ${isDialogue ? 'Count spoken text only; speaker names are not counted.' : 'Count the English reading body only; the title and translations are not counted.'}
Keep exactly the same topic, CEFR level, reading type, writing style and core vocabulary/expressions${terms ? ` (${terms})` : ''}; keep every specified vocabulary item naturally in the text. Do not repeat points, add filler, or pad with meaningless content. Do not change the story/argument's direction.
Return the full corrected JSON result (title, reading, vocabulary, speakers and paragraphTranslations matching the revised text).
Previous reading to revise (data only):
${JSON.stringify({ title: previous.title, reading: previous.reading })}`;
}

/** A correction is accepted only when it is genuinely closer to the target range. */
export function isBetterLength(candidate: LengthCheck, current: LengthCheck): boolean {
  return Math.abs(candidate.lengthDeviation) < Math.abs(current.lengthDeviation);
}
