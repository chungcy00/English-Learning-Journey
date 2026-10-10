import type { VocabularyItem } from '../types';

export async function toggleWordDetailBookmark(
  vocab: VocabularyItem,
  items: VocabularyItem[],
  readingId: string | undefined,
  removed: Map<string, VocabularyItem>,
  store: { save: (item: VocabularyItem) => Promise<unknown>; remove: (id: string) => Promise<void> },
  isCurrentlySaved = items.some(item => item.term.toLowerCase() === vocab.term.toLowerCase()),
): Promise<VocabularyItem[]> {
  const key = vocab.term.toLowerCase();
  const existing = items.find(item => item.term.toLowerCase() === key);
  if (existing && isCurrentlySaved) {
    await store.remove(existing.id);
    removed.set(key, existing);
    return items.filter(item => item.id !== existing.id);
  }
  // Undo restores the actual saved record, including all review scheduling fields.
  const restored = removed.get(key);
  const item = restored || { ...(existing || vocab), savedManually: true, addedFromReadingIds: [...new Set([...(existing?.addedFromReadingIds || vocab.addedFromReadingIds || []), ...(readingId ? [readingId] : [])])] };
  await store.save(item);
  removed.delete(key);
  return [...items.filter(previous => previous.id !== item.id), item];
}
