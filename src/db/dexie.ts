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

export interface DialogueAudioRecord {
  id: string;
  audio: Blob;
  mimeType: string;
  createdAt: number;
  lastPlayedAt: number;
}

export class EnglishLearningDatabase extends Dexie {
  readings!: Table<ReadingRecord, string>;
  vocabulary!: Table<VocabularyItem, string>;
  reviews!: Table<ReviewLog, number>;
  rewriteRecords!: Table<RewriteRecord, number>;
  notes!: Table<UserNote, number>;
  dialogueAudio!: Table<DialogueAudioRecord, string>;

  constructor() {
    super('EnglishLearningDB');
    this.version(1).stores({
      readings: 'id, createdAt, topic, cefrLevel, readingType',
      vocabulary: 'id, term, status, nextReviewDate, createdAt, updatedAt',
      reviews: '++id, vocabularyId, reviewedAt, rating',
      rewriteRecords: '++id, readingId, target, createdAt',
      notes: '++id, targetId, createdAt'
    });
    this.version(2).stores({
      readings: 'id, createdAt, topic, cefrLevel, readingType',
      vocabulary: 'id, term, status, nextReviewDate, createdAt, updatedAt',
      reviews: '++id, vocabularyId, reviewedAt, rating',
      rewriteRecords: '++id, readingId, target, createdAt',
      notes: '++id, targetId, createdAt',
      dialogueAudio: 'id, createdAt, lastPlayedAt'
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
  const sampleReadingId = 'seed_thoughtful_relationship_01';
  const existingSeed = await db.readings.get(sampleReadingId);

  // Existing user-created readings are never touched. The former bundled sample
  // is migrated once in place so returning users also receive the new default.
  if (count > 0 && !existingSeed) return;
  if (existingSeed && !existingSeed.topic.includes('体贴的男朋友')) return;

  const now = Date.now();

  let initialVocabs: VocabularyItem[] = [
    {
      id: 'vocab_genuine',
      term: 'genuine',
      type: 'word',
      phonetic: '/ˈdʒen.ju.ɪn/',
      partOfSpeech: 'adjective',
      meaningZh: '真诚的；真实的',
      definitionEn: 'Real, honest and sincere rather than fake or pretended.',
      example: 'The warm welcome at the pop-up book corner felt completely genuine.',
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
      example: 'It was considerate of the shop owner to lend umbrellas to visitors.',
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
      example: 'The volunteer gave the lost visitor her undivided attention.',
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
      example: 'The neighborhood tradition was rooted in kindness and trust.',
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
      example: 'Maya did not hesitate to join the unexpected gathering.',
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

  if (existingSeed) {
    const storedVocabs = await db.vocabulary.bulkGet(initialVocabs.map(vocab => vocab.id));
    initialVocabs = initialVocabs.map((vocab, index) => {
      const stored = storedVocabs[index];
      if (!stored) return vocab;
      return {
        ...vocab,
        status: stored.status,
        createdAt: stored.createdAt,
        nextReviewDate: stored.nextReviewDate,
        lastReviewedAt: stored.lastReviewedAt,
        reviewCount: stored.reviewCount,
        currentInterval: stored.currentInterval,
        lastRating: stored.lastRating,
        translations: stored.translations,
      };
    });
  }

  const sampleReading: ReadingRecord = {
    id: sampleReadingId,
    title: 'Rainy Day Surprises',
    content: `On a rainy Saturday, Maya hurried toward her favorite neighborhood bookshop, hoping to stay dry and finish a novel. When she arrived, the door was locked and a handwritten sign pointed visitors to the café next door. She hesitated, certain the afternoon had been ruined.

Inside, however, the bookshop team had created a surprise reading corner. Lamps glowed beside the windows, strangers shared tables, and the owner offered everyone a warm drink. A considerate volunteer found Maya a dry seat and gave her his undivided attention while she explained which book she had been searching for.

A few minutes later, someone discovered a copy on the exchange shelf. Maya opened it and found a cheerful note from its previous reader. The message was simple but genuine: “Rainy days sometimes lead us somewhere better.” By evening, the room was full of laughter. What began as a disappointing change of plans became a small community memory, rooted in kindness.`,
    topic: '雨天里的小惊喜',
    input: '雨天里的小惊喜',
    cefrLevel: 'B1',
    readingType: 'story',
    length: 'medium',
    selectedVocabulary: initialVocabs,
    rewritePractice: [
      {
        id: 'rw_01',
        originalSentence: 'The volunteer listened carefully while Maya explained what she needed.',
        target: 'undivided attention',
        referenceAnswer: 'The volunteer gave Maya his undivided attention while she explained what she needed.'
      },
      {
        id: 'rw_02',
        originalSentence: 'The welcome at the reading corner felt warm and sincere.',
        target: 'genuine',
        referenceAnswer: 'The welcome at the reading corner felt warm and genuine.'
      },
      {
        id: 'rw_03',
        originalSentence: 'The neighborhood tradition was firmly based on kindness.',
        target: 'rooted',
        referenceAnswer: 'The neighborhood tradition was rooted in kindness.'
      },
      {
        id: 'rw_04',
        originalSentence: 'The shop owner thoughtfully provided umbrellas for visitors.',
        target: 'considerate',
        referenceAnswer: 'It was considerate of the shop owner to provide umbrellas for visitors.'
      }
    ],
    humanised: true,
    createdAt: existingSeed?.createdAt || now,
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
