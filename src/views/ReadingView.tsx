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
  Copy, MoreHorizontal, RotateCcw, ArrowRight, PencilLine, X
} from 'lucide-react';
import { ReadingRecord, ReadingTranslation, VocabularyItem } from '../types';
import { splitReadingSentences, groupReadingSentences, hasCompleteSentenceTranslations, formatAudioTime } from '../utils/readingSegments';
import { createDeviceSpeechProgress, locateDeviceSpeechPosition } from '../utils/deviceSpeechProgress';
import { WordDetailModal } from '../components/WordDetailModal';
import { ReadingVocabularyEditor } from '../components/ReadingVocabularyEditor';
import {
  generateDialogueSpeech,
  rememberCompletedDialogueSpeech,
  translateReading,
} from '../services/api';
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
  onUpdateReading?: (updatedReading: ReadingRecord) => void;
  onUpdateVocabulary: (updatedReading: ReadingRecord) => Promise<void>;
  onRewrite: (mode: string, keepVocab: boolean) => void;
  onOpenHistory: () => void;
  onOpenPractice?: () => void;
  isRewriting: boolean;
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
  onRewrite,
  onOpenHistory,
  onOpenPractice,
  isRewriting,
}) => {
  const [selectedVocab, setSelectedVocab] = useState<VocabularyItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRewriteMenuOpen, setIsRewriteMenuOpen] = useState(false);
  useEffect(() => { setIsDetailOpen(false); setSelectedVocab(null); setIsRewriteMenuOpen(false); }, [reading.id]);
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
  const [isDeviceSpeech, setIsDeviceSpeech] = useState(reading.readingType !== 'dialogue');
  const deviceSeekRef = useRef<((percent: number) => void) | null>(null);
  const deviceRevisionRef = useRef(0);
  const suspendDeviceForVocabulary = useRef<(() => void) | null>(null);
  const draggingDeviceSeek = useRef(false);
  const resumeAfterDeviceSeek = useRef(false);
  const [deviceSeekDraft, setDeviceSeekDraft] = useState<number | null>(null);
  const [mobileReadingMode, setMobileReadingMode] = useState<'original' | 'translation'>('original');
  const [keepVocab, setKeepVocab] = useState(true);
  const translationRunRef = useRef(0);
  const translationControllerRef = useRef<AbortController | null>(null);
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
    if ((!isDetectedDialogue || forceDevice) && !('speechSynthesis' in window)) {
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
    setIsDeviceSpeech(!isDetectedDialogue || forceDevice);
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

    const startFreeDeviceFallback = (error: Error) => {
      if (!('speechSynthesis' in window)) return false;
      setIsPreparingSpeech(false);
      setIsSpeaking(true);
      setSpeechError(null);
      setSpeechNotice(`${error?.message || '云端语音连接失败。'} 已自动切换为设备语音。`);

      const availableVoices = getAvailableSpeechVoices();
      if (availableVoices.length > 0) {
        beginBrowserPlayback(availableVoices, true);
      } else {
        speechPauseTimerRef.current = window.setTimeout(() => {
          if (speechRunRef.current === runId) {
            beginBrowserPlayback(getAvailableSpeechVoices(), true);
          }
        }, 180);
      }
      return true;
    };

    if (isDetectedDialogue && !forceDevice) {
      const controller = new AbortController();
      speechAbortRef.current = controller;
      setIsPreparingSpeech(true);

      const playAudioBlob = async (blob: Blob) => {
        const objectUrl = URL.createObjectURL(blob);
        dialogueAudioUrlRef.current = objectUrl;
        const audio = new Audio(objectUrl);
        dialogueAudioRef.current = audio;
        audio.preload = 'auto';
        audio.playbackRate = 1;
        audio.onloadedmetadata = () => { if (speechRunRef.current === runId && Number.isFinite(audio.duration)) setSpeechDuration(audio.duration); };
        audio.ontimeupdate = () => { if (speechRunRef.current === runId) setSpeechPosition(audio.currentTime); };

        try {
          await new Promise<void>((resolve, reject) => {
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              finishDialogueAudioRef.current = null;
              resolve();
            };
            const fail = () => {
              if (settled) return;
              settled = true;
              finishDialogueAudioRef.current = null;
              reject(new Error('角色语音音频无法播放'));
            };
            finishDialogueAudioRef.current = finish;
            audio.onended = finish;
            audio.onerror = fail;
            audio.play().catch(fail);
          });
        } finally {
          if (dialogueAudioRef.current === audio) dialogueAudioRef.current = null;
          if (dialogueAudioUrlRef.current === objectUrl) dialogueAudioUrlRef.current = null;
          URL.revokeObjectURL(objectUrl);
        }
      };

      try {
        // One multi-speaker request generates the complete conversation. This
        // preserves fixed Kore/Orus voices without consuming one API request per
        // sentence, and the resulting audio is reused by the device cache.
        const dialogueAudio = await generateDialogueSpeech(
          queue.map(item => ({ text: item.text, gender: item.gender })),
          controller.signal
        );
        if (speechRunRef.current !== runId) return;
        setIsPreparingSpeech(false);
        setIsSpeaking(true);

        setActiveSpeechTurn(null);
        await playAudioBlob(dialogueAudio);
        void rememberCompletedDialogueSpeech(
          queue.map(item => ({ text: item.text, gender: item.gender })),
          dialogueAudio
        );

        if (speechRunRef.current === runId) {
          setIsSpeaking(false);
          setSpeechNotice('朗读已结束');
          setActiveSpeechTurn(null);
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError' && speechRunRef.current === runId) {
          console.error('Dialogue speech failed:', error);
          if (!startFreeDeviceFallback(error)) {
            setSpeechError(error?.message || '当前设备暂时无法朗读角色语音');
            setIsPreparingSpeech(false);
            setIsSpeaking(false);
            setActiveSpeechTurn(null);
          }
        }
      } finally {
        if (speechAbortRef.current === controller) speechAbortRef.current = null;
      }
      return;
    }

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
  useEffect(() => { deviceSpeechProgress.current.reset(); setDeviceSpeechPercent(0); setDeviceSeekDraft(null); draggingDeviceSeek.current = false; setIsDeviceSpeech(!isDetectedDialogue); setSpeechPosition(0); setSpeechDuration(null); setExpandedSentence(null); setMobileReadingMode('original'); setMoreOpen(false); setLookupOpen(false); }, [reading.id, reading.content]);

  const currentTranslation = reading.translations?.['zh-CN'];
  const translationBlocks = (isDetectedDialogue ? dialogueTurns.map(turn => turn.speech) : reading.content.split(/\n\s*\n/)).filter(block => block.trim()).map(splitReadingSentences);
  const translationSegments = translationBlocks.flat().map(segment => segment.trim());
  const completeTranslation = (translation?: ReadingTranslation) => translationBlocks.length > 0 && translationBlocks.every(block => hasCompleteSentenceTranslations(block, translation));

  const fetchTranslation = async (force = false) => {
    const existing = reading.translations?.['zh-CN'];
    if (translationControllerRef.current || (!force && existing && completeTranslation(existing))) {
      return;
    }
    const controller = new AbortController();
    translationControllerRef.current = controller;
    setIsTranslating(true);
    setTranslationError(null);
    const runId = ++translationRunRef.current;
    try {
      const result = await translateReading({
        text: reading.content,
        translationSegments,
        title: reading.title,
        readingType: reading.readingType,
        vocabulary: reading.selectedVocabulary,
        rewriteExercises: reading.rewritePractice,
      }, controller.signal);

      if (runId !== translationRunRef.current || controller.signal.aborted) return;
      if (!completeTranslation(result)) {
        throw new Error('句子翻译未完整生成，请重试。已有全文译文已保留。');
      }

      const updatedReading: ReadingRecord = {
        ...reading,
        translations: {
          ...(reading.translations || {}),
          'zh-CN': result,
        },
      };
      if (runId !== translationRunRef.current) return;
      await onUpdateReading?.(updatedReading);
    } catch (err: any) {
      if (runId !== translationRunRef.current || controller.signal.aborted) return;
      console.error('Translation failed:', err);
      setTranslationError(err?.message || '地道翻译生成失败，请点击重试');
    } finally {
      if (translationControllerRef.current === controller) {
        translationControllerRef.current = null;
        setIsTranslating(false);
      }
    }
  };

  useEffect(() => () => {
    translationRunRef.current += 1;
    translationControllerRef.current?.abort();
    translationControllerRef.current = null;
  }, [reading.id, reading.content, vocabularySignature]);

  // Upgrade legacy full-text caches once on entry; failures wait for explicit retry.
  useEffect(() => {
    setIsTranslating(false);
    setTranslationError(null);
    void fetchTranslation();
  }, [reading.id, reading.content, vocabularySignature]);

  const handleCopyTranslation = async () => {
    if (!currentTranslation) return;
    setCopyError('');
    try {
      await navigator.clipboard.writeText(`${currentTranslation.title}\n\n${currentTranslation.translatedContent}`);
      setCopiedTranslation(true);
      setTimeout(() => setCopiedTranslation(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
      setCopyError('复制失败，请允许剪贴板访问，或直接选择译文复制。');
    }
  };

  // Synchronize format mode when reading changes
  React.useEffect(() => {
    const turns = parseDialogueTurns(reading.content);
    const hasDialogue =
      reading.readingType === 'dialogue' ||
      turns.filter(t => t.speaker !== null).length >= 2;
    setFormatMode(hasDialogue ? 'dialogue' : 'paragraph');
  }, [reading.id, reading.readingType, reading.content]);

  const rewriteOptions = [
    { id: 'easier', label: '更平易近人 (Easier)' },
    { id: 'harder', label: '提升词汇句型 (Harder)' },
    { id: 'shorter', label: '精简版 (Shorter)' },
    { id: 'longer', label: '丰富细节 (Longer)' },
    { id: 'moreConversational', label: '更生活口语 (More Conversational)' },
    { id: 'story', label: '转为故事叙事 (Story)' },
    { id: 'non-story', label: '转为说明见解 (Non-story)' },
    { id: 'dialogue', label: '转为情境对话 (Dialogue)' },
  ];

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

  const renderSentences = (text: string, prefix: string) => groupReadingSentences(splitReadingSentences(text), currentTranslation).map(({ source: sentence, index, translation: translated }) => {
    const key = `${prefix}-${index}`;
    const expanded = expandedSentence === key && !!translated;
    const open = (fromKeyboard = false) => {
      if (window.getSelection()?.toString()) return;
      setExpandedSentence(expanded ? null : key);
      if (fromKeyboard && translated) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-expanded-sentence="${key}"] .reading-sentence-card__close`)?.focus({ preventScroll: true }));
      if (!translated) void fetchTranslation(true);
    };
    return <React.Fragment key={key}>{expanded ? <span className="reading-sentence-card" data-expanded-sentence={key}>
      <span className="reading-sentence-card__original">{renderTextWithHighlights(sentence.trim())}</span>
      <button type="button" aria-label="关闭句子翻译" className="reading-sentence-card__close" onClick={event => { event.stopPropagation(); setExpandedSentence(null); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-sentence-id="${key}"]`)?.focus({ preventScroll: true })); }}><X size={17} /></button>
      <span className="reading-sentence-card__translation">{translated}</span>
    </span> : <span className="reading-sentence" data-sentence-id={key} role="button" tabIndex={0} aria-label={`查看句子翻译：${sentence.trim()}`} aria-expanded={false} onClick={() => open()} onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); open(true); } }}>{renderTextWithHighlights(sentence)}</span>}</React.Fragment>;
  });

  const renderDialogueTurns = (turns: DialogueTurn[], translated = false) => (
    <div className="reading-dialogue-turns">
      {turns.map((turn, index) => {
        if (!turn.speaker || ['setting', 'scene', '场景', '背景', 'note'].includes(turn.speaker.toLowerCase())) {
          return <div key={index} className="reading-dialogue-scene">{turn.speaker && <span>{turn.speaker}: </span>}{translated ? turn.speech : renderSentences(turn.speech, `turn-${index}`)}</div>;
        }
        const style = SPEAKER_STYLES[speakerMap.get(turn.speaker) ?? 0];
        return <div key={index} className={`reading-dialogue-turn ${isSpeaking && activeSpeechTurn === index ? 'is-reading' : ''}`}>
          <div className="reading-dialogue-speaker">
            <span aria-hidden="true" className={`reading-dialogue-avatar ${style.bg} ${style.text}`}>{turn.speaker.charAt(0).toUpperCase()}</span>
            <span className="reading-dialogue-name">{turn.speaker}</span>
          </div>
          <div className={`reading-dialogue-speech ${translated ? 'reading-dialogue-speech--translated' : ''}`}>
            {translated ? turn.speech : renderSentences(turn.speech, `turn-${index}`)}
          </div>
        </div>;
      })}
    </div>
  );
  const renderDialogueContent = () => renderDialogueTurns(dialogueTurns);

  // Render paragraph format
  const renderParagraphContent = () => {
    if (isDetectedDialogue) return dialogueTurns.map((turn, index) => (
      <p key={index} className="type-reading mb-5 font-editorial text-[var(--text-primary)]">
        {turn.speaker && <span>{turn.speaker}: </span>}{renderSentences(turn.speech, `turn-${index}`)}
      </p>
    ));
    const paragraphs = reading.content.split(/\n\s*\n/).filter(Boolean);
    return paragraphs.map((para, pIdx) => (
      <p key={pIdx} className="type-reading mb-5 font-editorial text-[var(--text-primary)]">
        {renderSentences(para, `paragraph-${pIdx}`)}
      </p>
    ));
  };

  const renderTranslatedDialogue = (translatedText: string) => {
    const mapped = mappedDialogueTranslation(dialogueTurns, currentTranslation);
    // Keep legacy cached text readable without guessing which Chinese sentence
    // belongs to an English turn. Exact sentence mappings take priority.
    const legacy = parseDialogueTurns(translatedText, dialogueTurns.flatMap(turn => turn.speaker ? [turn.speaker] : []));
    return renderDialogueTurns(mapped || legacy, true);
  };

  const renderTranslatedParagraphs = (translatedText: string) => {
    const mapped = isDetectedDialogue ? mappedDialogueTranslation(dialogueTurns, currentTranslation) : null;
    if (mapped) return mapped.map((turn, index) => (
      <p key={index} className="type-translation mb-5 font-ui text-[var(--text-primary)]">
        {turn.speaker && <span>{turn.speaker}: </span>}{turn.speech}
      </p>
    ));
    const paragraphs = translatedText.split(/\n\s*\n/).filter(Boolean);
    return paragraphs.map((para, pIdx) => (
      <p key={pIdx} className="type-translation mb-5 font-ui text-[var(--text-primary)]">
        {para}
      </p>
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
  const translationState = <>
    {isTranslating && !currentTranslation && <p role="status" className="reading-inline-status">正在准备全文翻译…</p>}
    {translationError && <p role="alert" className="reading-inline-status">{translationError} <button type="button" onClick={() => fetchTranslation(true)} disabled={isTranslating}>重试翻译</button></p>}
    {currentTranslation ? (isDetectedDialogue && formatMode === 'dialogue' ? renderTranslatedDialogue(currentTranslation.translatedContent) : renderTranslatedParagraphs(currentTranslation.translatedContent)) : !isTranslating && !translationError && <p>暂无全文翻译。</p>}
  </>;

  return (
    <div className={`page-shell page-shell--reading page-stack--reading reading-page reading-studio ${isDetectedDialogue ? 'reading-studio--dialogue' : ''}`}>
      <header className="reading-studio__header">
        <div><h1 className="reading-page-title font-editorial">{reading.title}</h1><div className="reading-studio__meta"><span>{reading.cefrLevel}</span><span>{({ story: '故事', 'non-story': '说明', dialogue: '对话' })[reading.readingType]} · {reading.content.trim().split(/\s+/).filter(Boolean).length} 词</span></div></div>
        <div ref={moreMenuRef} className="reading-more" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setMoreOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { setMoreOpen(false); (event.currentTarget.querySelector('button') as HTMLButtonElement | null)?.focus(); } }}>
          <button type="button" className="reading-more__trigger" aria-label="更多阅读操作" aria-expanded={moreOpen} aria-controls={moreOpen ? "reading-more-menu" : undefined} onClick={() => setMoreOpen(value => !value)}><MoreHorizontal size={21} /></button>
          {moreOpen && <div id="reading-more-menu" className="reading-more__menu">
            <button type="button" aria-expanded={isRewriteMenuOpen} onClick={() => { setIsRewriteMenuOpen(value => !value); setMoreOpen(false); }}><PencilLine size={17} />改写短文</button>
            <button type="button" onClick={() => { setMoreOpen(false); onOpenHistory(); }}><History size={17} />历史记录</button>
            <button type="button" onClick={() => { setMoreOpen(false); setLookupOpen(true); }}><AlignLeft size={17} />查询文中其他表达</button>
            {isDetectedDialogue && <button type="button" onClick={() => { setFormatMode(value => value === 'dialogue' ? 'paragraph' : 'dialogue'); setMoreOpen(false); }}><AlignLeft size={17} />{formatMode === 'dialogue' ? '切换段落排版' : '切换剧本排版'}</button>}
            <button type="button" disabled={isTranslating} onClick={() => { setMoreOpen(false); void fetchTranslation(true); }}><RefreshCw size={17} />更新全文及句子翻译</button>
            <button type="button" disabled={!currentTranslation} onClick={() => { setMoreOpen(false); void handleCopyTranslation(); }}><Copy size={17} />{copiedTranslation ? '已复制译文' : '复制全文译文'}</button>
          </div>}
        </div>
      </header>
      {copyError && <p role="alert" className="reading-inline-status">{copyError}</p>}
      {isRewriteMenuOpen && <section className="reading-rewrite-panel" aria-label="改写短文设置"><div className="reading-studio__section-heading"><h2>改写短文</h2><button type="button" aria-label="关闭改写设置" onClick={() => setIsRewriteMenuOpen(false)}><X size={19} /></button></div><label><input type="checkbox" checked={keepVocab} onChange={event => setKeepVocab(event.target.checked)} />保留当前精选词汇</label><div>{rewriteOptions.map(option => <button type="button" key={option.id} disabled={isRewriting} onClick={() => { setIsRewriteMenuOpen(false); onRewrite(option.id, keepVocab); }}>{option.label}</button>)}</div></section>}
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
      <section className="reading-studio__body">
        <div className="reading-studio__switch" role="tablist" aria-label="阅读内容模式">
          <button type="button" role="tab" id="reading-original-tab" aria-controls="reading-body-panel" aria-selected={mobileReadingMode === 'original'} onClick={() => setMobileReadingMode('original')}>原文</button>
          <button type="button" role="tab" id="reading-translation-tab" aria-controls="reading-body-panel" aria-selected={mobileReadingMode === 'translation'} onClick={() => setMobileReadingMode('translation')}>全文翻译</button>
        </div>
        {mobileReadingMode === 'original' && isTranslating && <p role="status" className="reading-inline-status">正在准备句子翻译，完成后可点击句子查看。</p>}
        {mobileReadingMode === 'original' && translationError && <p role="alert" className="reading-inline-status">{translationError} <button type="button" onClick={() => void fetchTranslation(true)} disabled={isTranslating}>重试翻译</button></p>}
        <article id="reading-body-panel" role="tabpanel" aria-labelledby={mobileReadingMode === 'original' ? 'reading-original-tab' : 'reading-translation-tab'} className="reading-prose">
          {mobileReadingMode === 'original' ? (isDetectedDialogue && formatMode === 'dialogue' ? renderDialogueContent() : renderParagraphContent()) : translationState}
        </article>
      </section>

      <section className="reading-vocabulary space-y-4">
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
          <span className="reading-studio__vocab-count">{reading.selectedVocabulary.length} 个词汇</span>
        </div>

        <p className="reading-studio__vocab-hint">系统精选词汇 · 点击书签加入生词本</p>
        {bookmarkError && <p className="reading-inline-status" role="alert">{bookmarkError}</p>}
        {lookupOpen && <section className="reading-lookup-panel"><div className="reading-studio__section-heading"><h3>查询文中其他表达</h3><button type="button" aria-label="关闭表达查询" onClick={() => setLookupOpen(false)}><X size={18} /></button></div><ReadingVocabularyEditor key={reading.id} reading={reading} knownVocabulary={knownVocabulary} onSave={onUpdateVocabulary} onInspect={vocab => { setSelectedVocab(vocab); setIsDetailOpen(true); }} /></section>}
        <div className="reading-vocabulary__list" role="list">
          {reading.selectedVocabulary.map((vocab) => {
            const inWordbook = wordbookVocabIds.has(vocab.term.toLowerCase());
            const localizedMeaning = getLocalizedVocabMeaning(vocab, currentTranslation);

            return (
              <div
                key={vocab.id}
                role="listitem"
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
            );
          })}
        </div>
      </section>

      {onOpenPractice && <button type="button" onClick={onOpenPractice} className="reading-studio__practice">
        <PencilLine size={19} aria-hidden="true" />开始句子改写练习 <ArrowRight aria-hidden="true" size={19} />
      </button>}

      {/* Modals */}
      <WordDetailModal
        vocab={selectedVocab}
        readingContext
        onBeforePronunciation={pauseForVocabulary}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        isInWordbook={selectedVocab ? wordbookVocabIds.has(selectedVocab.term.toLowerCase()) : false}
        onToggleWordbook={onToggleWordbookFromDetails || onToggleWordbook}
        currentTranslation={currentTranslation}
      />

    </div>
  );
};
