import { USAGE_HEADINGS, type LearningEntry, type StructuredUsage, type UsageExample, type UsageKind, type VocabularyDetails } from '../types.js';

export const usageKinds = Object.keys(USAGE_HEADINGS) as UsageKind[];
export const isUsageKind = (value: unknown): value is UsageKind => typeof value === 'string' && Object.hasOwn(USAGE_HEADINGS, value);
const text = (value: unknown) => typeof value === 'string' ? value : '';

export function emptyUsage(kind: UsageKind = 'scenario'): StructuredUsage {
  return { version: 2, kind, [kind]: emptyUsageCategory(kind) };
}
export function emptyUsageCategory(kind: UsageKind) {
  switch (kind) {
    case 'scenario': return { name: '', explanation: '', examples: [], tip: '' };
    case 'grammar': return { name: '', explanation: '', correct: '', restriction: '', examples: [], note: '' };
    case 'comparison': return { context: '', difference: '', expressions: [], note: '' };
    case 'error': return { name: '', severity: 'incorrect' as const, incorrect: '', correct: '', reason: '', examples: [], note: '' };
  }
}

/** Local conversion keeps learning prose and pairs, while obsolete archives are discarded. */
function normalizeUsage(usage: StructuredUsage): StructuredUsage {
  if (usage.compatibility) {
    usage.compatibility.extra = '';
    // Drop obsolete unknown-field archives after the learner requested cleanup.
    usage.compatibility.original = {};
  }
  if (usage.comparison) usage.comparison.expressions = usage.comparison.expressions.map(item => {
    const old = item as unknown as Record<string, unknown>;
    const parts = [text(old.explanation), text(old.meaning), text(old.emphasis)].map(value => value.trim()).filter(Boolean);
    // Only remove exact duplicates or text already fully contained in another field.
    const descriptions = [...new Set(parts)].filter(value => !parts.some(other => other !== value && other.includes(value)));
    return { id: item.id, expression: item.expression, explanation: descriptions.map((value, index) =>
      index < descriptions.length - 1 && !/[。！？.!?]$/.test(value) ? `${value}。` : value).join(''), examples: item.examples };
  });
  // The learner explicitly requested removal of comparison compatibility remnants.
  if (usage.kind === 'comparison') delete usage.compatibility;
  return usage;
}

export function structuredUsage(entry: LearningEntry): StructuredUsage {
  if (entry.usage?.version === 2) return normalizeUsage(structuredClone(entry.usage));
  const kind = isUsageKind(entry.usageKind) ? entry.usageKind : undefined;
  const examples: UsageExample[] = entry.example && entry.exampleTranslation
    ? [{ id: `${entry.id}-example`, english: entry.example, chinese: entry.exampleTranslation }] : [];
  const result: StructuredUsage = { version: 2, kind };
  const explanation = text(entry.meaningZh);
  if (kind === 'scenario') result.scenario = { name: '', explanation, examples, tip: text(entry.note) };
  if (kind === 'grammar') result.grammar = { name: '', explanation, correct: '', restriction: '', examples, note: text(entry.note) };
  if (kind === 'comparison') result.comparison = { context: '', difference: explanation, expressions: [], note: text(entry.note) };
  if (kind === 'error') result.error = { name: '', severity: 'incorrect', incorrect: text(entry.contrast?.incorrect), correct: text(entry.contrast?.correct), reason: explanation, examples, note: text(entry.note) };
  const oldTitle = text(entry.text);
  const hasTitle = oldTitle.trim() && !Object.values(USAGE_HEADINGS).includes(oldTitle as typeof USAGE_HEADINGS[UsageKind]);
  const mappedExamples = kind && kind !== 'comparison' && examples.length > 0;
  const leftoverExamples = !mappedExamples && (entry.example || entry.exampleTranslation)
    ? [{ id: `${entry.id}-original-example`, english: text(entry.example), chinese: text(entry.exampleTranslation) }] : [];
  result.compatibility = {
    title: hasTitle ? oldTitle : '', explanation: kind ? '' : explanation,
    note: kind ? '' : text(entry.note), examples: leftoverExamples,
    extra: '',
    original: {},
  };
  return normalizeUsage(result);
}

export function usageEntry(id: string, usage: StructuredUsage): LearningEntry {
  return { id, text: usage.kind ? USAGE_HEADINGS[usage.kind] : '', meaningZh: '', usageKind: usage.kind, usage };
}
export function upgradeUsageDetails(details: VocabularyDetails): VocabularyDetails {
  return { ...details, sections: { ...details.sections,
    usage: (details.sections.usage || []).map(entry => usageEntry(entry.id, structuredUsage(entry))),
  } };
}

/** Validate editable pairs together. Incomplete historical pairs remain in compatibility. */
export function usageValidationError(usage: StructuredUsage, generated = false): string | undefined {
  const historical = !!usage.compatibility && !generated;
  const required = (value: unknown) => typeof value === 'string' && !!value.trim();
  const pairs = (examples: UsageExample[] | undefined) => Array.isArray(examples) && examples.every(example =>
    required(example.english) && required(example.chinese));
  if (!isUsageKind(usage.kind)) return usage.compatibility && !generated ? undefined : '请选择用法类别。';
  switch (usage.kind) {
    case 'scenario':
      if (!usage.scenario || (!historical && (!required(usage.scenario.name) || !required(usage.scenario.explanation)))) return '请填写场景名称和中文用法说明。';
      if (!pairs(usage.scenario.examples)) return '请为每条例句同时填写英文和中文译文，或移除空例句。';
      break;
    case 'grammar':
      if (!usage.grammar || (!historical && (!required(usage.grammar.name) || !required(usage.grammar.explanation) || !required(usage.grammar.correct)))) return '请填写搭配规则名称、中文规则说明和正确搭配。';
      if (!pairs(usage.grammar.examples)) return '请为每条例句同时填写英文和中文译文，或移除空例句。';
      break;
    case 'comparison':
      if (!usage.comparison || (!historical && (!required(usage.comparison.context) || !required(usage.comparison.difference)))) return '请填写比较情境和核心区别。';
      if ((!historical && usage.comparison.expressions.length < 2) || usage.comparison.expressions.some(item => !required(item.expression) || !required(item.explanation))) return '请为对比表达填写单词或词组和中文语义说明。';
      if (usage.comparison.expressions.some(item => !pairs(item.examples))) return '请为每条对比例句同时填写英文和中文译文。';
      break;
    case 'error':
      if (!usage.error || (!historical && (!required(usage.error.name) || !required(usage.error.incorrect) || !required(usage.error.correct) || !required(usage.error.reason)))) return '请填写错误类型、错误表达、正确表达和错误原因。';
      if (!['incorrect', 'unnatural'].includes(usage.error.severity)) return '请选择表达问题的性质。';
      if (!pairs(usage.error.examples)) return '请为每条修正例句同时填写英文和中文译文。';
      break;
  }
}

export function compatibilityHasContent(usage: StructuredUsage) {
  const old = usage.compatibility;
  return !!old && !!(old.title.trim() || old.explanation.trim() || old.note.trim() || old.extra.trim() || old.examples.length);
}

export function usageHasContent(usage: StructuredUsage): boolean {
  const content = usage.kind ? usage[usage.kind] : undefined;
  const hasText = (value: unknown): boolean => {
    if (typeof value === 'string') return !!value.trim();
    if (Array.isArray(value)) return value.some(hasText);
    if (value && typeof value === 'object') return Object.entries(value).some(([key, item]) => key !== 'id' && key !== 'severity' && hasText(item));
    return false;
  };
  return hasText(content) || compatibilityHasContent(usage);
}
