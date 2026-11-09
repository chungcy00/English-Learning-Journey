import type { LearningEntry, WordPart } from '../types';

export function partOfSpeechAbbreviation(value = '') {
  const labels: Record<string,string> = { noun:'n.', verb:'v.', adjective:'adj.', adverb:'adv.', pronoun:'pron.', preposition:'prep.', conjunction:'conj.', interjection:'interj.', determiner:'det.', article:'art.', '名词':'n.', '动词':'v.', '形容词':'adj.', '副词':'adv.', '代词':'pron.', '介词':'prep.', '连词':'conj.', '感叹词':'interj.', '限定词':'det.', '冠词':'art.' };
  return value.replace(/intransitive verb|transitive verb|noun|verb|adjective|adverb|pronoun|preposition|conjunction|interjection|determiner|article|名词|动词|形容词|副词|代词|介词|连词|感叹词|限定词|冠词/gi, word => word.toLowerCase() === 'intransitive verb' ? 'vi.' : word.toLowerCase() === 'transitive verb' ? 'vt.' : labels[word.toLowerCase()] || word);
}
export function hasExactParts(parts: unknown, word: string): parts is WordPart[] {
  return Array.isArray(parts) && parts.length > 0 && parts.length <= 8 && parts.every(p => p && ['prefix','root','suffix'].includes(p.kind) && typeof p.text === 'string' && p.text.length > 0 && typeof p.meaningZh === 'string') && parts.some(p=>p.kind==='root') && parts.map(p=>p.text).join('').toLowerCase() === word.toLowerCase();
}
export interface FamilyNode { entry: LearningEntry; children: FamilyNode[] }
// Only explicit parent links create levels. Never derive edges from spelling.
// Invalid, cyclic and missing parent links fall back to a flat family member.
export function familyForest(entries: LearningEntry[]): FamilyNode[] {
  const nodes = entries.map(entry => ({ entry, children: [] as FamilyNode[] }));
  const key = (word: string) => word.trim().toLowerCase();
  const byWord = new Map(nodes.map(node=>[key(node.entry.text),node]));
  const roots: FamilyNode[] = [];
  for (const node of nodes) {
    let parent = node.entry.family?.parent ? byWord.get(key(node.entry.family.parent)) : undefined;
    const seen = new Set([node]);
    let ancestor = parent;
    while (ancestor) {
      if (seen.has(ancestor)) { parent = undefined; break; }
      seen.add(ancestor);
      ancestor = ancestor.entry.family?.parent ? byWord.get(key(ancestor.entry.family.parent)) : undefined;
    }
    if (parent) parent.children.push(node); else roots.push(node);
  }
  return roots;
}
