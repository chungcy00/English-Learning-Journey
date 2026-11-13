import { Type } from '@google/genai';
import type { StructuredUsage, UsageExample, UsageKind } from '../src/types.js';
import { isUsageKind, usageEntry, usageKinds, usageValidationError } from '../src/utils/structuredUsage.js';
import { isChineseUsageExplanation } from '../src/utils/usageLanguage.js';

const string = { type: Type.STRING };
const chinese = { ...string, description: '简明简体中文说明，英文仅用于讨论的单词、词组和句型。' };
const examples = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
  english: { ...string, description: 'One complete natural English sentence.' },
  chinese: { ...string, description: 'The accurate Simplified Chinese translation of this exact sentence.' },
}, required: ['english', 'chinese'] } };
const object = (properties: Record<string, unknown>, required: string[]) => ({ type: Type.OBJECT, properties, required });
// Keep array bounds in the server validator. Bounds on nested provider schemas
// multiply constraint states and cause Gemini INVALID_ARGUMENT responses.
export const structuredUsageSchema = { type: Type.ARRAY,
  description: '有价值才生成，数量不固定，同类可多项。每项只填写 kind 对应的结构，不填其他类别，也不输出旧版 text/meaningZh/example 格式。',
  items: object({
    kind: { type: Type.STRING, enum: usageKinds },
    scenario: object({ name: string, explanation: chinese, examples, tip: chinese }, ['name', 'explanation', 'examples']),
    grammar: object({ name: string, explanation: chinese, correct: string, restriction: chinese, examples, note: chinese }, ['name', 'explanation', 'examples']),
    comparison: object({ context: chinese, difference: chinese, note: chinese,
      expressions: { type: Type.ARRAY, items: object({ expression: string, explanation: { ...chinese, description: '一段简洁的中文语义说明，同时解释基本意思和与其他表达的关键区别。' }, examples }, ['expression', 'explanation', 'examples']) },
    }, ['context', 'difference', 'expressions']),
    error: object({ name: string, severity: { type: Type.STRING, enum: ['incorrect', 'unnatural'] }, incorrect: string, correct: string, reason: chinese, examples, note: chinese }, ['name', 'severity', 'incorrect', 'correct', 'reason', 'examples']),
  }, ['kind']),
};
function field(value: unknown, optional = false, chineseOnly = false): string {
  if (value === undefined && optional) return '';
  if (typeof value !== 'string' || value.length > 3000 || (!optional && !value.trim())) throw new Error('用法解析字段缺失或过长，请重试。');
  if (value.trim() && chineseOnly && !isChineseUsageExplanation(value)) throw new Error('用法解析说明需要简明中文，请重试。');
  return value.trim();
}
function examplePairs(value: unknown): UsageExample[] {
  if (!Array.isArray(value) || value.length > 8) throw new Error('用法例句格式不正确。');
  return value.map(item => {
    const english = field(item?.english), chinese = field(item?.chinese, false, true);
    if (!/[a-z]/i.test(english) || /[\u3400-\u9fff]/.test(english)) throw new Error('英文例句与中文译文需要分别填写。');
    return { id: crypto.randomUUID(), english, chinese };
  });
}
export function parseGeneratedUsage(item: any, term = '') {
  if (!isUsageKind(item?.kind)) throw new Error('用法解析类别无效，请重试。');
  const kind: UsageKind = item.kind;
  if (usageKinds.some(key => key !== kind && item[key] != null)) throw new Error('每个用法项目只能填写一个类别。');
  const value = item[kind];
  if (!value || typeof value !== 'object') throw new Error('用法解析缺少对应类别的结构。');
  const usage: StructuredUsage = { version: 2, kind };
  switch (kind) {
    case 'scenario': usage.scenario = { name: field(value.name), explanation: field(value.explanation, false, true), examples: examplePairs(value.examples), tip: field(value.tip, true, true) }; break;
    case 'grammar': usage.grammar = { name: field(value.name), explanation: field(value.explanation, false, true), correct: field(value.correct, true), restriction: field(value.restriction, true, true), examples: examplePairs(value.examples), note: field(value.note, true, true) }; break;
    case 'comparison':
      if (!Array.isArray(value.expressions) || value.expressions.length < 2 || value.expressions.length > 8) throw new Error('近义词辨析需要至少两个有真实区别的对比表达。');
      usage.comparison = { context: field(value.context, false, true), difference: field(value.difference, false, true), note: field(value.note, true, true),
        expressions: value.expressions.map((expression: any) => ({ id: crypto.randomUUID(), expression: field(expression.expression), explanation: field(expression.explanation, false, true), examples: examplePairs(expression.examples) })),
      }; break;
    case 'error': usage.error = { name: field(value.name), severity: value.severity, incorrect: field(value.incorrect), correct: field(value.correct), reason: field(value.reason, false, true), examples: examplePairs(value.examples), note: field(value.note, true, true) }; break;
  }
  if (usage.error && usage.error.incorrect === usage.error.correct) throw new Error('错误表达与正确表达需要有真实区别。');
  const explanation = usage.scenario?.explanation || usage.grammar?.explanation || usage.comparison?.difference || usage.error?.reason || '';
  const name = usage.scenario?.name || usage.grammar?.name || usage.error?.name || '';
  if (/发音|重音|音标|pronunciation|\bipa\b|word stress/i.test(name)) throw new Error('发音提示不属于用法解析。');
  if (term.toLowerCase() === 'hesitate' && /(?<!不)(?<!并非)(?:表示|意味着|指)[^。；;！？!?，,]{0,24}(?:因(?:为)?犹豫而(?:未|没|没有|不)做|(?:最终|最后)没有做)/.test(explanation)) throw new Error('hesitate 的说明不能把犹豫等同于最终未行动。');
  const problem = usageValidationError(usage, true);
  if (problem) throw new Error(problem);
  return usageEntry(crypto.randomUUID(), usage);
}
