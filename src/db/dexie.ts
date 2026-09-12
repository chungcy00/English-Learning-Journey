import Dexie, { Table } from 'dexie';
import { ReadingRecord, VocabularyItem, ReviewLog, AppSettings, VocabStatus, ReviewRating } from '../types';

export interface RewriteRecord {
  id?: number;
  readingId: string;
  originalSentence: string;
  target: string;
  userAnswer: string;
  rating: string;
  createdAt: number;
}

export interface UserNote {
  id?: number;
  targetId: string; // readingId or vocabId
  content: string;
  createdAt: number;
  updatedAt: number;
}

export class EnglishLearningDatabase extends Dexie {
  readings!: Table<ReadingRecord, string>;
  vocabulary!: Table<VocabularyItem, string>;
  reviews!: Table<ReviewLog, number>;
  rewriteRecords!: Table<RewriteRecord, number>;
  notes!: Table<UserNote, number>;

  constructor() {
    super('EnglishLearningDB');
    this.version(1).stores({
      readings: 'id, createdAt, topic, cefrLevel, readingType',
      vocabulary: 'id, term, status, nextReviewDate, createdAt, updatedAt',
      reviews: '++id, vocabularyId, reviewedAt, rating',
      rewriteRecords: '++id, readingId, target, createdAt',
      notes: '++id, targetId, createdAt'
    });
  }
}

export const db = new EnglishLearningDatabase();

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  cefr: 'B1',
  defaultReadingType: 'random',
  vocabularyCount: 8,
  defaultLength: 'medium',
  theme: 'warm',
  targetLanguage: 'zh-CN'
};

const SETTINGS_KEY = 'english_learning_settings';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to parse settings from localStorage', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

