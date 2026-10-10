/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { currentReadingSavedVocabulary } from './utils/savedVocabulary';
import { toggleWordDetailBookmark } from './utils/wordDetailBookmark';
import { Navbar, NavTab } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProcessingModal } from './components/ProcessingModal';
import { AppInstallPrompt } from './components/AppInstallPrompt';
import { InstalledAppBottomNav } from './components/InstalledAppBottomNav';
import { HomeView } from './views/HomeView';
import { RecoveryNotice } from './components/RecoveryNotice';
import { ReadingView } from './views/ReadingView';
import { WordbookView } from './views/WordbookView';
import { ReviewView } from './views/ReviewView';
import { ReadingHistoryView } from './views/ReadingHistoryView';
import { isAppleMobileDevice, isManualUpdateApp, isAndroidPhoneApp } from './utils/pwa';
import { normalizeEnglishTerm } from './utils/englishSearch';
import { useReadingExpressions } from './hooks/useReadingExpressions';
import { WordbookRemovalDialog } from './components/WordbookRemovalDialog';
import { useMotionPresence } from './hooks/useMotionPresence';
import { PracticeHubView } from './views/PracticeHubView';
import { RewritePracticeView } from './views/RewritePracticeView';
import { useSoftwareKeyboard } from './hooks/useSoftwareKeyboard';

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
  recordReview,
  getSettings,
  saveSettings,
} from './db/dexie';

import {
  generateReadingWithPipeline,
  rewriteReadingWithPipeline,
} from './services/api';

