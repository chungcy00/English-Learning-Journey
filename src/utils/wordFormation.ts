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

export function derivativeDiagramBase(entries: LearningEntry[], term: string, inflections: string[]) {
  const normalize = (word: string) => word.trim().toLowerCase();
  const base = entries[0]?.family?.base?.trim();
  if (!base || !/^[a-z]+(?:[-'][a-z]+)*$/i.test(base)) return undefined;
  const names = entries.map(entry => normalize(entry.text));
  const members = new Set(names);
  const excluded = new Set([term, base, ...inflections].map(normalize));
  if (members.size !== entries.length || names.some(name => !name || excluded.has(name))) return undefined;

  const parents = new Map<string, string>();
  const externalParents = new Set<string>();
  for (const entry of entries) {
    if (!entry.family?.relation?.trim() || normalize(entry.family.base || '') !== normalize(base)) return undefined;
    const parent = entry.family.parent?.trim();
    if (!parent) continue;
    const parentName = normalize(parent);
    if (!members.has(parentName)) {
      if (parentName !== normalize(base) && parentName !== normalize(term)) return undefined;
      externalParents.add(parentName);
    }
    parents.set(normalize(entry.text), parentName);
  }

  for (const name of names) {
    const seen = new Set([name]);
    for (let parent = parents.get(name); parent; parent = parents.get(parent)) {
      if (seen.has(parent)) return undefined;
      seen.add(parent);
    }
  }
  if (externalParents.size > 1 || (term.trim() && normalize(term) !== normalize(base) && !externalParents.has(normalize(term)))) return undefined;
  return externalParents.has(normalize(term)) ? term.trim() : base;
}

// American Heritage entries for hesitate, adhere, inherent and inhere trace these to haerēre.
const latinHaerere = new Set(['hesitate', 'adhere', 'inherent']);
const historicalLanguage = /拉丁|希腊语|古(?:英语|法语|德语)|中古英语|原始印欧|历史|词源|同源|源自|源于|追溯|演变|\b(?:latin|greek|etymolog\w*|old english|middle english|proto-indo-european)\b/i;

export function practicalFormationText(text = '') {
  return text.split(/(?<=[。！？])|(?<=[.!?])(?=\s|$)/)
    .filter(sentence => !historicalLanguage.test(sentence)).join('').trim();
}

export function hasMatchingRoot(term: string, parts: WordPart[], related: string, relatedParts?: WordPart[]) {
  const pair = [term, related].map(word => word.trim().toLowerCase());
  if (pair[0] !== pair[1] && pair.every(word => latinHaerere.has(word))) return false;
  // Inherit comes from hērēs (heir), despite its resemblance to inherent.
  if (pair.includes('inherit') && pair.some(word => latinHaerere.has(word))) return false;
  if (!hasExactParts(parts, term) || !hasExactParts(relatedParts, related)) return false;
  const rootKey = (part: WordPart) => `${part.text.toLowerCase()}:${part.meaningZh.trim()}`;
  const roots = new Set(parts.filter(part => part.kind === 'root' && part.meaningZh.trim()).map(rootKey));
  return relatedParts.some(part => part.kind === 'root' && roots.has(rootKey(part)));
}

export function hasTransparentDerivation(parent: string, child: string, parts?: WordPart[]) {
  if (!hasExactParts(parts, child)) return false;
  const key = parent.trim().toLowerCase();
  const prefixes = /^(?:un|re|dis|mis|non|pre|post|over|under)$/i;
  const suffixes = /^(?:ness|ly|less|ful|ment|er|able|ible|ish|ize|ise|ity|al|ous|ism|ist|ship|hood)$/i;
  return parts.some((part, index) =>
    (index === 0 && part.kind === 'prefix' && prefixes.test(part.text) && child.slice(part.text.length).toLowerCase() === key)
    || (index === parts.length - 1 && part.kind === 'suffix' && suffixes.test(part.text) && child.slice(0, -part.text.length).toLowerCase() === key));
}

// Origins traces these three English forms through different Latin forms of haesitāre.
export function verifiedWordFamilyRelation(term: string, word: string) {
  if (term.trim().toLowerCase() === 'considerate') {
    switch (word.trim().toLowerCase()) {
      case 'considerately': return '加 -ly，表示以体贴的方式。';
      case 'considerateness': return '加 -ness，表示体贴这一品质。';
      case 'inconsiderate': return '加否定前缀 in-，表示不体贴或没有顾及他人。';
      default: return undefined;
    }
  }
  if (term.trim().toLowerCase() !== 'hesitate') return undefined;
  switch (word.trim().toLowerCase()) {
    case 'hesitation': return 'hesitation 是表示「犹豫」的名词。';
    case 'hesitant': return 'hesitant 是表示「迟疑的」的形容词。';
    default: return undefined;
  }
}
