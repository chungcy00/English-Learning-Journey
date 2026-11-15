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

type LegacyUsageFields = { title?: string; explanation?: string; note?: string; examples?: UsageExample[] };

export function compatibilityHasContent(usage: StructuredUsage): boolean {
  const legacy = usage.compatibility;
  return !!legacy && [legacy.title, legacy.explanation, legacy.note, legacy.extra].some(value => !!value?.trim())
    || !!legacy?.examples.some(example => !!example.english.trim() || !!example.chinese.trim());
}

/** Migrate fields that have an unambiguous destination, then discard the old archive. */
function normalizeUsage(usage: StructuredUsage): StructuredUsage {
  const examplePairs = (examples: UsageExample[] = []) => examples.map(example => ({
    ...example, english: text(example.english), chinese: text(example.chinese),
  }));
  // Older saved structured records can omit optional strings or example arrays.
  // Fill display defaults without changing any authored text.
  if (usage.scenario) usage.scenario = {
    ...usage.scenario, name: text(usage.scenario.name), explanation: text(usage.scenario.explanation),
    tip: text(usage.scenario.tip), examples: examplePairs(usage.scenario.examples ?? []),
  };
  if (usage.grammar) usage.grammar = {
    ...usage.grammar, name: text(usage.grammar.name), explanation: text(usage.grammar.explanation),
    correct: text(usage.grammar.correct), restriction: text(usage.grammar.restriction),
    note: text(usage.grammar.note), examples: examplePairs(usage.grammar.examples ?? []),
  };
  if (usage.comparison) usage.comparison = {
    ...usage.comparison, context: text(usage.comparison.context), difference: text(usage.comparison.difference),
    note: text(usage.comparison.note), expressions: (usage.comparison.expressions ?? []).map(expression => ({
      ...expression, expression: text(expression.expression), examples: examplePairs(expression.examples ?? []),
    })),
  };
  if (usage.error) usage.error = {
    ...usage.error, name: text(usage.error.name), incorrect: text(usage.error.incorrect),
    correct: text(usage.error.correct), reason: text(usage.error.reason),
    note: text(usage.error.note), examples: examplePairs(usage.error.examples ?? []),
  };
  const old = (usage as StructuredUsage & { compatibility?: LegacyUsageFields }).compatibility;
  if (old && usage.kind === 'scenario' && usage.scenario) {
    usage.scenario.name ||= text(old.title);
    usage.scenario.explanation ||= text(old.explanation);
    usage.scenario.tip ||= text(old.note);
    if (!usage.scenario.examples.length) usage.scenario.examples = old.examples || [];
  }
  if (old && usage.kind === 'grammar' && usage.grammar) {
    usage.grammar.name ||= text(old.title);
    usage.grammar.explanation ||= text(old.explanation);
    usage.grammar.note ||= text(old.note);
    if (!usage.grammar.examples.length) usage.grammar.examples = old.examples || [];
  }
  if (old && usage.kind === 'comparison' && usage.comparison) {
    usage.comparison.context ||= text(old.title);
    usage.comparison.difference ||= text(old.explanation);
    usage.comparison.note ||= text(old.note);
    if (!usage.comparison.expressions.length && old.examples?.length) {
      usage.comparison.expressions = [{ id: crypto.randomUUID(), expression: '', explanation: '', examples: old.examples }];
    }
  }
  if (old && usage.kind === 'error' && usage.error) {
    usage.error.name ||= text(old.title);
    usage.error.reason ||= text(old.explanation);
    usage.error.note ||= text(old.note);
    if (!usage.error.examples.length) usage.error.examples = old.examples || [];
  }
  if (usage.comparison) usage.comparison.expressions = usage.comparison.expressions.map(item => {
    const old = item as unknown as Record<string, unknown>;
    const parts = [text(old.explanation), text(old.meaning), text(old.emphasis)].map(value => value.trim()).filter(Boolean);
    // Only remove exact duplicates or text already fully contained in another field.
    const descriptions = [...new Set(parts)].filter(value => !parts.some(other => other !== value && other.includes(value)));
    return { id: item.id, expression: item.expression, explanation: descriptions.map((value, index) =>
      index < descriptions.length - 1 && !/[。！？.!?]$/.test(value) ? `${value}。` : value).join(''), examples: item.examples };
  });
  delete (usage as StructuredUsage & { compatibility?: LegacyUsageFields }).compatibility;
  return usage;
}

