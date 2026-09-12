/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProcessingModal } from './components/ProcessingModal';
import { ReadingHistoryModal } from './components/ReadingHistoryModal';
import { HomeView } from './views/HomeView';
import { ReadingView } from './views/ReadingView';
import { WordbookView } from './views/WordbookView';
import { ReviewView } from './views/ReviewView';

import {
  ReadingRecord,
  VocabularyItem,
  AppSettings,
  CEFRLevel,
  ReadingType,
  ReadingLength,
  VocabStatus,
  ReviewRating,
} from './types';

import {
  initDefaultData,
  getAllReadings,
  saveReading,
  deleteReading,
  getAllVocabularies,
  saveVocabulary,
  deleteVocabulary,
  getDueReviews,
  recordReview,
  getSettings,
  saveSettings,
} from './db/dexie';

import {
  generateReadingWithPipeline,
  rewriteReadingWithPipeline,
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [currentReading, setCurrentReading] = useState<ReadingRecord | null>(null);
  const [readings, setReadings] = useState<ReadingRecord[]>([]);
  const [vocabularies, setVocabularies] = useState<VocabularyItem[]>([]);
  const [settings, setAppSettings] = useState<AppSettings>({
    cefr: 'B1',
    defaultReadingType: 'story',
    defaultLength: 'medium',
    vocabularyCount: 8,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      await initDefaultData();
      const [savedSettings, allR, allV] = await Promise.all([
        getSettings(),
        getAllReadings(),
        getAllVocabularies(),
      ]);
      setAppSettings(savedSettings);
      setReadings(allR);
      setVocabularies(allV);

      if (allR.length > 0 && !currentReading) {
        setCurrentReading(allR[0]);
      }
    } catch (err) {
      console.error('Error loading database data:', err);
    }
  }, [currentReading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set of vocab terms currently in wordbook for O(1) lookup
  const wordbookVocabIds = new Set(
    vocabularies.map((v) => v.term.toLowerCase())
  );

  // Due reviews
  const dueVocabularies = vocabularies.filter(
    (v) => v.nextReviewDate <= Date.now()
  );

  // --- Handlers ---

  // 1. Generate Reading (PRD Section 4 & 5)
  const handleGenerateReading = async (params: {
    input: string;
    cefrLevel: CEFRLevel;
    readingType: ReadingType;
    length: ReadingLength;
    vocabularyCount: number;
    specifiedVocabulary?: string[];
  }) => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const record = await generateReadingWithPipeline(
        {
          input: params.input,
          cefrLevel: params.cefrLevel,
          readingType: params.readingType,
          length: params.length,
          vocabularyCount: params.vocabularyCount,
          specifiedVocabulary: params.specifiedVocabulary,
          targetLanguage: settings.targetLanguage,
        },
        (status) => setProcessingStatus(status)
      );

      // Save reading to Dexie
      await saveReading(record);

      // Automatically sync newly selected vocabulary to wordbook
      for (const vocab of record.selectedVocabulary) {
        await saveVocabulary(vocab);
      }

      const [updatedR, updatedV] = await Promise.all([
        getAllReadings(),
        getAllVocabularies(),
      ]);

      setReadings(updatedR);
      setVocabularies(updatedV);
      setCurrentReading(record);
      setActiveTab('reading');
    } catch (err: any) {
      console.error('Failed to generate reading:', err);
      setErrorMessage(err?.message || '短文生成遇到问题，请重试');
    } finally {
      setIsGenerating(false);
      setProcessingStatus('');
    }
  };

  // 2. Rewrite Reading (PRD Section 21)
  const handleRewrite = async (mode: string, keepVocab: boolean) => {
    if (!currentReading) return;
    setIsRewriting(true);
    setErrorMessage(null);
    setProcessingStatus('Generating reading...');
    try {
      const currentVocabTerms = keepVocab
        ? currentReading.selectedVocabulary.map((v) => v.term)
        : undefined;

      const revised = await rewriteReadingWithPipeline(
        {
          readingId: currentReading.id,
          reading: currentReading.content,
          mode: mode as any,
          cefrLevel: currentReading.cefrLevel,
          keepVocabulary: keepVocab,
          currentVocabulary: currentVocabTerms,
        },
        (status) => setProcessingStatus(status)
      );

      const updatedRecord: ReadingRecord = {
        ...currentReading,
        content: revised.reading || currentReading.content,
        readingType: revised.readingType || currentReading.readingType,
        selectedVocabulary:
          revised.vocabulary && revised.vocabulary.length > 0
            ? (revised.vocabulary as VocabularyItem[])
            : currentReading.selectedVocabulary,
        rewritePractice:
          revised.rewritePractice && revised.rewritePractice.length > 0
            ? (revised.rewritePractice as any)
            : currentReading.rewritePractice,
        updatedAt: Date.now(),
      };

      await saveReading(updatedRecord);
      setCurrentReading(updatedRecord);

      const allR = await getAllReadings();
      setReadings(allR);
    } catch (err: any) {
      console.error('Rewrite failed:', err);
      setErrorMessage(err?.message || '短文改写遇到问题，请重试');
    } finally {
      setIsRewriting(false);
      setProcessingStatus('');
    }
  };

  const handleUpdateReading = async (updated: ReadingRecord) => {
    await saveReading(updated);
    setCurrentReading(updated);
    setReadings((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  // 3. Toggle Word in Wordbook
  const handleToggleWordbook = async (vocab: VocabularyItem) => {
    const exists = vocabularies.find(
      (v) => v.term.toLowerCase() === vocab.term.toLowerCase()
    );

    if (exists) {
      await deleteVocabulary(exists.id);
    } else {
      await saveVocabulary({
        ...vocab,
        status: 'New',
        nextReviewDate: Date.now(),
      });
    }

    const updated = await getAllVocabularies();
    setVocabularies(updated);
  };

  // 4. Update Reading Vocabulary (PRD Section 15)
  const handleUpdateReadingVocabulary = async (updatedVocabs: VocabularyItem[]) => {
    if (!currentReading) return;

    const updatedReading: ReadingRecord = {
      ...currentReading,
      selectedVocabulary: updatedVocabs,
      updatedAt: Date.now(),
    };

    await saveReading(updatedReading);
    setCurrentReading(updatedReading);

    // Save any new words into vocabulary table
    for (const v of updatedVocabs) {
      await saveVocabulary(v);
    }

    const [allR, allV] = await Promise.all([
      getAllReadings(),
      getAllVocabularies(),
    ]);
    setReadings(allR);
    setVocabularies(allV);
  };

  // 5. Delete Vocabulary from Wordbook
  const handleDeleteVocab = async (id: string) => {
    await deleteVocabulary(id);
    const updated = await getAllVocabularies();
    setVocabularies(updated);
  };

  // 6. Update Vocabulary Status
  const handleUpdateStatus = async (id: string, status: VocabStatus) => {
    const item = vocabularies.find((v) => v.id === id);
    if (!item) return;

    const updatedItem = { ...item, status, updatedAt: Date.now() };
    await saveVocabulary(updatedItem);
    const updated = await getAllVocabularies();
    setVocabularies(updated);
  };

  // 7. Rate Review Flashcard (PRD Section 29)
  const handleRateReview = async (vocabId: string, rating: ReviewRating) => {
    await recordReview(vocabId, rating);
    const updated = await getAllVocabularies();
    setVocabularies(updated);
  };

  // 8. Generate From Wordbook (PRD Section 20)
  const handleGenerateFromWordbook = (params: {
    selectedTerms: string[];
    cefrLevel: CEFRLevel;
    readingType: ReadingType;
    length: ReadingLength;
  }) => {
    handleGenerateReading({
      input: params.selectedTerms.join(', '),
      cefrLevel: params.cefrLevel,
      readingType: params.readingType,
      length: params.length,
      vocabularyCount: params.selectedTerms.length,
      specifiedVocabulary: params.selectedTerms,
    });
  };

  // 9. Delete Reading
  const handleDeleteReading = async (readingId: string) => {
    await deleteReading(readingId);
    const updated = await getAllReadings();
    setReadings(updated);
    if (currentReading?.id === readingId) {
      setCurrentReading(updated[0] || null);
    }
  };

  // 10. Save Settings
  const handleSaveSettings = async (newSettings: AppSettings) => {
    await saveSettings(newSettings);
    setAppSettings(newSettings);
  };

  // 11. Handle Global Target Language Change
  const handleLanguageChange = async (newLang: string) => {
    const newSettings = { ...settings, targetLanguage: newLang };
    setAppSettings(newSettings);
    await saveSettings(newSettings);
  };

  // 12. Handle Batch Update Vocabularies
  const handleBatchUpdateVocabularies = async (updatedVocabs: VocabularyItem[]) => {
    for (const v of updatedVocabs) {
      await saveVocabulary(v);
    }
    const updated = await getAllVocabularies();
    setVocabularies(updated);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F2EEE4] text-[#292B25] selection:bg-[#73785E]/20">
      {/* Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        reviewDueCount={dueVocabularies.length}
        hasCurrentReading={!!currentReading}
        targetLanguage={settings.targetLanguage || 'zh-CN'}
      />

      {/* Main Content Router */}
      <main className="flex-1">
        {errorMessage && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
            <div className="bg-[#FAF3F0] border border-[#D98E7B]/40 text-[#7D3220] px-4 py-3 rounded-sm text-sm font-ui flex items-center justify-between shadow-xs">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-[#7D3220] hover:text-[#521E12] text-xs font-semibold px-2 py-1 ml-3 transition-colors"
              >
                ✕ 关闭
              </button>
            </div>
          </div>
        )}

        {activeTab === 'home' && (
          <HomeView
            settings={settings}
            onGenerate={handleGenerateReading}
            isLoading={isGenerating}
          />
        )}

        {activeTab === 'reading' && currentReading && (
          <ReadingView
            reading={currentReading}
            wordbookVocabIds={wordbookVocabIds}
            onToggleWordbook={handleToggleWordbook}
            onUpdateReadingVocabulary={handleUpdateReadingVocabulary}
            onUpdateReading={handleUpdateReading}
            onRewrite={handleRewrite}
            onOpenHistory={() => setIsHistoryOpen(true)}
            isRewriting={isRewriting}
            targetLanguage={settings.targetLanguage || 'zh-CN'}
            onLanguageChange={handleLanguageChange}
          />
        )}

        {activeTab === 'wordbook' && (
          <WordbookView
            vocabularyList={vocabularies}
            readings={readings}
            onDeleteVocab={handleDeleteVocab}
            onUpdateStatus={handleUpdateStatus}
            onGenerateFromWordbook={handleGenerateFromWordbook}
            isGenerating={isGenerating}
            targetLanguage={settings.targetLanguage || 'zh-CN'}
            onLanguageChange={handleLanguageChange}
            onBatchUpdateVocabularies={handleBatchUpdateVocabularies}
          />
        )}

        {activeTab === 'review' && (
          <ReviewView
            dueVocabularies={dueVocabularies}
            allVocabularies={vocabularies}
            onRate={handleRateReview}
            onRefresh={loadData}
            targetLanguage={settings.targetLanguage || 'zh-CN'}
            onLanguageChange={handleLanguageChange}
            onBatchUpdateVocabularies={handleBatchUpdateVocabularies}
          />
        )}
      </main>

      {/* Pipeline Status Modal */}
      <ProcessingModal
        isOpen={isGenerating || isRewriting}
        status={processingStatus}
      />

      {/* Reading History Modal */}
      <ReadingHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        readings={readings}
        onSelectReading={(reading) => {
          setCurrentReading(reading);
          setActiveTab('reading');
        }}
        onDeleteReading={handleDeleteReading}
      />

      {/* Copyright Footer */}
      <Footer />
    </div>
  );
}