// Initial Seed for new users so the app opens with rich contextual content
export async function seedInitialDataIfNeeded() {
  const count = await db.readings.count();
  if (count > 0) return;

  const now = Date.now();
  const sampleReadingId = 'seed_thoughtful_relationship_01';

  const initialVocabs: VocabularyItem[] = [
    {
      id: 'vocab_genuine',
      term: 'genuine',
      type: 'word',
      phonetic: '/ˈdʒen.ju.ɪn/',
      partOfSpeech: 'adjective',
      meaningZh: '真诚的；真实的',
      definitionEn: 'Real, honest and sincere rather than fake or pretended.',
      example: 'She showed genuine concern for her friend during a difficult week.',
      collocations: ['genuine interest', 'genuine concern', 'genuine smile', 'genuine feeling'],
      sourceReadingId: sampleReadingId,
      status: 'Learning',
      createdAt: now - 86400000,
      updatedAt: now,
      nextReviewDate: now - 1000, // available for review right away
      reviewCount: 1,
      currentInterval: 1,
      lastRating: 'Good'
    },
    {
      id: 'vocab_considerate',
      term: 'considerate',
      type: 'word',
      phonetic: '/kənˈsɪd.ər.ət/',
      partOfSpeech: 'adjective',
      meaningZh: '体贴的；考虑周到的',
      definitionEn: 'Careful not to cause inconvenience or hurt to others; thoughtful.',
      example: 'It was very considerate of Leo to remember her favorite chamomile tea.',
      collocations: ['considerate behavior', 'very considerate of', 'kind and considerate'],
      sourceReadingId: sampleReadingId,
      status: 'New',
      createdAt: now,
      updatedAt: now,
      nextReviewDate: now,
      reviewCount: 0,
      currentInterval: 0
    },
    {
      id: 'vocab_undivided_attention',
      term: 'undivided attention',
      type: 'phrase',
      phonetic: '/ˌʌn.dɪˈvaɪ.dɪd əˈten.ʃən/',
      partOfSpeech: 'noun phrase',
      meaningZh: '专注；专心致志的注意',
      definitionEn: 'Complete attention without any distractions.',
      example: 'When Maya spoke about her art project, he gave her his undivided attention.',
      collocations: ['give undivided attention', 'receive undivided attention', 'demand undivided attention'],
      sourceReadingId: sampleReadingId,
      status: 'New',
      createdAt: now,
      updatedAt: now,
      nextReviewDate: now,
      reviewCount: 0,
      currentInterval: 0
    },
    {
      id: 'vocab_rooted',
      term: 'rooted',
      type: 'word',
      phonetic: '/ˈruː.tɪd/',
      partOfSpeech: 'adjective',
      meaningZh: '扎根的；牢固建立的',
      definitionEn: 'Deeply established, firmly based or grounded in something.',
      example: 'Their partnership was rooted in mutual respect and unhurried trust.',
      collocations: ['rooted in', 'deeply rooted', 'firmly rooted'],
      sourceReadingId: sampleReadingId,
      status: 'New',
      createdAt: now,
      updatedAt: now,
      nextReviewDate: now,
      reviewCount: 0,
      currentInterval: 0
    },
    {
      id: 'vocab_hesitate',
      term: 'hesitate',
      type: 'word',
      phonetic: '/ˈhez.ɪ.teɪt/',
      partOfSpeech: 'verb',
      meaningZh: '犹豫；踌躇',
      definitionEn: 'To pause before saying or doing something, often due to doubt or uncertainty.',
      example: 'She did not hesitate to ask for honest guidance when facing a critical choice.',
      collocations: ['hesitate to do something', 'hesitate for a moment', 'without hesitating'],
      sourceReadingId: sampleReadingId,
      status: 'New',
      createdAt: now,
      updatedAt: now,
      nextReviewDate: now,
      reviewCount: 0,
      currentInterval: 0
    }
  ];

  const sampleReading: ReadingRecord = {
    id: sampleReadingId,
    title: 'A Thoughtful Relationship',
    content: `Maya had had a demanding afternoon at the studio, with deadlines pressing closely and rain tapping softly against the tall glass windows. When Leo arrived at the cafe, he did not immediately rush into conversation about his own busy day. Instead, his concern was genuine, and their calm bond felt firmly rooted in quiet empathy.

As Maya unpacked her sketches and began explaining what felt unresolved in her design, Leo set his phone aside and gave her his undivided attention. There was no pressure to perform or offer quick, shallow solutions. Because he was naturally considerate, he simply listened, asking gentle questions whenever she hesitated. For Maya, having a companion who listened with genuine curiosity turned an exhausting day into an evening of quiet reassurance.`,
    topic: '体贴的男朋友 (A thoughtful boyfriend)',
    input: '体贴的男朋友',
    cefrLevel: 'B1',
    readingType: 'story',
    length: 'medium',
    selectedVocabulary: initialVocabs,
    rewritePractice: [
      {
        id: 'rw_01',
        originalSentence: 'He listened carefully when she spoke about her artwork.',
        target: 'undivided attention',
        referenceAnswer: 'He gave her his undivided attention when she spoke about her artwork.'
      },
      {
        id: 'rw_02',
        originalSentence: 'His caring attitude was real and not fake at all.',
        target: 'genuine',
        referenceAnswer: 'His concern was genuine and completely sincere.'
      },
      {
        id: 'rw_03',
        originalSentence: 'Their friendship was firmly based on mutual respect.',
        target: 'rooted',
        referenceAnswer: 'Their relationship was rooted in mutual respect.'
      },
      {
        id: 'rw_04',
        originalSentence: 'He was very thoughtful and brought her favorite tea.',
        target: 'considerate',
        referenceAnswer: 'Because he was considerate, he brought her favorite tea.'
      }
    ],
    humanised: true,
    createdAt: now,
    updatedAt: now
  };

  await db.readings.put(sampleReading);
  await db.vocabulary.bulkPut(initialVocabs);
}

// Spaced repetition interval calculator (PRD Section 29)
// Again → 0 (today)
// Hard → 1 day
// Good → 3 days
// Easy → 7 days
export async function updateVocabularyReview(vocabId: string, rating: ReviewRating) {
  const vocab = await db.vocabulary.get(vocabId);
  if (!vocab) return;

  const now = Date.now();
  let intervalDays = 0;
  let newStatus: VocabStatus = vocab.status;

  if (rating === 'Again') {
    intervalDays = 0;
    newStatus = 'Difficult';
  } else if (rating === 'Hard') {
    intervalDays = 1;
    newStatus = vocab.status === 'New' ? 'Learning' : vocab.status;
  } else if (rating === 'Good') {
    intervalDays = vocab.currentInterval === 0 ? 3 : Math.max(3, vocab.currentInterval * 1.5);
    newStatus = vocab.reviewCount >= 3 ? 'Mastered' : 'Learning';
  } else if (rating === 'Easy') {
    intervalDays = vocab.currentInterval === 0 ? 7 : Math.max(7, vocab.currentInterval * 2);
    newStatus = 'Mastered';
  }

  const nextReviewDate = intervalDays === 0 ? now + 60000 * 30 : now + intervalDays * 86400000;

  const updated: VocabularyItem = {
    ...vocab,
    status: newStatus,
    reviewCount: (vocab.reviewCount || 0) + 1,
    currentInterval: Math.round(intervalDays),
    lastReviewedAt: now,
    nextReviewDate,
    lastRating: rating,
    updatedAt: now
  };

  await db.vocabulary.put(updated);
  await db.reviews.add({
    vocabularyId: vocabId,
    rating,
    reviewedAt: now,
    interval: intervalDays
  });

  return updated;
}

