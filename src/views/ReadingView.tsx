import { LoadingAnimation } from '../components/LoadingAnimation';
import { HandOutline, Companion } from '../components/LearningArt';
import { vocabularyKey } from '../utils/vocabularyDetails';
import { cachedParagraphTranslation } from '../utils/paragraphTranslation';
import { mergeReadingTranslations } from '../utils/translationResults';
import { parseDialogueTurns, mappedDialogueTranslation, type DialogueTurn } from '../utils/dialogueReading';
import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  RefreshCw,
  History,
  Bookmark,
  Check,
  ChevronDown,
  Volume2,
  Square,
  Pause,
  Play,
  MessageSquare,
  AlignLeft,
  Copy, MoreHorizontal, RotateCcw, ArrowRight, PencilLine, X, Plus
} from 'lucide-react';
import { ReadingRecord, ReadingTranslation, VocabularyItem } from '../types';
import { splitReadingSentences, groupReadingSentences, hasCompleteSentenceTranslations, formatAudioTime } from '../utils/readingSegments';
import { createDeviceSpeechProgress, locateDeviceSpeechPosition } from '../utils/deviceSpeechProgress';
import { WordDetailModal } from '../components/WordDetailModal';
import { ReadingVocabularyEditor } from '../components/ReadingVocabularyEditor';
import {SwipeToRemove} from '../components/SwipeToRemove';

import {
  getI18nText,
  getLocalizedVocabMeaning,
} from '../utils/i18n';
import {
  DIALOGUE_SPEECH_RATE,
  NARRATION_SPEECH_RATE,
  SpeechGender,
  getAvailableSpeechVoices,
  resolveSpeakerGender,
  selectDialogueVoicePair,
  selectVocabularyVoice,
  stopEnglishSpeech,
} from '../utils/speech';

interface ReadingViewProps {
  reading: ReadingRecord;
  knownVocabulary: VocabularyItem[];
  wordbookVocabIds: Set<string>;
  onToggleWordbook: (vocab: VocabularyItem) => void;
  onToggleWordbookFromDetails?: (vocab: VocabularyItem) => void | Promise<void>;
  onUpdateReading?: (updatedReading: ReadingRecord) => void | Promise<void>;
  onUpdateVocabulary: (updatedReading: ReadingRecord) => Promise<void>;
  onRemoveVocabulary?: (vocab: VocabularyItem) => Promise<void>;
  onOpenHistory: () => void;
}

interface SpeechQueueItem {
  text: string;
  gender: SpeechGender;
  speakerKey: string;
  speakerIndex: number;
  turnIndex: number | null;
}

