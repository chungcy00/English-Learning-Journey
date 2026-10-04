// Bound work before invoking the AI provider.
export function validateApiBody(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return '请求必须为 JSON 对象';
  function valid(value: unknown, depth = 0): boolean {
    if (depth > 8) return false;
    if (typeof value === 'string') return value.length <= 30000;
    if (Array.isArray(value)) return value.length <= 100 && value.every(item => valid(item, depth + 1));
    if (value && typeof value === 'object') {
      const entries = Object.entries(value);
      return entries.length <= 100 && entries.every(([key, item]) =>
        !['__proto__', 'constructor', 'prototype'].includes(key) && valid(item, depth + 1));
    }
    return value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
  }
  if (!valid(body)) return '请求内容过长或格式不正确';
  const data = body as Record<string, unknown>;
  for (const key of ['input', 'term', 'text', 'title', 'reading', 'contextReading', 'originalSentence', 'target', 'userAnswer', 'referenceAnswer', 'mode']) {
    if (data[key] !== undefined && typeof data[key] !== 'string') return '文本字段格式不正确';
  }
  for (const key of ['specifiedVocabulary', 'currentVocabulary', 'vocabulary', 'vocabularies', 'rewriteExercises', 'turns']) {
    if (data[key] !== undefined && !Array.isArray(data[key])) return '列表字段格式不正确';
  }
  for (const key of ['specifiedVocabulary', 'currentVocabulary']) {
    if (Array.isArray(data[key]) && data[key].some(item => typeof item !== 'string' || item.length > 160)) return '词条列表格式不正确';
  }
  for (const key of ['keepVocabulary', 'keepCurrentVocabulary', 'requireInReading']) {
    if (data[key] !== undefined && typeof data[key] !== 'boolean') return '选项格式不正确';
  }
  const enums: Record<string, unknown[]> = {
    cefrLevel: ['A2', 'B1', 'B2', 'C1'],
    readingType: ['story', 'non-story', 'dialogue', 'random'],
    readingStyle: ['auto', 'natural', 'funny', 'warm', 'suspenseful', 'dramatic', 'professional', 'cinematic'],
    length: ['short', 'medium', 'long'],
    targetLanguage: ['zh-CN', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'vi', 'ru'],
  };
  for (const [key, allowed] of Object.entries(enums)) {
    if (data[key] !== undefined && !allowed.includes(data[key])) return '选项不受支持';
  }
  if (data.vocabularyCount !== undefined &&
      (!Number.isInteger(data.vocabularyCount) || Number(data.vocabularyCount) < 1 || Number(data.vocabularyCount) > 20)) return '词汇数量不正确（最多 20 个）';
  if (typeof data.term === 'string' && (!data.term.trim() || data.term.length > 160)) return '词条应为 1–160 个字符';
  return null;
}