export function structuredUsage(entry: LearningEntry): StructuredUsage {
  if (entry.usage?.version === 2) {
    const usage = structuredClone(entry.usage);
    if (!isUsageKind(usage.kind)) {
      const categories = usageKinds.filter(kind => usage[kind]);
      usage.kind = isUsageKind(entry.usageKind) ? entry.usageKind : categories.length === 1 ? categories[0] : undefined;
    }
    return normalizeUsage(usage);
  }
  const kind = isUsageKind(entry.usageKind) ? entry.usageKind : undefined;
  const examples: UsageExample[] = entry.example && entry.exampleTranslation
    ? [{ id: `${entry.id}-example`, english: entry.example, chinese: entry.exampleTranslation }] : [];
  const result: StructuredUsage = { version: 2, kind };
  const explanation = text(entry.meaningZh);
  if (kind === 'scenario') result.scenario = { name: '', explanation, examples, tip: '' };
  if (kind === 'grammar') result.grammar = { name: '', explanation, correct: '', restriction: '', examples, note: text(entry.note) };
  if (kind === 'comparison') result.comparison = { context: '', difference: explanation, expressions: [], note: text(entry.note) };
  if (kind === 'error') result.error = { name: '', severity: 'incorrect', incorrect: text(entry.contrast?.incorrect), correct: text(entry.contrast?.correct), reason: explanation, examples, note: text(entry.note) };
  const oldTitle = text(entry.text);
  const hasTitle = oldTitle.trim() && !Object.values(USAGE_HEADINGS).includes(oldTitle as typeof USAGE_HEADINGS[UsageKind]);
  if (result.scenario && hasTitle) result.scenario.name = oldTitle;
  if (result.grammar && hasTitle) result.grammar.name = oldTitle;
  if (result.comparison && hasTitle) result.comparison.context = oldTitle;
  if (result.error && hasTitle) result.error.name = oldTitle;
  if (result.scenario && entry.note) result.scenario.tip = entry.note;
  if (result.grammar && entry.note) result.grammar.note = entry.note;
  if (result.comparison && entry.note) result.comparison.note = entry.note;
  if (result.error && entry.note) result.error.note = entry.note;
  if (kind && kind !== 'comparison' && examples.length) {
    if (kind === 'scenario' && result.scenario) result.scenario.examples = examples;
    if (kind === 'grammar' && result.grammar) result.grammar.examples = examples;
    if (kind === 'error' && result.error) result.error.examples = examples;
  }
  return normalizeUsage(result);
}

export function usageEntry(id: string, usage: StructuredUsage): LearningEntry {
  return { id, text: usage.kind ? USAGE_HEADINGS[usage.kind] : '', meaningZh: '', usageKind: usage.kind, usage };
}
export function upgradeUsageDetails(details: VocabularyDetails): VocabularyDetails {
  return { ...details, sections: { ...details.sections,
    usage: (details.sections.usage || []).map(entry => usageEntry(entry.id, structuredUsage(entry))).filter(entry => isUsageKind(entry.usageKind)),
  } };
}

/** Validate editable pairs together. Incomplete historical pairs remain in compatibility. */
export function usageValidationError(usage: StructuredUsage, generated = false): string | undefined {
  const required = (value: unknown) => typeof value === 'string' && !!value.trim();
  const pairs = (examples: UsageExample[] | undefined) => Array.isArray(examples) && examples.every(example =>
    required(example.english) && required(example.chinese));
  if (!isUsageKind(usage.kind)) return '请选择用法类别。';
  switch (usage.kind) {
    case 'scenario':
      if (!usage.scenario || (!generated && (!required(usage.scenario.name) || !required(usage.scenario.explanation)))) return '请填写场景名称和中文用法说明。';
      if (!pairs(usage.scenario.examples)) return '请为每条例句同时填写英文和中文译文，或移除空例句。';
      break;
    case 'grammar':
      if (!usage.grammar || (!generated && (!required(usage.grammar.name) || !required(usage.grammar.explanation)))) return '请填写搭配规则名称和中文规则说明。';
      if (!pairs(usage.grammar.examples)) return '请为每条例句同时填写英文和中文译文，或移除空例句。';
      break;
    case 'comparison':
      if (!usage.comparison || (!generated && (!required(usage.comparison.context) || !required(usage.comparison.difference)))) return '请填写比较情境和核心区别。';
      if (!generated && usage.comparison.expressions.length < 2) return '近义词比较至少需要两个对比表达，请添加表达后再保存。';
      if (usage.comparison.expressions.some(item => !required(item.expression) || !required(item.explanation))) return '请为对比表达填写单词或词组和中文语义说明。';
      if (usage.comparison.expressions.some(item => !pairs(item.examples))) return '请为每条对比例句同时填写英文和中文译文。';
      break;
    case 'error':
      if (!usage.error || (!generated && (!required(usage.error.name) || !required(usage.error.incorrect) || !required(usage.error.correct) || !required(usage.error.reason)))) return usage.error?.severity === 'unnatural' ? '请填写问题名称、原表达、更自然的表达和改进原因。' : '请填写问题名称、错误表达、正确表达和错误原因。';
      if (!['incorrect', 'unnatural'].includes(usage.error.severity)) return '请选择表达问题的性质。';
      if (!pairs(usage.error.examples)) return '请为每条修正例句同时填写英文和中文译文。';
      break;
  }
}

export function usageHasContent(usage: StructuredUsage): boolean {
  const content = usage.kind ? usage[usage.kind] : undefined;
  const hasText = (value: unknown): boolean => {
    if (typeof value === 'string') return !!value.trim();
    if (Array.isArray(value)) return value.some(hasText);
    if (value && typeof value === 'object') return Object.entries(value).some(([key, item]) => key !== 'id' && key !== 'severity' && hasText(item));
    return false;
  };
  return hasText(content);
}