export default function App() {
  const softwareKeyboardOpen = useSoftwareKeyboard();
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
  // Keep the existing reading intact and restore its last viewport on return.
  const readingPositions = useRef(new Map<string, number>());
  useEffect(() => {
    if (activeTab !== 'reading' || !currentReading) return;
    const id = currentReading.id;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: readingPositions.current.get(id) || 0, behavior: 'instant' }));
    const remember = () => readingPositions.current.set(id, window.scrollY);
    window.addEventListener('scroll', remember, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', remember); };
  }, [activeTab, currentReading?.id]);
  // Prepare once when a passage is ready, independently of opening a search menu.
  useReadingExpressions(currentReading);
  const [readings, setReadings] = useState<ReadingRecord[]>([]);
  const [vocabularies, setVocabularies] = useState<VocabularyItem[]>([]);
  const removedDetailVocabulary = useRef(new Map<string, VocabularyItem>());
  useEffect(() => { removedDetailVocabulary.current.clear(); }, [currentReading?.id]);
  const reviewVocabulary = useMemo(() => currentReadingSavedVocabulary(vocabularies, currentReading), [vocabularies, currentReading]);
  const [removalTarget, setRemovalTarget] = useState<VocabularyItem | null>(null);
  const removalPresence = useMotionPresence(!!removalTarget);
  const lastRemovalTarget = useRef<VocabularyItem | null>(null);
  useEffect(() => { if (removalTarget) lastRemovalTarget.current = removalTarget; }, [removalTarget]);
  const visibleRemovalTarget = removalTarget || lastRemovalTarget.current;
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
  const [processingTopic, setProcessingTopic] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storageError, setStorageError] = useState('');
  const [isInstalledApp, setIsInstalledApp] = useState(
    () => isManualUpdateApp()
  );
  const [isBottomNavApp, setIsBottomNavApp] = useState(() => isAndroidPhoneApp());

  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)');
    const syncNavigation = () => setIsBottomNavApp(isAndroidPhoneApp());
    mode.addEventListener('change', syncNavigation);
    return () => mode.removeEventListener('change', syncNavigation);
  }, []);

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
      setStorageError('');

      if (allR.length > 0 && !currentReading) {
        setCurrentReading(allR[0]);
      }
    } catch (err) {
      console.error('Error loading database data:', err);
      setStorageError('本机学习数据读取失败。请检查浏览器存储权限后重试，不要清除网站数据。');
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
    customReadingStyle?: string;
  }) => {
    if (readingOperation.current) return;
    const controller = new AbortController();
    readingOperation.current = controller;
    setIsGenerating(true);
    setProcessingTopic(params.input);
    setProcessingStatus('Generating reading...');
    setErrorMessage(null);
    try {
      const record = await generateReadingWithPipeline(
        {
          input: params.input,
          cefrLevel: params.cefrLevel,
          readingType: params.readingType,
          readingStyle: params.readingStyle,
          customReadingStyle: params.customReadingStyle,
          length: params.length,
          vocabularyCount: params.vocabularyCount,
          specifiedVocabulary: params.specifiedVocabulary,
        },
        (status) => { if (readingOperation.current === controller && !controller.signal.aborted) setProcessingStatus(status); }, controller.signal
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
      if (controller.signal.aborted || readingOperation.current !== controller) return;
      console.error('Failed to generate reading:', err);
      setErrorMessage(err?.message || '短文生成遇到问题，请重试');
    } finally {
      if (readingOperation.current === controller) {
        readingOperation.current = null;
        setIsSavingReading(false);
        setIsGenerating(false);
        setProcessingStatus('');
      }
    }
  };

  const handleCancelReadingOperation = () => {
    if (isSavingReading || !readingOperation.current) return;
    const controller = readingOperation.current;
    readingOperation.current = null;
    controller.abort();
    setIsGenerating(false);
    setIsRewriting(false);
    setProcessingStatus('');
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
        (status) => { if (readingOperation.current === controller && !controller.signal.aborted) setProcessingStatus(status); }, controller.signal
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
      if (controller.signal.aborted || readingOperation.current !== controller) return;
      console.error('Rewrite failed:', err);
      setErrorMessage(err?.message || '短文改写遇到问题，请重试');
    } finally {
      if (readingOperation.current === controller) {
        readingOperation.current = null;
        setIsSavingReading(false);
        setIsRewriting(false);
        setProcessingStatus('');
      }
    }
  };

  const handleUpdateReading = async (updated: ReadingRecord) => {
    await saveReading(updated);
    setCurrentReading(current => current?.id === updated.id && current.content === updated.content ? updated : current);
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
  const handleDetailBookmark = async (vocab: VocabularyItem) => {
    const updated = await toggleWordDetailBookmark(vocab, vocabularies, currentReading?.id, removedDetailVocabulary.current, { save: saveVocabulary, remove: deleteVocabulary }, reviewVocabulary.some(item => item.term.toLowerCase() === vocab.term.toLowerCase()));
    const key = vocab.term.toLowerCase();
    setVocabularies(items => [...items.filter(item => item.term.toLowerCase() !== key), ...updated.filter(item => item.term.toLowerCase() === key)]);
  };

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


  const handleCefrChange = (cefr: CEFRLevel) => {
    const newSettings = { ...settings, cefr };
    setAppSettings(newSettings);
    saveSettings(newSettings);
  };


  return (
    <div className={`min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-[var(--accent-primary)]/20 ${softwareKeyboardOpen ? 'software-keyboard-open' : ''} ${activeTab === 'home' ? 'studio-home-active' : activeTab === 'reading' ? 'studio-reading-active' : ''}`}
      style={{ '--review-nav-offset': isBottomNavApp ? '4.5rem' : '0px' } as React.CSSProperties}>
      {/* All browser sizes use the header; only installed Android phones use bottom tabs. */}
      {!isBottomNavApp && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          reviewCount={reviewVocabulary.length}
          hasCurrentReading={!!currentReading}
        />
      )}

      {/* Main Content Router */}
      <main className={`min-w-0 flex-1 ${isBottomNavApp ? 'pb-[calc(5rem+env(safe-area-inset-bottom))]' : ''}`}>
        {storageError && <div className="max-w-3xl mx-auto px-4 pt-4"><RecoveryNotice message={storageError} onRetry={() => void loadData()} /></div>}
        {errorMessage && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
            <div role="alert" className="bg-[var(--status-error-soft)] border border-[var(--status-error-border)] text-[var(--status-error)] px-4 py-3 rounded-sm text-[length:var(--type-body)] leading-[1.6] font-ui flex items-center justify-between shadow-xs">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="min-h-11 min-w-11 shrink-0 text-[var(--status-error)] hover:text-[var(--status-error-hover)] text-[length:var(--type-label)] leading-[1.4] font-semibold px-2 py-1 ml-3 transition-colors"
              >
                ✕ 关闭
              </button>
            </div>
          </div>
        )}

        <div hidden={activeTab !== 'home'}>
          <HomeView
            settings={settings}
            onGenerate={handleGenerateReading}
            isLoading={isGenerating}
            onCefrChange={handleCefrChange}
            currentReading={currentReading}
            onContinueReading={() => setActiveTab('reading')}
          />
        </div>

        {activeTab === 'reading' && currentReading && (
          <ReadingView
            reading={currentReading}
            knownVocabulary={vocabularies}
            wordbookVocabIds={wordbookVocabIds}
            onToggleWordbook={handleToggleWordbook}
            onToggleWordbookFromDetails={handleDetailBookmark}
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

        {activeTab === 'rewrite' && <RewritePracticeView reading={currentReading} onBack={() => setActiveTab('practice')} />}

        {activeTab === 'practice' && (
          <PracticeHubView exerciseCount={currentReading?.rewritePractice?.length || 0} vocabularyCount={reviewVocabulary.length}
            onOpenRewrite={() => setActiveTab('rewrite')} onOpenWordbook={() => setActiveTab('wordbook')}>
          <ReviewView
            embedded
            allVocabularies={reviewVocabulary}
            onRate={handleRateReview}
            onRefresh={loadData}
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
            onCreateReading={() => setActiveTab('home')}
          />
        )}

      </main>

      {/* Pipeline Status Modal */}
      {removalPresence.present && visibleRemovalTarget && <WordbookRemovalDialog key={visibleRemovalTarget.id} term={visibleRemovalTarget.term} closing={removalPresence.closing}
        onCancel={() => setRemovalTarget(null)} onConfirm={async () => {
          await deleteVocabulary(visibleRemovalTarget.id);
          setVocabularies(await getAllVocabularies());
          setRemovalTarget(null);
        }} />}

      <ProcessingModal
        isOpen={isGenerating || isRewriting}
        status={processingStatus}
        topic={processingTopic}
        operation={isRewriting ? 'rewrite' : 'generate'}
        canCancel={!isSavingReading}
        onCancel={handleCancelReadingOperation}
      />

      {/* Mobile browsers offer installation; installed apps use the same network-loaded app. */}
      {!isInstalledApp && <AppInstallPrompt />}

      {/* Browser copyright only; installed phone/tablet software stays app-like. */}
      {!isInstalledApp && <Footer />}

      {isBottomNavApp && (
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
