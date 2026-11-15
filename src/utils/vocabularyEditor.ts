import type { DetailSection, LearningEntry, UsageExample, VocabularyDetails } from '../types';

export type EditorSection = DetailSection | 'basic';
export function editorSnapshot(details: VocabularyDetails, section: EditorSection) {
  return JSON.stringify(section === 'basic'
    ? { phoneticUK: details.phoneticUK, phoneticUS: details.phoneticUS, senses: details.senses, inflections: details.inflections }
    : details.sections[section]);
}

/** Convert old sentence/association layouts once, before the user starts typing. */
export function editableExample(entry: LearningEntry): LearningEntry {
  if (!entry.example) return { ...entry };
  const { example, exampleTranslation, ...rest } = entry;
  return { ...rest, text: example, meaningZh: exampleTranslation || '',
    associatedExpression: entry.associatedExpression || (entry.text !== example ? entry.text : ''),
    associatedMeaningZh: entry.associatedMeaningZh || entry.meaningZh,
    senseMeaningZh: entry.senseMeaningZh || (!entry.senseId ? entry.meaningZh : '') };
}

export function editableRoot(entry: LearningEntry): LearningEntry {
  if (!entry.morphology) return { ...entry };
  const legacy = entry.morphology as typeof entry.morphology & { root?: string; meaningZh?: string };
  const { root, meaningZh, ...morphology } = legacy;
  const parts = morphology.parts.map(part => ({ ...part }));
  const index = parts.findIndex(part => part.kind === 'root');
  if (index < 0 && root?.trim()) {
    const suffix = parts.findIndex(part => part.kind === 'suffix');
    parts.splice(suffix < 0 ? parts.length : suffix, 0, { kind: 'root', text: root, meaningZh: meaningZh || '' });
  } else if (index >= 0 && root?.trim() === parts[index].text.trim() && !parts[index].meaningZh.trim()) {
    parts[index].meaningZh = meaningZh || '';
  }
  return { ...entry, text: '', meaningZh: '', morphology: { ...morphology, parts } };
}

export function entryExamples(entry: LearningEntry): UsageExample[] {
  const examples = [...(entry.examples || [])];
  if ((entry.example || entry.exampleTranslation) && !examples.some(pair => pair.english === (entry.example || '') && pair.chinese === (entry.exampleTranslation || ''))) {
    examples.unshift({ id: `${entry.id}-example`, english: entry.example || '', chinese: entry.exampleTranslation || '' });
  }
  return examples;
}

export function prepareEditor(details: VocabularyDetails, section: EditorSection) {
  const next = structuredClone(details);
  if (section === 'examples') next.sections.examples = next.sections.examples.map(editableExample);
  if (section === 'roots') next.sections.roots = next.sections.roots.map(editableRoot);
  return next;
}
