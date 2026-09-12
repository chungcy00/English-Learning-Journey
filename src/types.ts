export type CEFRLevel = 'A2' | 'B1' | 'B2' | 'C1';
export type ReadingType = 'story' | 'non-story' | 'dialogue' | 'random';
export type ReadingLength = 'short' | 'medium' | 'long';
export type VocabStatus = 'New' | 'Learning' | 'Difficult' | 'Mastered';
export type ReviewRating = 'Again' | 'Hard' | 'Good' | 'Easy';
export type RewriteRating = 'Excellent' | 'Very Good' | 'Good' | 'Needs Improvement';

export interface VocabularyItem {
  id: string;
  term: string;
  type: 'word' | 'phrase';
  phonetic: string;
  partOfSpeech: string;
  meaningZh: string;
  definitionEn: string;
  example: string;
  collocations: string[];
  sourceReadingId?: string;
  status: VocabStatus;
  createdAt: number;
  updatedAt: number;
  nextReviewDate: number;
  lastReviewedAt?: number;
  reviewCount: number;
  currentInterval: number; // in days (0 for again, 1, 3, 7)
  lastRating?: ReviewRating;
  translations?: Record<string, { meaning: string; exampleTranslation?: string }>;
}

export interface RewritePracticeItem {
  id: string;
  originalSentence: string;
  target: string;
  referenceAnswer: string;
  userAnswer?: string;
  evaluation?: RewriteEvaluation;
}

export interface RewriteIssue {
  original: string;
  correction: string;
  explanation: string;
}

export interface RewriteEvaluation {
  rating: RewriteRating;
  meaningPreserved: boolean;
  targetUsedCorrectly: boolean;
  whatYouDidWell: string[];
  issues: RewriteIssue[];
  improvedVersion: string;
  referenceAnswer: string;
}

export interface ReadingTranslation {
  language: string;
  languageName: string;
  title: string;
  translatedContent: string;
  humanised?: boolean;
  vocabularyTranslations?: Record<string, { meaning: string; exampleTranslation?: string }>;
  exerciseTranslations?: Record<string, { originalSentenceMeaning: string; promptHint?: string }>;
  updatedAt: number;
}

export interface ReadingRecord {
  id: string;
  title: string;
  content: string;
  topic: string;
  input: string;
  cefrLevel: CEFRLevel;
  readingType: 'story' | 'non-story' | 'dialogue';
  length: ReadingLength;
  selectedVocabulary: VocabularyItem[];
  rewritePractice: RewritePracticeItem[];
  humanised: boolean;
  translations?: Record<string, ReadingTranslation>;
  createdAt: number;
  updatedAt: number;
}

export interface ReviewLog {
  id?: number;
  vocabularyId: string;
  rating: ReviewRating;
  reviewedAt: number;
  interval: number;
}

export interface AppSettings {
  cefr: CEFRLevel;
  defaultReadingType: ReadingType;
  vocabularyCount: number;
  defaultLength: ReadingLength;
  theme?: string;
  targetLanguage?: string;
}

export interface GenerationRequest {
  input: string;
  cefrLevel: CEFRLevel;
  readingType: ReadingType;
  length: ReadingLength;
  vocabularyCount: number;
  specifiedVocabulary?: string[];
  targetLanguage?: string;
}

export interface RewriteReadingRequest {
  readingId?: string;
  reading: string;
  currentVocabulary?: string[];
  mode: 'easier' | 'harder' | 'shorter' | 'longer' | 'moreConversational' | 'story' | 'non-story' | 'dialogue';
  keepCurrentVocabulary?: boolean;
  keepVocabulary?: boolean;
  cefrLevel: CEFRLevel;
}

export interface RewriteReadingResponse {
  title?: string;
  reading?: string;
  readingType?: ReadingType;
  cefrLevel?: CEFRLevel;
  humanised?: boolean;
  vocabulary?: VocabularyItem[];
  rewritePractice?: RewritePracticeItem[];
}
