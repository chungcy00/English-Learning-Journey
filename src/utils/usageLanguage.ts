// Explanations use Chinese; English words, collocations and sentence frames can
// remain inline. A long English passage belongs in a separate example, not prose.
export function isChineseUsageExplanation(value: string) {
  if (!/[\u3400-\u9fff]/.test(value)) return false;
  return !value.split(/[\u3400-\u9fff]/).some(part => (part.match(/[a-z]+(?:['’-][a-z]+)*/gi) || []).length > 14);
}
export function isLegacyEnglishExplanation(value = '') {
  if (!value.trim()) return false;
  if (/[\u3400-\u9fff]/.test(value)) return !isChineseUsageExplanation(value);
  // Retain short word/phrase headings; full English prose is opt-in legacy data.
  return (value.match(/[a-z]+(?:['’-][a-z]+)*/gi) || []).length > 5 || /[.!?]\s*$/.test(value.trim());
}
