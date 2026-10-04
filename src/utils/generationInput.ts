import type { CEFRLevel } from '../types';

// Preserve the existing form parser; the preview and submitted terms share it.
export function parseSpecifiedVocabulary(input: string): string[] | undefined {
  return /[,，、;；]/.test(input)
    ? input.split(/[,，、;；]/).map(term => term.trim()).filter(Boolean)
    : undefined;
}

// Concise paraphrases of the Council of Europe's CEFR global scale, not a test.
// https://www.coe.int/en/web/common-european-framework-reference-languages/table-1-cefr-3.3-common-reference-levels-global-scale
export const CEFR_ABILITY_HINTS: Record<CEFRLevel, string> = {
  A2: '理解日常高频表达，进行简单信息交流。',
  B1: '理解熟悉话题的要点，描述经历与计划。',
  B2: '理解较复杂内容，清楚表达观点与理由。',
  C1: '理解较长且有难度的内容，识别隐含含义。',
};