// Data Export & Import (PRD Section 45, 46)
export interface BackupData {
  version: number;
  exportedAt: string;
  vocabulary: VocabularyItem[];
  readings: ReadingRecord[];
  reviews: ReviewLog[];
  rewritePractice: RewriteRecord[];
  notes: UserNote[];
  settings: AppSettings;
}

export async function exportMyData(): Promise<string> {
  const [vocabulary, readings, reviews, rewritePractice, notes] = await Promise.all([
    db.vocabulary.toArray(),
    db.readings.toArray(),
    db.reviews.toArray(),
    db.rewriteRecords.toArray(),
    db.notes.toArray()
  ]);

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    vocabulary,
    readings,
    reviews,
    rewritePractice,
    notes,
    settings: loadSettings()
  };

  return JSON.stringify(backup, null, 2);
}

export async function importMyData(jsonString: string): Promise<{
  vocabularyCount: number;
  readingsCount: number;
  reviewsCount: number;
}> {
  const parsed = JSON.parse(jsonString) as Partial<BackupData>;

  if (!parsed || (!parsed.vocabulary && !parsed.readings)) {
    throw new Error('Invalid backup file structure.');
  }

  await db.transaction('rw', [db.vocabulary, db.readings, db.reviews, db.rewriteRecords, db.notes], async () => {
    if (parsed.vocabulary && Array.isArray(parsed.vocabulary)) {
      await db.vocabulary.bulkPut(parsed.vocabulary);
    }
    if (parsed.readings && Array.isArray(parsed.readings)) {
      await db.readings.bulkPut(parsed.readings);
    }
    if (parsed.reviews && Array.isArray(parsed.reviews)) {
      await db.reviews.bulkPut(parsed.reviews);
    }
    if (parsed.rewritePractice && Array.isArray(parsed.rewritePractice)) {
      await db.rewriteRecords.bulkPut(parsed.rewritePractice);
    }
    if (parsed.notes && Array.isArray(parsed.notes)) {
      await db.notes.bulkPut(parsed.notes);
    }
  });

  if (parsed.settings) {
    saveSettings(parsed.settings);
  }

  return {
    vocabularyCount: parsed.vocabulary?.length || 0,
    readingsCount: parsed.readings?.length || 0,
    reviewsCount: parsed.reviews?.length || 0
  };
}

// Convenient CRUD helpers for components
export const initDefaultData = seedInitialDataIfNeeded;
export const exportAllData = exportMyData;
export const importDataBackup = importMyData;
export const getSettings = loadSettings;

export async function getAllReadings(): Promise<ReadingRecord[]> {
  return db.readings.orderBy('createdAt').reverse().toArray();
}

export async function saveReading(reading: ReadingRecord): Promise<string> {
  return db.readings.put(reading);
}

export async function deleteReading(id: string): Promise<void> {
  return db.readings.delete(id);
}

export async function getAllVocabularies(): Promise<VocabularyItem[]> {
  return db.vocabulary.orderBy('createdAt').reverse().toArray();
}

export async function saveVocabulary(vocab: VocabularyItem): Promise<string> {
  return db.vocabulary.put(vocab);
}

export async function deleteVocabulary(id: string): Promise<void> {
  return db.vocabulary.delete(id);
}

export async function getDueReviews(): Promise<VocabularyItem[]> {
  return db.vocabulary.where('nextReviewDate').belowOrEqual(Date.now()).toArray();
}

export const recordReview = updateVocabularyReview;
