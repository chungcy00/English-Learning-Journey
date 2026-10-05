/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { currentReadingSavedVocabulary } from './utils/savedVocabulary';
import { Navbar, NavTab } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProcessingModal } from './components/ProcessingModal';
import { AppInstallPrompt } from './components/AppInstallPrompt';
import { InstalledAppBottomNav } from './components/InstalledAppBottomNav';
import { HomeView } from './views/HomeView';
import { ReadingView } from './views/ReadingView';
import { WordbookView } from './views/WordbookView';
import { ReviewView } from './views/ReviewView';
import { ReadingHistoryView } from './views/ReadingHistoryView';
import { isAppleMobileDevice, isManualUpdateApp } from './utils/pwa';
import { normalizeEnglishTerm } from './utils/englishSearch';
import { useReadingExpressions } from './hooks/useReadingExpressions';
import { WordbookRemovalDialog } from './components/WordbookRemovalDialog';
import { PracticeHubView } from './views/PracticeHubView';
import { RewritePracticeView } from './views/RewritePracticeView';

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
  db,
  initDefaultData,
  getAllReadings,
  saveReading,
  saveReadingWithVocabulary,
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
  refreshPendingDialogueSpeech,
  rewriteReadingWithPipeline,
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const reviewRequested = useRef(false);
  const openHubReview = () => {
    reviewRequested.current = true;
    setActiveTab('practice');
  };
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (activeTab === 'practice' && reviewRequested.current) {
      document.getElementById('practice-review')?.scrollIntoView({ block: 'start' });
      reviewRequested.current = false;
    }
  }, [activeTab]);
  const [currentReading, setCurrentReading] = useState<ReadingRecord | null>(null);
  // Prepare once when a passage is ready, independently of opening a search menu.
  useReadingExpressions(currentReading);
  const [readings, setReadings] = useState<ReadingRecord[]>([]);
  const [vocabularies, setVocabularies] = useState<VocabularyItem[]>([]);
  const reviewVocabulary = useMemo(() => currentReadingSavedVocabulary(vocabularies, currentReading), [vocabularies, currentReading]);
  const [removalTarget, setRemovalTarget] = useState<VocabularyItem | null>(null);
  const [settings, setAppSettings] = useState<AppSettings>({
    cefr: 'B1',
    defaultReadingType: 'story',
    defaultLength: 'medium',
    vocabularyCount: 8,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const readingOperation = useRef<AbortController | null>(null);
  const pendingRatings = useRef(new Set<string>());
  const [isSavingReading, setIsSavingReading] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInstalledApp, setIsInstalledApp] = useState(
    () => isManualUpdateApp()
  );

  useEffect(() => {
    setIsInstalledApp(isManualUpdateApp());
    if (isAppleMobileDevice()) {
      const webUrl = new URL(window.location.href);
      webUrl.searchParams.delete('app');
      window.history.replaceState(window.history.state, '', webUrl);
    } else {
      document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/manifest-android.webmanifest');
    }
    // Remove the legacy update worker from installations made by earlier releases.
    // Fresh navigations load the network version; never reload an active window.
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      void (async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames
            .filter((name) => name.startsWith('mine-english-build-') || name === 'mine-english-installed-shell')
            .map((name) => caches.delete(name)));
        }
      })().catch(error => console.warn('Legacy app cache cleanup failed; will retry on next visit.', error));
    }
    // If a previous visit had to use free browser speech, quietly retry
    // Gemini once on this fresh visit and cache a successful result.
    void refreshPendingDialogueSpeech();
  }, []);

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
    reviewVocabulary.map((v) => v.term.toLowerCase())
  );

  // Navigation and both learning views share the current passage's saved expressions.

  // --- Handlers ---

  // 1. Generate Reading (PRD Section 4 & 5)
  const handleGenerateReading = async (params: {
    input: string;
    cefrLevel: CEFRLevel;
    readingType: ReadingType;
    length: ReadingLength;
    vocabularyCount: number;
    specifiedVocabulary?: string[];
    readingStyle?: import('./types').ReadingStyle;
  }) => {
    if (readingOperation.current) return;
    const controller = new AbortController();
    readingOperation.current = controller;
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const record = await generateReadingWithPipeline(
        {
          input: params.input,
          cefrLevel: params.cefrLevel,
          readingType: params.readingType,
          readingStyle: params.readingStyle,
          length: params.length,
          vocabularyCount: params.vocabularyCount,
          specifiedVocabulary: params.specifiedVocabulary,
          targetLanguage: settings.targetLanguage,
        },
        (status) => setProcessingStatus(status), controller.signal
      );

      // Save reading to Dexie
      controller.signal.throwIfAborted();
      setIsSavingReading(true);
      setProcessingStatus('Saving');
      await saveReadingWithVocabulary(record);
      if (params.readingStyle) {
        const updatedSettings = { ...settings, defaultReadingStyle: params.readingStyle };
        await saveSettings(updatedSettings);
        setAppSettings(updatedSettings);
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
      if (controller.signal.aborted) return;
      console.error('Failed to generate reading:', err);
      setErrorMessage(err?.message || '短文生成遇到问题，请重试');
    } finally {
      readingOperation.current = null;
      setIsSavingReading(false);
      setIsGenerating(false);
      setProcessingStatus('');
    }
  };

  // 2. Rewrite Reading (PRD Section 21)
  const handleRewrite = async (mode: string, keepVocab: boolean) => {
    if (!currentReading || readingOperation.current) return;
    const controller = new AbortController();
    readingOperation.current = controller;
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
          vocabularyCount: currentReading.vocabularyCount || currentReading.selectedVocabulary.length,
        },
        (status) => setProcessingStatus(status), controller.signal
      );

      const updatedRecord: ReadingRecord = {
        ...currentReading,
        vocabularyCount: currentReading.vocabularyCount || currentReading.selectedVocabulary.length,
        translations: undefined,
        content: revised.reading || currentReading.content,
        readingType: revised.readingType || currentReading.readingType,
        speakers: revised.speakers && revised.speakers.length > 0
          ? revised.speakers
          : currentReading.speakers,
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

      controller.signal.throwIfAborted();
      setIsSavingReading(true);
      setProcessingStatus('Saving');
      await saveReadingWithVocabulary(updatedRecord);
      setVocabularies(await getAllVocabularies());
      setCurrentReading(updatedRecord);

      const allR = await getAllReadings();
      setReadings(allR);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.error('Rewrite failed:', err);
      setErrorMessage(err?.message || '短文改写遇到问题，请重试');
    } finally {
      readingOperation.current = null;
      setIsSavingReading(false);
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

    if (exists && reviewVocabulary.some(v => v.id === exists.id)) {
      setRemovalTarget(exists);
      return;
    } else {
      await saveVocabulary({
        ...(exists || vocab),
        savedManually: true,
        addedFromReadingIds: [...new Set([...(exists?.addedFromReadingIds || []), ...(currentReading ? [currentReading.id] : [])])],
      });
    }

    const updated = await getAllVocabularies();
    setVocabularies(updated);
  };

  // 5. Delete Vocabulary from Wordbook
  const handleDeleteVocab = (id: string) => {
    const target = vocabularies.find(item => item.id === id);
    if (target) setRemovalTarget(target);
  };

  const handleUpdateStatus = async (id: string, status: VocabStatus) => {
    const updatedAt = Date.now();
    // Update only these fields; preserve review scheduling and passage associations.
    const updated = await db.vocabulary.update(id, { status, updatedAt });
    if (!updated) throw new Error('词条已不存在');
    setVocabularies(items => items.map(item => item.id === id ? { ...item, status, updatedAt } : item));
  };

  // 7. Rate Review Flashcard (PRD Section 29)
  const handleRateReview = async (vocabId: string, rating: ReviewRating) => {
    if (pendingRatings.current.has(vocabId)) throw new Error('此词条评分仍在保存');
    pendingRatings.current.add(vocabId);
    try {
      await recordReview(vocabId, rating);
      // The transaction has committed. A refresh error must not invite a duplicate rating.
      try { setVocabularies(await getAllVocabularies()); }
      catch (error) { console.warn('评分已保存，但列表刷新失败', error); }
    } finally { pendingRatings.current.delete(vocabId); }
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
    const [updated, updatedVocabulary] = await Promise.all([
      getAllReadings(),
      getAllVocabularies(),
    ]);
    setReadings(updated);
    setVocabularies(updatedVocabulary);
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

  const handleCefrChange = (cefr: CEFRLevel) => {
    const newSettings = { ...settings, cefr };
    setAppSettings(newSettings);
    saveSettings(newSettings);
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
    <div className="min-h-screen flex flex-col bg-[#F2EEE4] text-[#292B25] selection:bg-[#62694D]/20"
      style={{ '--review-nav-offset': isInstalledApp ? '4.5rem' : undefined } as React.CSSProperties}>
      {/* Web navigation; installed phone/tablet software uses the bottom tabs. */}
      {!isInstalledApp && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          reviewCount={reviewVocabulary.length}
          hasCurrentReading={!!currentReading}
          targetLanguage={settings.targetLanguage || 'zh-CN'}
        />
      )}

      {/* Main Content Router */}
      <main className={`min-w-0 flex-1 ${isInstalledApp ? 'pb-[calc(5rem+env(safe-area-inset-bottom))]' : ''}`}>
        {errorMessage && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
            <div role="alert" className="bg-[#FAF3F0] border border-[#D98E7B]/40 text-[#7D3220] px-4 py-3 rounded-sm text-sm font-ui flex items-center justify-between shadow-xs">
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
            onCefrChange={handleCefrChange}
            currentReading={currentReading}
            onContinueReading={() => setActiveTab('reading')}
          />
        )}

        {activeTab === 'reading' && currentReading && (
          <ReadingView
            reading={currentReading}
            knownVocabulary={vocabularies}
            wordbookVocabIds={wordbookVocabIds}
            onToggleWordbook={handleToggleWordbook}
            onUpdateReading={handleUpdateReading}
            onUpdateVocabulary={async updated => {
              await saveReadingWithVocabulary(updated);
              setCurrentReading(updated);
              setReadings(await getAllReadings());
              setVocabularies(await getAllVocabularies());
            }}
            onRewrite={handleRewrite}
            onOpenHistory={() => setActiveTab('history')}
            onOpenPractice={() => setActiveTab('rewrite')}
            isRewriting={isRewriting}
            targetLanguage={settings.targetLanguage || 'zh-CN'}
            onLanguageChange={handleLanguageChange}
          />
        )}

        {activeTab === 'wordbook' && (
          <>
          <div className="practice-back-bar"><button type="button" className="practice-back" onClick={() => setActiveTab('practice')}><ArrowLeft aria-hidden="true" className="w-4 h-4" />练习与生词</button></div>
          <WordbookView
            vocabularyList={reviewVocabulary}
            readings={readings}
            currentReading={currentReading}
            onDeleteVocab={handleDeleteVocab}
            onUpdateStatus={handleUpdateStatus}
            onGenerateFromWordbook={handleGenerateFromWordbook}
            isGenerating={isGenerating}
            targetLanguage={settings.targetLanguage || 'zh-CN'}
            onLanguageChange={handleLanguageChange}
            onBatchUpdateVocabularies={handleBatchUpdateVocabularies}
            currentCefr={settings.cefr}
            onSaveVocab={async (vocab) => {
              const existing = vocabularies.find(v => normalizeEnglishTerm(v.term) === normalizeEnglishTerm(vocab.term));
              await saveVocabulary(existing ? {
                ...existing,
                savedManually: true,
                addedFromReadingIds: [...new Set([...(existing.addedFromReadingIds || []), ...(vocab.addedFromReadingIds || [])])],
                updatedAt: vocab.updatedAt,
                nextReviewDate: Math.min(existing.nextReviewDate, vocab.nextReviewDate),
                wordbookLevels: [...new Set([...(existing.wordbookLevels || []), ...(vocab.wordbookLevels || [])])],
              } : vocab);
              await loadData();
            }}
            onOpenReview={openHubReview}
          />
          </>
        )}

        {activeTab === 'rewrite' && <RewritePracticeView reading={currentReading} targetLanguage={settings.targetLanguage || 'zh-CN'} onBack={() => setActiveTab('practice')} />}

        {activeTab === 'practice' && (
          <PracticeHubView exerciseCount={currentReading?.rewritePractice?.length || 0} vocabularyCount={reviewVocabulary.length}
            onOpenRewrite={() => setActiveTab('rewrite')} onOpenWordbook={() => setActiveTab('wordbook')}>
          <ReviewView
            embedded
            allVocabularies={reviewVocabulary}
            onRate={handleRateReview}
            onRefresh={loadData}
            targetLanguage={settings.targetLanguage || 'zh-CN'}
            onLanguageChange={handleLanguageChange}
            onBatchUpdateVocabularies={handleBatchUpdateVocabularies}
          />
          </PracticeHubView>
        )}

        {activeTab === 'history' && (
          <ReadingHistoryView
            readings={readings}
            onSelectReading={(reading) => {
              setCurrentReading(reading);
              setActiveTab('reading');
            }}
            onDeleteReading={handleDeleteReading}
          />
        )}

      </main>

      {/* Pipeline Status Modal */}
      {removalTarget && <WordbookRemovalDialog key={removalTarget.id} term={removalTarget.term}
        onCancel={() => setRemovalTarget(null)} onConfirm={async () => {
          await deleteVocabulary(removalTarget.id);
          setVocabularies(await getAllVocabularies());
          setRemovalTarget(null);
        }} />}

      <ProcessingModal
        isOpen={isGenerating || isRewriting}
        status={processingStatus}
        canCancel={!isSavingReading}
        onCancel={() => readingOperation.current?.abort()}
      />

      {/* Mobile browsers offer installation; installed apps use the same network-loaded app. */}
      {!isInstalledApp && <AppInstallPrompt />}

      {/* Browser copyright only; installed phone/tablet software stays app-like. */}
      {!isInstalledApp && <Footer />}

      {isInstalledApp && (
        <InstalledAppBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          reviewCount={reviewVocabulary.length}
          hasCurrentReading={!!currentReading}
        />
      )}
    </div>
  );
}
