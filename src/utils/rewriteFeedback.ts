import type { RewriteEvaluation } from '../types';

// Compare formatting only. Changed words (including negation/names/numbers) retain both examples.
function comparable(text: string) {
  let value = text.trim().replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  if (value.startsWith('"') && value.endsWith('"') && !value.slice(1, -1).includes('"')) value = value.slice(1, -1).trim();
  return value.replace(/\s+([,.!?;:])/g, '$1');
}
export function rewriteExamples(evaluation: RewriteEvaluation) {
  const improved = evaluation.improvedVersion?.trim();
  const reference = evaluation.referenceAnswer?.trim();
  if (improved && reference && comparable(improved) !== comparable(reference)) {
    return [{ label: '润色建议', text: evaluation.improvedVersion }, { label: '参考范例', text: evaluation.referenceAnswer }];
  }
  const text = improved ? evaluation.improvedVersion : reference ? evaluation.referenceAnswer : '';
  return text ? [{ label: '', text }] : [];
}