function cleanSpeechText(text: string): string {
  return text
    .replace(/^\s*["“”']|["“”']\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitNarrationText(text: string): string[] {
  const cleanText = text
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!cleanText) return [];

  const chunks: string[] = [];
  const paragraphs = cleanText.split(/\n+/).map(cleanSpeechText).filter(Boolean);

  for (const paragraph of paragraphs) {
    const sentences = paragraph.match(/[^.!?]+[.!?]+["”']?|[^.!?]+$/g) || [paragraph];
    let currentChunk = '';
    for (const sentence of sentences) {
      const candidate = `${currentChunk} ${sentence.trim()}`.trim();
      if (candidate.length > 520 && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = sentence.trim();
      } else {
        currentChunk = candidate;
      }
    }
    if (currentChunk) chunks.push(currentChunk);
  }

  return chunks;
}

const SPEAKER_STYLES = [
  { bg: 'bg-[var(--accent-vocab)]', text: 'text-[var(--surface-paper)]', border: 'border-[var(--accent-vocab)]/30', label: 'text-[var(--accent-vocab)]' },
  { bg: 'bg-[var(--status-warning)]', text: 'text-[var(--surface-paper)]', border: 'border-[var(--status-warning)]/30', label: 'text-[var(--status-warning)]' },
  { bg: 'bg-[var(--status-info)]', text: 'text-[var(--surface-paper)]', border: 'border-[var(--status-info)]/30', label: 'text-[var(--status-info)]' },
  { bg: 'bg-[var(--text-ink)]', text: 'text-[var(--surface-paper)]', border: 'border-[var(--text-ink)]/30', label: 'text-[var(--text-ink)]' },
];

export const ReadingView: React.FC<ReadingViewProps> = ({
  reading,
  knownVocabulary,
  wordbookVocabIds,
  onToggleWordbook,
  onToggleWordbookFromDetails,
  onUpdateReading,
  onUpdateVocabulary,
  onRemoveVocabulary,
  onOpenHistory,
}) => {
  const [selectedVocab, setSelectedVocab] = useState<VocabularyItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  useEffect(() => { setIsDetailOpen(false); setSelectedVocab(null); }, [reading.id]);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !moreMenuRef.current?.contains(event.target)) setMoreOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [moreOpen]);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [expandedSentence, setExpandedSentence] = useState<string | null>(null);
  const [speechPosition, setSpeechPosition] = useState(0);
  const [speechDuration, setSpeechDuration] = useState<number | null>(null);
  const deviceSpeechProgress = useRef(createDeviceSpeechProgress());
  const deviceUtteranceActive = useRef(false);
  const [deviceSpeechPercent, setDeviceSpeechPercent] = useState(0);
  const [isDeviceSpeech, setIsDeviceSpeech] = useState(true);
  const deviceSeekRef = useRef<((percent: number) => void) | null>(null);
  const deviceRevisionRef = useRef(0);
  const suspendDeviceForVocabulary = useRef<(() => void) | null>(null);
  const draggingDeviceSeek = useRef(false);
  const resumeAfterDeviceSeek = useRef(false);
  const [deviceSeekDraft, setDeviceSeekDraft] = useState<number | null>(null);
  const translationRunRef = useRef(0);
  const translationControllerRef = useRef<AbortController | null>(null);
  const translationPriorityRef = useRef(false);
  const vocabularySignature = reading.selectedVocabulary.map(vocab => `${vocab.id}:${vocab.term}`).join('|');

  // Parse dialogue turns
  const dialogueTurns = parseDialogueTurns(reading.content);
  const isDetectedDialogue =
    reading.readingType === 'dialogue' ||
    dialogueTurns.filter(t => t.speaker !== null).length >= 2;

  const [formatMode, setFormatMode] = useState<'dialogue' | 'paragraph'>(
    isDetectedDialogue ? 'dialogue' : 'paragraph'
  );

  // Chinese translation state and cached reading content
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [copiedTranslation, setCopiedTranslation] = useState<boolean>(false);
  const [copyError, setCopyError] = useState('');
  const [removingTerm, setRemovingTerm] = useState<string|null>(null);
  const [bookmarkError, setBookmarkError] = useState('');
  const [pendingBookmarks, setPendingBookmarks] = useState<Set<string>>(new Set());
  const pendingBookmarkIds = useRef(new Set<string>());
  const toggleBookmark = async (vocab: VocabularyItem) => {
    if (pendingBookmarkIds.current.has(vocab.id)) return;
    pendingBookmarkIds.current.add(vocab.id);
    setPendingBookmarks(new Set(pendingBookmarkIds.current));
    setBookmarkError('');
    try { await onToggleWordbook(vocab); }
    catch (error) { setBookmarkError(error instanceof Error ? error.message : '收藏操作失败，请重试。'); }
    finally { pendingBookmarkIds.current.delete(vocab.id); setPendingBookmarks(new Set(pendingBookmarkIds.current)); }
  };
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const speechPausedRef = useRef(false);
  const pendingSpeechRef = useRef<(() => void) | null>(null);
  const [isPreparingSpeech, setIsPreparingSpeech] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [activeSpeechTurn, setActiveSpeechTurn] = useState<number | null>(null);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const speechRunRef = useRef(0);
  const speechPauseTimerRef = useRef<number | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const dialogueAudioRef = useRef<HTMLAudioElement | null>(null);
  const dialogueAudioUrlRef = useRef<string | null>(null);
  const finishDialogueAudioRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => setSpeechVoices(getAvailableSpeechVoices());
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  const stopReadingAloud = () => {
    suspendDeviceForVocabulary.current = null;
    deviceRevisionRef.current += 1;
    deviceSeekRef.current = null;
    deviceSpeechProgress.current.pause();
    deviceUtteranceActive.current = false;
    speechPausedRef.current = false;
    pendingSpeechRef.current = null;
    setIsSpeechPaused(false);
    speechRunRef.current += 1;
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;
    if (speechPauseTimerRef.current !== null) {
      window.clearTimeout(speechPauseTimerRef.current);
      speechPauseTimerRef.current = null;
    }
    if (dialogueAudioRef.current) {
      dialogueAudioRef.current.pause();
      dialogueAudioRef.current.removeAttribute('src');
      dialogueAudioRef.current.load();
      dialogueAudioRef.current = null;
    }
    finishDialogueAudioRef.current?.();
    finishDialogueAudioRef.current = null;
    if (dialogueAudioUrlRef.current) {
      URL.revokeObjectURL(dialogueAudioUrlRef.current);
      dialogueAudioUrlRef.current = null;
    }
    stopEnglishSpeech();
    setIsSpeaking(false);
    setIsPreparingSpeech(false);
    setActiveSpeechTurn(null);
  };

  const startReadingAloud = async (restart = false, seekPercent = 0, startPaused = false, forceDevice = false) => {
    if (restart) stopReadingAloud();
    if (!('speechSynthesis' in window)) {
      setSpeechError('当前浏览器不支持朗读，请尝试 Chrome、Safari 或 Edge。');
      return;
    }

    if (!restart && (isSpeaking || isPreparingSpeech)) {
      stopReadingAloud();
      return;
    }

    setSpeechPosition(0);
    setSpeechDuration(null);
    setDeviceSpeechPercent(0);
    deviceSpeechProgress.current.reset();
    deviceUtteranceActive.current = false;
    setIsDeviceSpeech(true);
    setSpeechError(null);
    setSpeechNotice(null);
    speechPausedRef.current = startPaused;
    pendingSpeechRef.current = null;
    setIsSpeechPaused(startPaused);
    stopEnglishSpeech();
    const voices = speechVoices.length > 0
      ? speechVoices
      : getAvailableSpeechVoices();
    const queue: SpeechQueueItem[] = [];

    if (isDetectedDialogue) {
      const speakerOrder = new Map<string, number>();
      dialogueTurns.forEach((turn) => {
        if (!turn.speaker || ['setting', 'scene', 'note'].includes(turn.speaker.toLowerCase())) {
          return;
        }

        const speakerKey = turn.speaker.toLowerCase().trim();
        if (!speakerOrder.has(speakerKey)) {
          speakerOrder.set(speakerKey, speakerOrder.size);
        }
      });

      const speakerGenders = new Map<string, SpeechGender>();
      speakerOrder.forEach((speakerIndex, speakerKey) => {
        const representativeTurn = dialogueTurns.find(
          turn => turn.speaker?.toLowerCase().trim() === speakerKey
        );
        const speakerProfile = reading.speakers?.find(
          profile => profile.name.toLowerCase().trim() === speakerKey
        );
        speakerGenders.set(
          speakerKey,
          resolveSpeakerGender(
            representativeTurn?.speaker || speakerKey,
            speakerIndex,
            speakerProfile?.gender
          )
        );
      });

      // Historical AI records sometimes stored both character profiles as the
      // same gender. If no contrast remains after known-name correction, force
      // alternating female/male roles in stable speaker order.
      const resolvedGenders = new Set(speakerGenders.values());
      if (speakerOrder.size >= 2 && resolvedGenders.size === 1) {
        const firstGender = speakerGenders.values().next().value as SpeechGender;
        speakerOrder.forEach((speakerIndex, speakerKey) => {
          speakerGenders.set(
            speakerKey,
            speakerIndex % 2 === 0
              ? firstGender
              : firstGender === 'female' ? 'male' : 'female'
          );
        });
      }

      dialogueTurns.forEach((turn, turnIndex) => {
        if (!turn.speaker || ['setting', 'scene', 'note'].includes(turn.speaker.toLowerCase())) {
          return;
        }

        const speakerKey = turn.speaker.toLowerCase().trim();
        const speakerIndex = speakerOrder.get(speakerKey) || 0;
        const gender = speakerGenders.get(speakerKey) ||
          (speakerIndex % 2 === 0 ? 'female' : 'male');
        const speech = cleanSpeechText(turn.speech);
        if (speech) queue.push({ text: speech, gender, speakerKey, speakerIndex, turnIndex });
      });
    } else {
      splitNarrationText(reading.content).forEach(text => {
        queue.push({
          text,
          gender: 'female',
          speakerKey: 'narrator',
          speakerIndex: 0,
          turnIndex: null,
        });
      });
    }

    if (queue.length === 0) return;

    const runId = speechRunRef.current + 1;
    speechRunRef.current = runId;

    const beginBrowserPlayback = (
      resolvedVoices: SpeechSynthesisVoice[],
      useDialogueVoices: boolean
    ) => {
      setIsDeviceSpeech(true);
      const totalCharacters = queue.reduce((sum, item) => sum + item.text.length, 0);
      let hasSeeked = false;
      let cursor = { queueIndex: 0, charIndex: 0 };
      deviceSpeechProgress.current.reset(totalCharacters);
      const updateDeviceProgress = () => {
        const progress = deviceSpeechProgress.current.snapshot();
        setSpeechPosition(progress.seconds);
        setDeviceSpeechPercent(progress.percent);
      };
      const dialogueVoicePair = useDialogueVoices
        ? selectDialogueVoicePair(resolvedVoices)
        : null;
      const hasDistinctRoleVoices = Boolean(
        dialogueVoicePair?.female &&
        dialogueVoicePair?.male &&
        dialogueVoicePair.female.voiceURI !== dialogueVoicePair.male.voiceURI
      );

      if (useDialogueVoices && !hasDistinctRoleVoices) setSpeechNotice('当前设备未提供完整的英文男女声，已使用音高区分角色。');

      const speakNext = (queueIndex: number, startChar = 0, revision = deviceRevisionRef.current) => {
        const current = () => speechRunRef.current === runId && deviceRevisionRef.current === revision;
        if (!current()) return;
        if (speechPausedRef.current) {
          pendingSpeechRef.current = () => speakNext(queueIndex, startChar, revision);
          return;
        }
        if (queueIndex >= queue.length) {
          deviceSpeechProgress.current.pause();
          const measured = deviceSpeechProgress.current.snapshot().seconds;
          if (measured > 0 && !hasSeeked) setSpeechDuration(measured);
          setIsSpeaking(false);
          deviceSeekRef.current = null;
          setSpeechNotice('朗读已结束');
          setActiveSpeechTurn(null);
          return;
        }

        cursor = { queueIndex, charIndex: startChar };
        const item = queue[queueIndex];
        const utterance = new SpeechSynthesisUtterance(item.text.slice(startChar));
        const selectedVoice = useDialogueVoices
          ? dialogueVoicePair?.[item.gender] || selectVocabularyVoice(resolvedVoices)
          : selectVocabularyVoice(resolvedVoices);
        utterance.lang = 'en-US';
        utterance.voice = selectedVoice || null;
        utterance.volume = 1;
        utterance.rate = useDialogueVoices ? DIALOGUE_SPEECH_RATE : NARRATION_SPEECH_RATE;
        // Some free device engines expose only one English voice. A restrained
        // pitch difference keeps the two roles audible even in that last-resort case.
        utterance.pitch = useDialogueVoices && !hasDistinctRoleVoices
          ? item.gender === 'male' ? 0.82 : 1.12
          : 1;
        setActiveSpeechTurn(item.turnIndex);
        const completedCharacters = queue.slice(0, queueIndex).reduce((sum, chunk) => sum + chunk.text.length, 0);
        utterance.onstart = () => {
          if (!current()) return;
          deviceUtteranceActive.current = true;
          if (!speechPausedRef.current) deviceSpeechProgress.current.start();
        };
        utterance.onboundary = event => {
          if (!current() || speechPausedRef.current) return;
          cursor = { queueIndex, charIndex: startChar + event.charIndex };
          deviceSpeechProgress.current.boundary(completedCharacters + startChar, event.charIndex, utterance.text.length);
          updateDeviceProgress();
        };
        utterance.onend = () => {
          if (!current()) return;
          deviceUtteranceActive.current = false;
          deviceSpeechProgress.current.pause();
          deviceSpeechProgress.current.complete(completedCharacters + item.text.length);
          updateDeviceProgress();
          cursor = { queueIndex: queueIndex + 1, charIndex: 0 };
          const nextItem = queue[queueIndex + 1];
          const changedSpeaker = nextItem && nextItem.speakerIndex !== item.speakerIndex;
          const pauseMs = changedSpeaker ? 520 : 180;
          speechPauseTimerRef.current = window.setTimeout(
            () => speakNext(queueIndex + 1, 0, revision),
            pauseMs
          );
        };
        utterance.onerror = (event) => {
          if (!current()) {
            return;
          }
          deviceUtteranceActive.current = false;
          deviceSpeechProgress.current.pause();
          updateDeviceProgress();
          setIsSpeaking(false);
          deviceSeekRef.current = null;
          speechPausedRef.current = false;
          setIsSpeechPaused(false);
          if (['canceled', 'interrupted'].includes(event.error)) setSpeechNotice('朗读已中断，请重新播放。');
          else setSpeechError('设备朗读失败，请重新开始朗读。');
          setActiveSpeechTurn(null);
        };

        window.speechSynthesis.speak(utterance);
      };

      const seek = (percent: number) => {
        if (speechRunRef.current !== runId) return;
        hasSeeked = true;
        const revision = ++deviceRevisionRef.current;
        deviceSpeechProgress.current.pause();
        deviceUtteranceActive.current = false;
        pendingSpeechRef.current = null;
        if (speechPauseTimerRef.current !== null) window.clearTimeout(speechPauseTimerRef.current);
        stopEnglishSpeech();
        const position = locateDeviceSpeechPosition(queue.map(item => item.text), percent);
        deviceSpeechProgress.current.seek(position.characters);
        updateDeviceProgress();
        if (position.queueIndex >= queue.length) { speechPausedRef.current = false; setIsSpeechPaused(false); }
        speakNext(position.queueIndex, position.charIndex, revision);
      };
      suspendDeviceForVocabulary.current = () => {
        // Invalidate cancellation callbacks before the shared speech engine is
        // borrowed for a term. Resume from the last real boundary, not the start.
        const revision = ++deviceRevisionRef.current;
        deviceUtteranceActive.current = false;
        if (speechPauseTimerRef.current !== null) window.clearTimeout(speechPauseTimerRef.current);
        const saved = { ...cursor };
        pendingSpeechRef.current = () => {
          stopEnglishSpeech();
          speakNext(saved.queueIndex, saved.charIndex, revision);
        };
      };
      deviceSeekRef.current = seek;
      if (seekPercent > 0) seek(seekPercent);
      else speakNext(0);
    };

    setIsSpeaking(true);

    if (voices.length > 0) {
      beginBrowserPlayback(voices, isDetectedDialogue);
    } else {
      // Chrome can expose voices shortly after page load. Waiting once prevents
      // the first playback from assigning the same default voice to every role.
      speechPauseTimerRef.current = window.setTimeout(() => {
        if (speechRunRef.current === runId) {
          beginBrowserPlayback(getAvailableSpeechVoices(), isDetectedDialogue);
        }
      }, 180);
    }
  };

  useEffect(() => {
    speechPausedRef.current = false;
    pendingSpeechRef.current = null;
    setIsSpeechPaused(false);
    setIsSpeaking(false);
    setIsPreparingSpeech(false);
    return () => {
      deviceSeekRef.current = null;
      suspendDeviceForVocabulary.current = null;
      deviceRevisionRef.current += 1;
      deviceSpeechProgress.current.pause();
      deviceUtteranceActive.current = false;
      speechRunRef.current += 1;
      speechAbortRef.current?.abort();
      if (speechPauseTimerRef.current !== null) {
        window.clearTimeout(speechPauseTimerRef.current);
      }
      finishDialogueAudioRef.current?.();
      dialogueAudioRef.current?.pause();
      if (dialogueAudioUrlRef.current) URL.revokeObjectURL(dialogueAudioUrlRef.current);
      stopEnglishSpeech();
    };
  }, [reading.id, reading.content]);
  useEffect(() => {
    if (!isDeviceSpeech || !isSpeaking || isSpeechPaused) return;
    const timer = window.setInterval(() => setSpeechPosition(deviceSpeechProgress.current.snapshot().seconds), 200);
    return () => window.clearInterval(timer);
  }, [isDeviceSpeech, isSpeaking, isSpeechPaused]);
  useEffect(() => { deviceSpeechProgress.current.reset(); setDeviceSpeechPercent(0); setDeviceSeekDraft(null); draggingDeviceSeek.current = false; setIsDeviceSpeech(true); setSpeechPosition(0); setSpeechDuration(null); setExpandedSentence(null); setMoreOpen(false); setLookupOpen(false); }, [reading.id, reading.content]);

  const currentTranslation = reading.translations?.['zh-CN'];
  const paragraphSources = isDetectedDialogue ? dialogueTurns.map(turn => turn.speech) : reading.content.split(/\n\s*\n/).filter(block => block.trim());
  const missingParagraphs = paragraphSources.some((source, index) => !cachedParagraphTranslation(reading, source, index, paragraphSources.length));
  // Old readings are never translated automatically. A deliberate action fills all paragraphs once.
  const prepareLegacyParagraphs = async () => {
    if (translationControllerRef.current || !onUpdateReading) return;
    const controller = new AbortController(); translationControllerRef.current = controller;
    setIsTranslating(true); setTranslationError(null);
    try {
      const response = await fetch('/api/reading/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: reading.content, readingType: reading.readingType }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '段落翻译失败，请重试。');
      if (!Array.isArray(data.paragraphTranslations) || data.paragraphTranslations.length !== paragraphSources.length || paragraphSources.some((source, index) => data.paragraphTranslations[index]?.source !== source || !data.paragraphTranslations[index]?.translation?.trim())) throw new Error('段落译文不完整，已有内容已保留。');
      if (!controller.signal.aborted) await onUpdateReading({ ...reading, paragraphTranslations: data.paragraphTranslations, updatedAt: Date.now() });
    } catch (error) { if (!controller.signal.aborted) setTranslationError(error instanceof Error ? error.message : '段落翻译失败，请重试。'); }
    finally { if (translationControllerRef.current === controller) { translationControllerRef.current = null; setIsTranslating(false); } }
  };
  useEffect(() => () => { translationControllerRef.current?.abort(); translationControllerRef.current = null; }, [reading.id, reading.content]);

  // Synchronize format mode when reading changes
  React.useEffect(() => {
    const turns = parseDialogueTurns(reading.content);
    const hasDialogue =
      reading.readingType === 'dialogue' ||
      turns.filter(t => t.speaker !== null).length >= 2;
    setFormatMode(hasDialogue ? 'dialogue' : 'paragraph');
  }, [reading.id, reading.readingType, reading.content]);

  // Helper to click on term
  const handleTermClick = (term: string) => {
    const found = reading.selectedVocabulary.find(
      v => v.term.toLowerCase() === term.toLowerCase()
    );
    if (found) {
      setSelectedVocab(found);
      setIsDetailOpen(true);
    }
  };

  // Build vocabulary search regex
  const vocabTerms = reading.selectedVocabulary
    .map(v => v.term.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const escapedTerms = vocabTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const vocabRegex =
    vocabTerms.length > 0 ? new RegExp(`(\\b(?:${escapedTerms.join('|')})\\b)`, 'gi') : null;

  const renderTextWithHighlights = (segment: string) => {
    if (!vocabRegex || vocabTerms.length === 0) {
      return segment;
    }
    const parts = segment.split(vocabRegex);
    return parts.map((part, idx) => {
      const isMatch = vocabTerms.some(t => t.toLowerCase() === part.toLowerCase());
      if (isMatch) {
        return (
          <button
            key={idx}
            type="button"
            onClick={event => { event.stopPropagation(); if (!window.getSelection()?.toString()) handleTermClick(part); }}
            className="vocab-highlight"
            aria-label={`查看 ${part} 的词汇释义`}
          >
            {part}
          </button>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  // Speaker color mapping
  const speakerMap = new Map<string, number>();
  let sCounter = 0;
  for (const turn of dialogueTurns) {
    if (turn.speaker && !speakerMap.has(turn.speaker)) {
      speakerMap.set(turn.speaker, sCounter % SPEAKER_STYLES.length);
      sCounter++;
    }
  }

  const renderParagraph = (text: string, key: string, index: number) => {
    const translated = cachedParagraphTranslation(reading, text, index, paragraphSources.length);
    const expanded = expandedSentence === key;
    const toggle = () => { if (!window.getSelection()?.toString()) setExpandedSentence(expanded ? null : key); };
    return <div className={`reading-paragraph${expanded ? ' is-expanded' : ''}`}>
      <div className="reading-paragraph__original" role="button" tabIndex={0} aria-label={`查看段落翻译：${text.slice(0, 40)}`} aria-expanded={expanded} onClick={toggle} onKeyDown={event => { if (event.target === event.currentTarget && ['Enter',' '].includes(event.key)) { event.preventDefault(); toggle(); } }}>{renderTextWithHighlights(text)}</div>
      {expanded && <div className="reading-paragraph__translation"><p>{translated || '这篇旧短文尚无本段译文，可点击下方按钮一次补充所有段落。'}</p><button type="button" aria-label="收起段落翻译" onClick={() => setExpandedSentence(null)}><X size={16}/></button></div>}
    </div>;
  };

  const renderDialogueTurns = (turns: DialogueTurn[], translated = false) => (
    <div className="reading-dialogue-turns">
      {turns.map((turn, index) => {
        if (!turn.speaker || ['setting', 'scene', '场景', '背景', 'note'].includes(turn.speaker.toLowerCase())) {
          return <div key={index} className="reading-dialogue-scene">{turn.speaker && <span>{turn.speaker}: </span>}{translated ? turn.speech : renderParagraph(turn.speech, `turn-${index}`, index)}</div>;
        }
        const style = SPEAKER_STYLES[speakerMap.get(turn.speaker) ?? 0];
        return <div key={index} className={`reading-dialogue-turn ${isSpeaking && activeSpeechTurn === index ? 'is-reading' : ''}`}>
          <div className="reading-dialogue-speaker">
            <span aria-hidden="true" className={`reading-dialogue-avatar ${style.bg} ${style.text}`}>{turn.speaker.charAt(0).toUpperCase()}</span>
            <span className="reading-dialogue-name">{turn.speaker}</span>
          </div>
          <div className={`reading-dialogue-speech ${translated ? 'reading-dialogue-speech--translated' : ''}`}>
            {translated ? turn.speech : renderParagraph(turn.speech, `turn-${index}`, index)}
          </div>
        </div>;
      })}
    </div>
  );
  const renderDialogueContent = () => renderDialogueTurns(dialogueTurns);

  // Render paragraph format
  const renderParagraphContent = () => {
    if (isDetectedDialogue) return dialogueTurns.map((turn, index) => (
      <div key={index} className="type-reading mb-5 font-editorial text-[var(--text-primary)]">
        {turn.speaker && <span>{turn.speaker}: </span>}{renderParagraph(turn.speech, `turn-${index}`, index)}
      </div>
    ));
    const paragraphs = reading.content.split(/\n\s*\n/).filter(Boolean);
    return paragraphs.map((para, pIdx) => (
      <div key={pIdx} className="type-reading mb-5 font-editorial text-[var(--text-primary)]">
        {renderParagraph(para, `paragraph-${pIdx}`, pIdx)}
      </div>
    ));
  };

  const toggleSpeechPause = () => {
    const paused = !speechPausedRef.current;
    speechPausedRef.current = paused;
    setIsSpeechPaused(paused);
    const audio = dialogueAudioRef.current;
    if (audio) {
      if (paused) audio.pause();
      else void audio.play().catch(() => { stopReadingAloud(); setSpeechError('无法继续播放，请重新开始朗读。'); });
    } else if ('speechSynthesis' in window) {
      if (paused) {
        deviceSpeechProgress.current.pause();
        setSpeechPosition(deviceSpeechProgress.current.snapshot().seconds);
        window.speechSynthesis.pause();
      } else {
        if (deviceUtteranceActive.current) deviceSpeechProgress.current.start();
        window.speechSynthesis.resume();
      }
    }
    if (!paused && pendingSpeechRef.current) { const next = pendingSpeechRef.current; pendingSpeechRef.current = null; next(); }
  };
  const pauseForVocabulary = () => {
    if (!isSpeaking) return;
    if (!speechPausedRef.current) toggleSpeechPause();
    if (!dialogueAudioRef.current) suspendDeviceForVocabulary.current?.();
  };
  const seekDeviceSpeech = (percent: number) => {
    setDeviceSeekDraft(null);
    setSpeechDuration(null);
    if (deviceSeekRef.current) deviceSeekRef.current(percent);
    else void startReadingAloud(true, percent, true, true);
  };
  return (
    <div className={`page-shell page-shell--reading page-stack--reading reading-page reading-studio ${isDetectedDialogue ? 'reading-studio--dialogue' : ''}`}>
      <header className="reading-studio__header">
        <div><h1 className="reading-page-title font-editorial">{reading.title}</h1><div className="reading-studio__meta"><span>{reading.cefrLevel}</span><span>{({ story: '故事', 'non-story': '说明', dialogue: '对话' })[reading.readingType]} · {reading.content.trim().split(/\s+/).filter(Boolean).length} 词</span></div></div>
        <div ref={moreMenuRef} className="reading-more" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setMoreOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { setMoreOpen(false); (event.currentTarget.querySelector('button') as HTMLButtonElement | null)?.focus(); } }}>
          <button type="button" className="reading-more__trigger" aria-label="更多阅读操作" aria-expanded={moreOpen} aria-controls={moreOpen ? "reading-more-menu" : undefined} onClick={() => setMoreOpen(value => !value)}><MoreHorizontal size={21} /></button>
          {moreOpen && <div id="reading-more-menu" className="reading-more__menu">
            <button type="button" onClick={() => { setMoreOpen(false); onOpenHistory(); }}><History size={17} />历史记录</button>
            <button type="button" onClick={() => { setMoreOpen(false); setLookupOpen(true); }}><AlignLeft size={17} />查询文中其他表达</button>
            {isDetectedDialogue && <button type="button" onClick={() => { setFormatMode(value => value === 'dialogue' ? 'paragraph' : 'dialogue'); setMoreOpen(false); }}><AlignLeft size={17} />{formatMode === 'dialogue' ? '切换段落排版' : '切换剧本排版'}</button>}
          </div>}
        </div>
      </header>
      {copyError && <p role="alert" className="reading-inline-status">{copyError}</p>}
      <section className="reading-player" aria-label="英文朗读播放器">
        <button type="button" className="reading-player__play" disabled={isPreparingSpeech} aria-label={isPreparingSpeech ? '正在准备语音' : isSpeaking && !isSpeechPaused ? '暂停朗读' : isSpeaking ? '继续朗读' : '播放英文朗读'} aria-busy={isPreparingSpeech} onClick={() => { if (isSpeaking) toggleSpeechPause(); else void startReadingAloud(); }}>{isPreparingSpeech ? <RefreshCw size={19} /> : isSpeaking && !isSpeechPaused ? <Pause size={19} /> : <Play size={19} />}</button>
        <span className="reading-player__time" title={isDeviceSpeech ? '本次实际播放时间（不含暂停与跳过的内容）' : undefined}>{formatAudioTime(speechPosition)}</span>
        {dialogueAudioRef.current && speechDuration && speechDuration > 0 ? <input type="range" aria-label="音频播放进度" min={0} max={speechDuration} step={.1} value={Math.min(speechPosition, speechDuration)} style={{ backgroundImage: `linear-gradient(to right, var(--reading-selected) ${Math.min(100, speechPosition / speechDuration * 100)}%, var(--reading-divider) ${Math.min(100, speechPosition / speechDuration * 100)}%)` }} onChange={event => { if (dialogueAudioRef.current) { dialogueAudioRef.current.currentTime = Number(event.target.value); setSpeechPosition(Number(event.target.value)); } }} /> : isDeviceSpeech ? <input type="range" aria-label="设备朗读进度" aria-valuetext={`朗读位置 ${Math.floor(deviceSeekDraft ?? deviceSpeechPercent)}%`} min={0} max={100} step={1} value={deviceSeekDraft ?? deviceSpeechPercent} title="拖动到文本位置；实际播放时间不包含跳过的内容" style={{ backgroundImage: `linear-gradient(to right, var(--reading-selected) ${deviceSeekDraft ?? deviceSpeechPercent}%, var(--reading-divider) ${deviceSeekDraft ?? deviceSpeechPercent}%)` }}
          onPointerDown={event => { draggingDeviceSeek.current = true; resumeAfterDeviceSeek.current = isSpeaking && !speechPausedRef.current; if (resumeAfterDeviceSeek.current) toggleSpeechPause(); event.currentTarget.setPointerCapture(event.pointerId); }}
          onChange={event => { const percent = Number(event.target.value); if (draggingDeviceSeek.current) setDeviceSeekDraft(percent); else seekDeviceSpeech(percent); }}
          onPointerUp={event => { if (!draggingDeviceSeek.current) return; draggingDeviceSeek.current = false; seekDeviceSpeech(Number(event.currentTarget.value)); if (resumeAfterDeviceSeek.current && speechPausedRef.current) toggleSpeechPause(); resumeAfterDeviceSeek.current = false; }}
          onPointerCancel={() => { draggingDeviceSeek.current = false; setDeviceSeekDraft(null); if (resumeAfterDeviceSeek.current && speechPausedRef.current) toggleSpeechPause(); resumeAfterDeviceSeek.current = false; }} /> : <div className="reading-player__track" role="progressbar" aria-label="朗读播放进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={speechDuration ? Math.min(100, speechPosition / speechDuration * 100) : undefined}><span style={{ width: `${speechDuration ? Math.min(100, speechPosition / speechDuration * 100) : 0}%` }} /></div>}
        <span className="reading-player__time" title={isDeviceSpeech && !speechDuration ? '当前文本位置；设备语音不提供音频总时长' : undefined}>{isDeviceSpeech && !speechDuration ? `${Math.floor(deviceSeekDraft ?? deviceSpeechPercent)}%` : formatAudioTime(speechDuration)}</span>
        <button type="button" aria-label="重新播放英文朗读" className="reading-player__restart" disabled={isPreparingSpeech} onClick={() => void startReadingAloud(true)}><RotateCcw size={18} /></button>
      </section>
      {speechError && <p role="alert" className="reading-inline-status">{speechError}</p>}
      {speechNotice && <p role="status" className="reading-inline-status">{speechNotice}</p>}
      <section className="reading-studio__body art-anchor"><HandOutline/><Companion pose="cat-peek-reading" className="reading-companion"/>
        <p className="reading-paragraph-hint">点击段落查看中文翻译 · 重点词汇可单独打开</p>
        <article id="reading-body-panel" className="reading-prose">
          {isDetectedDialogue && formatMode === 'dialogue' ? renderDialogueContent() : renderParagraphContent()}
        </article>
        {missingParagraphs && <div className="reading-legacy-translation"><p>旧短文的已有译文会继续使用，缺少的段落可按需补充。</p><button type="button" disabled={isTranslating} onClick={() => void prepareLegacyParagraphs()}>{isTranslating ? '正在生成段落译文…' : '一次补充本篇段落译文'}</button></div>}
        <LoadingAnimation active={isTranslating || isPreparingSpeech} operation={isTranslating ? 'analysis' : 'wait'} label={isTranslating ? '正在准备段落译文…' : '正在准备朗读…'}/>{translationError && <p role="alert" className="reading-inline-status">{translationError}</p>}
      </section>

      <section className="reading-vocabulary space-y-4 art-anchor"><HandOutline/><Companion pose="hamster-peek-reading" className="reading-companion"/>
        <div className="reading-vocabulary__header flex items-center justify-between pb-2 border-b border-[var(--border-subtle)] flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="type-section font-editorial font-semibold text-[var(--accent-vocab)]">
                本篇精选词汇
              </h2>
              {isTranslating && (
                <span className="type-meta font-ui text-[var(--accent-vocab)] inline-flex items-center gap-1 bg-[var(--accent-vocab)]/10 px-2 py-0.5 rounded-xs">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {getI18nText('syncingVocab')}
                </span>
              )}
            </div>
          </div>
          <button type="button" className="reading-add-toggle" onClick={()=>setLookupOpen(value=>!value)}><Plus size={16}/>添加</button>
          <span className="reading-studio__vocab-count">{reading.selectedVocabulary.length} 个词汇</span>
        </div>

        {bookmarkError && <p className="reading-inline-status" role="alert">{bookmarkError}</p>}
        {lookupOpen && <section className="reading-lookup-panel"><div className="reading-studio__section-heading"><h3>查询文中其他表达</h3><button type="button" aria-label="关闭表达查询" onClick={() => setLookupOpen(false)}><X size={18} /></button></div><ReadingVocabularyEditor key={reading.id} reading={reading} knownVocabulary={knownVocabulary} onSave={onUpdateVocabulary} onInspect={vocab => { setSelectedVocab(vocab); setIsDetailOpen(true); }} /></section>}
        <div className="reading-vocabulary__list" role="list">
          {reading.selectedVocabulary.map((vocab) => {
            const inWordbook = wordbookVocabIds.has(vocabularyKey(vocab.term, vocab.type));
            const localizedMeaning = getLocalizedVocabMeaning(vocab, currentTranslation);

            return (
              <SwipeToRemove key={vocab.id} label={vocab.term} disabled={!!removingTerm || !onRemoveVocabulary} onRemove={async()=>{if(removingTerm||!onRemoveVocabulary)return;setRemovingTerm(vocab.id);setBookmarkError('');try{await onRemoveVocabulary(vocab);}catch{setBookmarkError('移除失败，已有资料已保留，请重试。');}finally{setRemovingTerm(null);}}}>
              <div
                onClick={() => {
                  setSelectedVocab(vocab);
                  setIsDetailOpen(true);
                }}
                className="reading-vocabulary__row group cursor-pointer transition-colors"
              >
                <button type="button" aria-haspopup="dialog" aria-label={`查看 ${vocab.term} 的词汇释义`} onClick={(e) => { e.stopPropagation(); setSelectedVocab(vocab); setIsDetailOpen(true); }} className="reading-vocabulary__term type-term font-editorial font-semibold text-[var(--accent-vocab)] group-hover:text-[var(--text-primary)] transition-colors text-left">
                  {vocab.term}
                </button>
                <div className="reading-vocabulary__meta type-meta font-ui text-[var(--text-muted)]">
                  {vocab.phonetic && <span>{vocab.phonetic}</span>}
                  {vocab.partOfSpeech && <span className="italic">{vocab.partOfSpeech}</span>}
                </div>
                <p className="reading-vocabulary__meaning type-body font-ui text-[var(--text-primary)]">{localizedMeaning || '暂无释义'}</p>
                <button
                  disabled={pendingBookmarks.has(vocab.id)}
                  aria-pressed={inWordbook}
                  onClick={(e) => { e.stopPropagation(); void toggleBookmark(vocab); }}
                  title={inWordbook ? '移出生词本' : getI18nText('addToWordbook')}
                  aria-label={`${inWordbook ? '移出生词本' : '加入生词本'}：${vocab.term}`}
                  className={`reading-vocabulary__bookmark ${inWordbook ? 'is-saved' : ''}`}
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>
              </SwipeToRemove>
            );
          })}
        </div>
      </section>

      {/* Modals */}
      <WordDetailModal
        vocab={selectedVocab ? knownVocabulary.find(item => item.term === selectedVocab.term && item.type === selectedVocab.type) || selectedVocab : null}
        readingContext
        onBeforePronunciation={pauseForVocabulary}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        isInWordbook={selectedVocab ? wordbookVocabIds.has(vocabularyKey(selectedVocab.term, selectedVocab.type)) : false}
        onToggleWordbook={onToggleWordbookFromDetails || onToggleWordbook}
        currentTranslation={currentTranslation}
      />

    </div>
  );
};
