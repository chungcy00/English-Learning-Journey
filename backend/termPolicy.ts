import { normalizeEnglishTerm } from '../src/utils/englishSearch.js';

export function explainedTermProblem(result: any, options: { term: string; cefrLevel?: string; requireInReading?: boolean; contextReading?: string }): string | null {
  if (result?.isValidTerm !== true || typeof result.term !== 'string' || normalizeEnglishTerm(result.term) !== normalizeEnglishTerm(options.term)) return '未能确认这个英文词条，请检查拼写或输入完整短语。';
  if (!['word', 'phrase', 'idiom'].includes(result.type) || !['A1','A2','B1','B2','C1','C2'].includes(result.cefrLevel)) return '词条类型或程度信息不完整，请重试。';
  for (const field of ['meaningZh', 'definitionEn', 'example', 'partOfSpeech']) {
    if (typeof result[field] !== 'string' || !result[field].trim()) return '词条释义不完整，请重试。';
  }
  if (options.cefrLevel && result.cefrLevel !== options.cefrLevel) return `该表达在当前语境下估计为 ${result.cefrLevel}，不符合所选 ${options.cefrLevel}，未加入精选词汇。`;
  if (options.requireInReading && (result.isInContext !== true || typeof result.contextQuote !== 'string' || !result.contextQuote.trim() || !normalizeEnglishTerm(options.contextReading || '').includes(normalizeEnglishTerm(result.contextQuote)))) return '当前短文中没有找到这个完整表达，请输入文中出现的单词、短语或习语。';
  return null;
}
