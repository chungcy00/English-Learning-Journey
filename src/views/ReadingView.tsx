import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Download,
  Edit3,
  RefreshCw,
  History,
  Bookmark,
  Check,
  ChevronDown,
  Volume2,
  Square,
  BookOpen,
  MessageSquare,
  AlignLeft,
  Languages,
  Copy,
  X
} from 'lucide-react';
import { ReadingRecord, VocabularyItem, RewritePracticeItem, ReadingTranslation } from '../types';
import { WordDetailModal } from '../components/WordDetailModal';
import { EditVocabularyModal } from '../components/EditVocabularyModal';
import { RewritePracticeCard } from '../components/RewritePracticeCard';
import { generateReadingPDF } from '../services/pdfGenerator';
import { translateReading } from '../services/api';
import {
  SUPPORTED_LANGUAGES,
  getI18nText,
  getLocalizedVocabMeaning,
  getLocalizedExampleTranslation,
} from '../utils/i18n';
import {
  DIALOGUE_SPEECH_RATE,
  NARRATION_SPEECH_RATE,
  SpeechGender,
  getAvailableSpeechVoices,
  inferSpeakerGender,
  selectDialogueVoice,
  selectVocabularyVoice,
  stopEnglishSpeech,
} from '../utils/speech';

interface ReadingViewProps {
  reading: ReadingRecord;
  wordbookVocabIds: Set<string>;
  onToggleWordbook: (vocab: VocabularyItem) => void;
  onUpdateReadingVocabulary: (updatedVocabs: VocabularyItem[]) => void;
  onUpdateReading?: (updatedReading: ReadingRecord) => void;
  onRewrite: (mode: string, keepVocab: boolean) => void;
  onOpenHistory: () => void;
  isRewriting: boolean;
  targetLanguage?: string;
  onLanguageChange?: (lang: string) => void;
}

interface DialogueTurn {
  speaker: string | null;
  speech: string;
}

interface SpeechQueueItem {
  text: string;
  gender: SpeechGender;
  speakerKey: string;
  speakerIndex: number;
  turnIndex: number | null;
}

const NON_SPEAKER_LABELS = new Set([
  'note', 'ps', 'p.s', 'step', 'tip', 'warning',
]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

// Helper to parse dialogue turns from text (handles line-by-line, single-paragraph merged dialogues, and scene notes)
function parseDialogueTurns(text: string, knownSpeakers: string[] = []): DialogueTurn[] {
  const normalizedText = text
    .replace(/\r\n?/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();

  if (!normalizedText) return [];

  // Prefer names from the English source when parsing a translation. The generic
  // fallback also supports localized names, while avoiding the old greedy `\s`
  // pattern that could swallow several turns into one speaker name.
  const knownPattern = [...new Set(knownSpeakers.filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  const genericSpeakerPattern = '[A-Z][A-Za-z0-9_-]*(?:\\s+[A-Z][A-Za-z0-9_-]*){0,2}|[\\u4e00-\\u9fff]{2,8}';
  const speakerPattern = knownPattern
    ? `(?:${knownPattern})`
    : `(?:${genericSpeakerPattern})`;
  // A model may remove line breaks, so punctuation is also accepted as a turn boundary.
  const inlineSpeakerRegex = new RegExp(
    `(^|[\\s。！？!?；;”"'）)])(${speakerPattern})\\s*[:：]\\s*`,
    'gm'
  );
  const matches: Array<{ speaker: string; index: number; contentStart: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = inlineSpeakerRegex.exec(normalizedText)) !== null) {
    const candidate = m[2].trim();
    if (!NON_SPEAKER_LABELS.has(candidate.toLowerCase())) {
      matches.push({
        speaker: candidate,
        index: m.index + m[1].length,
        contentStart: inlineSpeakerRegex.lastIndex,
      });
    }
  }

  // One match is enough: it still preserves a valid single-turn dialogue and any
  // leading text whose first speaker label was omitted by the translation model.
  if (matches.length >= 1) {
    const turns: DialogueTurn[] = [];
    const firstMatch = matches[0];
    if (firstMatch.index > 0) {
      const intro = normalizedText.substring(0, firstMatch.index).trim();
      if (intro) turns.push({ speaker: null, speech: intro });
    }
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const nextStart = i + 1 < matches.length ? matches[i + 1].index : normalizedText.length;
      const speech = normalizedText.substring(current.contentStart, nextStart).trim();
      turns.push({ speaker: current.speaker, speech });
    }
    return turns;
  }

  // Otherwise split by line breaks and check line starts
  const rawLines = normalizedText.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const speakerLineRegex = new RegExp(`^(${speakerPattern})\\s*[:：]\\s*(.*)$`);
  return rawLines.map(line => {
    const lineMatch = line.match(speakerLineRegex);
    if (lineMatch && !NON_SPEAKER_LABELS.has(lineMatch[1].toLowerCase())) {
      return { speaker: lineMatch[1].trim(), speech: lineMatch[2].trim() };
    }
    return { speaker: null, speech: line };
  });
}

const SPEAKER_STYLES = [
  { bg: 'bg-[#5F654D]', text: 'text-[#FAF7F2]', border: 'border-[#5F654D]/30', label: 'text-[#5F654D]' },
  { bg: 'bg-[#8C6D4F]', text: 'text-[#FAF7F2]', border: 'border-[#8C6D4F]/30', label: 'text-[#8C6D4F]' },
  { bg: 'bg-[#4B6B6E]', text: 'text-[#FAF7F2]', border: 'border-[#4B6B6E]/30', label: 'text-[#4B6B6E]' },
  { bg: 'bg-[#7A5868]', text: 'text-[#FAF7F2]', border: 'border-[#7A5868]/30', label: 'text-[#7A5868]' },
];

export const ReadingView: React.FC<ReadingViewProps> = ({
  reading,
  wordbookVocabIds,
  onToggleWordbook,
  onUpdateReadingVocabulary,
  onUpdateReading,
  onRewrite,
  onOpenHistory,
  isRewriting,
  targetLanguage: propTargetLanguage = 'zh-CN',
  onLanguageChange,
}) => {
  const [selectedVocab, setSelectedVocab] = useState<VocabularyItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditVocabOpen, setIsEditVocabOpen] = useState(false);
  const [isRewriteMenuOpen, setIsRewriteMenuOpen] = useState(false);
  const [keepVocab, setKeepVocab] = useState(true);

  // Parse dialogue turns
  const dialogueTurns = parseDialogueTurns(reading.content);
  const isDetectedDialogue =
    reading.readingType === 'dialogue' ||
    dialogueTurns.filter(t => t.speaker !== null).length >= 2;

  const [formatMode, setFormatMode] = useState<'dialogue' | 'paragraph'>(
    isDetectedDialogue ? 'dialogue' : 'paragraph'
  );

  // Translation state ("短文我需要旁边有个翻译，根据用户需求可以选择不同语言，翻译的也要humanise")
  const [showTranslation, setShowTranslation] = useState<boolean>(true);
  const [targetLanguage, setTargetLanguage] = useState<string>(propTargetLanguage);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [copiedTranslation, setCopiedTranslation] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [activeSpeechTurn, setActiveSpeechTurn] = useState<number | null>(null);
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const speechRunRef = useRef(0);
  const speechPauseTimerRef = useRef<number | null>(null);

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
    speechRunRef.current += 1;
    if (speechPauseTimerRef.current !== null) {
      window.clearTimeout(speechPauseTimerRef.current);
      speechPauseTimerRef.current = null;
    }
    stopEnglishSpeech();
    setIsSpeaking(false);
    setActiveSpeechTurn(null);
  };

  const startReadingAloud = () => {
    if (!('speechSynthesis' in window)) {
      console.warn('当前浏览器不支持英文朗读，请使用最新版 Chrome、Safari 或 Edge。');
      return;
    }

    if (isSpeaking) {
      stopReadingAloud();
      return;
    }

    stopEnglishSpeech();
    const voices = speechVoices.length > 0
      ? speechVoices
      : getAvailableSpeechVoices();
    const queue: SpeechQueueItem[] = [];

    if (isDetectedDialogue) {
      const speakerOrder = new Map<string, number>();
      dialogueTurns.forEach((turn, turnIndex) => {
        if (!turn.speaker || ['setting', 'scene', 'note'].includes(turn.speaker.toLowerCase())) {
          return;
        }

        const speakerKey = turn.speaker.toLowerCase().trim();
        if (!speakerOrder.has(speakerKey)) {
          speakerOrder.set(speakerKey, speakerOrder.size);
        }
        const speakerIndex = speakerOrder.get(speakerKey) || 0;
        const speakerProfile = reading.speakers?.find(
          profile => profile.name.toLowerCase().trim() === speakerKey
        );
        const gender = speakerProfile?.gender || inferSpeakerGender(turn.speaker, speakerIndex);
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
    setIsSpeaking(true);

    const beginPlayback = (resolvedVoices: SpeechSynthesisVoice[]) => {
      // Resolve each character's voice once for the whole reading. This avoids
      // browsers changing voices between turns and makes role boundaries clear.
      const speakerVoices = new Map<string, SpeechSynthesisVoice | undefined>();
      if (isDetectedDialogue) {
        queue.forEach(item => {
          if (!speakerVoices.has(item.speakerKey)) {
            speakerVoices.set(
              item.speakerKey,
              selectDialogueVoice(resolvedVoices, item.gender)
            );
          }
        });
      }

      const maleVoice = selectDialogueVoice(resolvedVoices, 'male');
      const femaleVoice = selectDialogueVoice(resolvedVoices, 'female');
      const hasDistinctGenderVoices = !!maleVoice && !!femaleVoice &&
        maleVoice.voiceURI !== femaleVoice.voiceURI;

      const speakNext = (queueIndex: number) => {
        if (speechRunRef.current !== runId) return;
        if (queueIndex >= queue.length) {
          setIsSpeaking(false);
          setActiveSpeechTurn(null);
          return;
        }

        const item = queue[queueIndex];
        const utterance = new SpeechSynthesisUtterance(item.text);
        const selectedVoice = isDetectedDialogue
          ? speakerVoices.get(item.speakerKey)
          : selectVocabularyVoice(resolvedVoices);
        utterance.lang = 'en-US';
        utterance.voice = selectedVoice || null;
        utterance.volume = 1;
        utterance.rate = isDetectedDialogue ? DIALOGUE_SPEECH_RATE : NARRATION_SPEECH_RATE;
        utterance.pitch = isDetectedDialogue && !hasDistinctGenderVoices
          ? item.gender === 'female' ? 1.06 : 0.94
          : 1;
        setActiveSpeechTurn(item.turnIndex);

        utterance.onend = () => {
          if (speechRunRef.current !== runId) return;
          const nextItem = queue[queueIndex + 1];
          const changedSpeaker = nextItem && nextItem.speakerIndex !== item.speakerIndex;
          const pauseMs = changedSpeaker ? 400 : 160;
          speechPauseTimerRef.current = window.setTimeout(
            () => speakNext(queueIndex + 1),
            pauseMs
          );
        };
        utterance.onerror = (event) => {
          if (speechRunRef.current !== runId || ['canceled', 'interrupted'].includes(event.error)) {
            return;
          }
          speechPauseTimerRef.current = window.setTimeout(
            () => speakNext(queueIndex + 1),
            100
          );
        };

        window.speechSynthesis.speak(utterance);
      };

      speakNext(0);
    };

    if (voices.length > 0) {
      beginPlayback(voices);
    } else {
      // Chrome can expose voices shortly after page load. Waiting once prevents
      // the first playback from assigning the same default voice to every role.
      speechPauseTimerRef.current = window.setTimeout(() => {
        if (speechRunRef.current === runId) {
          beginPlayback(getAvailableSpeechVoices());
        }
      }, 180);
    }
  };

  useEffect(() => {
    return () => {
      speechRunRef.current += 1;
      if (speechPauseTimerRef.current !== null) {
        window.clearTimeout(speechPauseTimerRef.current);
      }
      stopEnglishSpeech();
    };
  }, [reading.id, reading.content]);

  useEffect(() => {
    if (propTargetLanguage && propTargetLanguage !== targetLanguage) {
      setTargetLanguage(propTargetLanguage);
    }
  }, [propTargetLanguage]);

  const currentTranslation = reading.translations?.[targetLanguage];

  const fetchTranslation = async (lang: string, force = false) => {
    const existing = reading.translations?.[lang];
    const hasVocab = !!existing?.vocabularyTranslations && Object.keys(existing.vocabularyTranslations).length > 0;
    if (!force && existing && (lang === 'zh-CN' || hasVocab)) {
      return;
    }
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const result = await translateReading({
        text: reading.content,
        title: reading.title,
        targetLanguage: lang,
        readingType: reading.readingType,
        vocabulary: reading.selectedVocabulary,
        rewriteExercises: reading.rewritePractice,
      });

      const updatedReading: ReadingRecord = {
        ...reading,
        translations: {
          ...(reading.translations || {}),
          [lang]: result,
        },
      };
      onUpdateReading?.(updatedReading);
    } catch (err: any) {
      console.error('Translation failed:', err);
      setTranslationError(err?.message || '地道翻译生成失败，请点击重试');
    } finally {
      setIsTranslating(false);
    }
  };

  // Automatically fetch translation when reading or language changes
  useEffect(() => {
    const existing = reading.translations?.[targetLanguage];
    const needsFetch = !existing || (!existing.vocabularyTranslations && targetLanguage !== 'zh-CN');
    if (needsFetch && !isTranslating) {
      fetchTranslation(targetLanguage);
    }
  }, [reading.id, reading.content, targetLanguage]);

  const handleLanguageChange = (newLang: string) => {
    setTargetLanguage(newLang);
    onLanguageChange?.(newLang);
    const existing = reading.translations?.[newLang];
    const needsFetch = !existing || (!existing.vocabularyTranslations && newLang !== 'zh-CN');
    if (needsFetch) {
      fetchTranslation(newLang);
    }
  };

  const handleCopyTranslation = async () => {
    if (!currentTranslation) return;
    try {
      await navigator.clipboard.writeText(`${currentTranslation.title}\n\n${currentTranslation.translatedContent}`);
      setCopiedTranslation(true);
      setTimeout(() => setCopiedTranslation(false), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
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
          <span
            key={idx}
            onClick={() => handleTermClick(part)}
            className="vocab-highlight"
            title="点击查看词汇释义"
          >
            {part}
          </span>
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

  // Render dialogue format (screenplay / turn-by-turn conversational bubbles)
  const renderDialogueContent = () => {
    return (
      <div className="space-y-3 sm:space-y-4">
        {dialogueTurns.map((turn, tIdx) => {
          if (!turn.speaker || turn.speaker.toLowerCase() === 'setting' || turn.speaker.toLowerCase() === 'scene') {
            return (
              <div
                key={tIdx}
                className="italic font-editorial text-sm sm:text-base text-[#717265] bg-[#E5DED0]/40 border-l-2 border-[#73785E] px-4 py-2.5 rounded-xs my-2"
              >
                {turn.speaker ? (
                  <span className="not-italic font-ui font-semibold text-xs text-[#5F654D] uppercase tracking-wider block mb-1">
                    {turn.speaker}:
                  </span>
                ) : null}
                {renderTextWithHighlights(turn.speech)}
              </div>
            );
          }

          const styleIdx = speakerMap.get(turn.speaker) ?? 0;
          const style = SPEAKER_STYLES[styleIdx];
          const initial = turn.speaker.charAt(0).toUpperCase();

          return (
            <div
              key={tIdx}
              className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-sm bg-[#FAF7F2]/80 hover:bg-[#FAF7F2] border transition-all ${
                isSpeaking && activeSpeechTurn === tIdx
                  ? 'border-[#73785E] ring-2 ring-[#73785E]/20 shadow-sm'
                  : 'border-[#D4CCBC]/50'
              }`}
            >
              {/* Speaker Avatar & Name */}
              <div className="flex-shrink-0 flex flex-col items-center pt-0.5 w-16 sm:w-20 text-center">
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-ui font-bold text-xs sm:text-sm shadow-xs ${style.bg} ${style.text}`}
                >
                  {initial}
                </div>
                <span
                  className={`font-ui text-xs font-semibold mt-1.5 truncate max-w-full tracking-wide uppercase ${style.label}`}
                  title={turn.speaker}
                >
                  {turn.speaker}
                </span>
              </div>

              {/* Spoken dialogue text */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="font-editorial text-base sm:text-lg text-[#292B25] leading-relaxed">
                  {renderTextWithHighlights(turn.speech)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render paragraph format
  const renderParagraphContent = () => {
    const paragraphs = reading.content.split(/\n\s*\n/).filter(Boolean);
    return paragraphs.map((para, pIdx) => (
      <p key={pIdx} className="mb-5 leading-loose font-editorial text-base sm:text-lg text-[#292B25]">
        {renderTextWithHighlights(para)}
      </p>
    ));
  };

  // Render translated dialogue turns
  const renderTranslatedDialogue = (translatedText: string) => {
    const originalSpokenTurns = dialogueTurns.filter(turn => turn.speaker !== null);
    const knownSpeakers = originalSpokenTurns.map(turn => turn.speaker as string);
    const parsedTurns = parseDialogueTurns(translatedText, knownSpeakers);

    // Some translations omit only the first `Speaker:` label. If the remaining
    // turn count still aligns with the source, restore that label for display.
    const turns = parsedTurns.map((turn, index) => {
      if (!turn.speaker && parsedTurns.length === originalSpokenTurns.length) {
        return { ...turn, speaker: originalSpokenTurns[index]?.speaker || null };
      }
      return turn;
    });

    return (
      <div className="space-y-3 sm:space-y-4">
        {turns.map((turn, tIdx) => {
          if (!turn.speaker || ['setting', 'scene', '场景', '背景', 'note'].includes(turn.speaker.toLowerCase())) {
            return (
              <div
                key={tIdx}
                className="italic font-editorial text-sm sm:text-base text-[#717265] bg-[#E5DED0]/40 border-l-2 border-[#73785E] px-4 py-2.5 rounded-xs my-2"
              >
                {turn.speaker ? (
                  <span className="not-italic font-ui font-semibold text-xs text-[#5F654D] uppercase tracking-wider block mb-1">
                    {turn.speaker}:
                  </span>
                ) : null}
                {turn.speech}
              </div>
            );
          }

          const sourceSpeaker = knownSpeakers.find(
            speaker => speaker.toLowerCase() === turn.speaker?.toLowerCase()
          );
          const speakerKey = sourceSpeaker || turn.speaker;
          const styleIdx = speakerMap.get(speakerKey) ?? (tIdx % SPEAKER_STYLES.length);
          const style = SPEAKER_STYLES[styleIdx];
          const initial = turn.speaker.charAt(0).toUpperCase();

          return (
            <div
              key={tIdx}
              className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-sm bg-[#FAF7F2]/90 hover:bg-[#FAF7F2] border border-[#D4CCBC]/50 transition-colors"
            >
              <div className="flex-shrink-0 flex flex-col items-center pt-0.5 w-16 sm:w-20 text-center">
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-ui font-bold text-xs sm:text-sm shadow-xs ${style.bg} ${style.text}`}
                >
                  {initial}
                </div>
                <span
                  className={`font-ui text-xs font-semibold mt-1.5 truncate max-w-full tracking-wide uppercase ${style.label}`}
                  title={turn.speaker}
                >
                  {turn.speaker}
                </span>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="font-editorial text-base sm:text-lg text-[#292B25] leading-relaxed">
                  {turn.speech}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTranslatedParagraphs = (translatedText: string) => {
    const paragraphs = translatedText.split(/\n\s*\n/).filter(Boolean);
    return paragraphs.map((para, pIdx) => (
      <p key={pIdx} className="mb-5 leading-loose font-ui text-sm sm:text-base text-[#292B25]">
        {para}
      </p>
    ));
  };

  const handleDownloadPDF = () => {
    generateReadingPDF(reading, {
      showTranslation: true,
      currentTranslation,
      vocabTranslations: currentTranslation?.vocabularyTranslations,
      exerciseTranslations: currentTranslation?.exerciseTranslations,
      targetLanguage
    });
  };

  const renderReadAloudButton = () => (
    <button
      type="button"
      onClick={startReadingAloud}
      aria-pressed={isSpeaking}
      title={isSpeaking ? '停止英文朗读' : isDetectedDialogue ? '按角色声线朗读英文对话' : '朗读英文短文'}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 border text-xs font-ui rounded-sm transition-colors ${
        isSpeaking
          ? 'bg-[#5F654D] text-[#FAF7F2] border-[#5F654D] shadow-xs'
          : 'bg-[#F2EEE4] text-[#5F654D] hover:bg-[#E5DED0] border-[#5F654D]/40'
      }`}
    >
      {isSpeaking ? (
        <Square className="w-3.5 h-3.5 fill-current" />
      ) : (
        <Volume2 className="w-3.5 h-3.5" />
      )}
      <span>{isSpeaking ? '停止朗读' : isDetectedDialogue ? '角色朗读' : '英文朗读'}</span>
    </button>
  );

  return (
    <div className={`${showTranslation ? 'max-w-7xl' : 'max-w-4xl'} mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 transition-all`}>
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#D4CCBC]">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Low key status badge (PRD Section 12) */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xs bg-[#73785E]/10 border border-[#73785E]/20 text-[11px] font-ui text-[#5F654D] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#73785E]"></span>
            Humanised
          </span>
          <span className="text-xs font-ui font-semibold px-2 py-0.5 bg-[#E5DED0] text-[#717265] rounded-xs uppercase">
            {reading.cefrLevel}
          </span>
          <span className="text-xs text-[#717265] font-ui capitalize">
            {reading.readingType}
          </span>

          {/* Translation Toggle & Quick Language Pill */}
          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs border text-xs font-ui transition-colors ${
              showTranslation
                ? 'bg-[#5F654D] text-[#FAF7F2] border-[#5F654D] shadow-xs'
                : 'bg-[#F2EEE4] text-[#717265] border-[#D4CCBC] hover:text-[#292B25] hover:bg-[#E5DED0]'
            }`}
            title={showTranslation ? '收起对照翻译' : '展开旁边对照翻译'}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{showTranslation ? '对照翻译已开启' : '对照翻译'}</span>
            <span className="opacity-80">
              {SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage)?.flag}
            </span>
          </button>
        </div>

        {/* Action Buttons: Edit Vocab, Rewrite, PDF, History */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsEditVocabOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F2EEE4] text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0] border border-[#D4CCBC] text-xs font-ui rounded-sm transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit Vocabulary</span>
            <span className="sm:hidden">词汇</span>
          </button>

          {/* Rewrite Dropdown (PRD Section 21) */}
          <div className="relative">
            <button
              onClick={() => setIsRewriteMenuOpen(!isRewriteMenuOpen)}
              disabled={isRewriting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F2EEE4] text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0] border border-[#D4CCBC] text-xs font-ui rounded-sm transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRewriting ? 'animate-spin' : ''}`} />
              <span>Rewrite</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isRewriteMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm shadow-lg z-20 p-2 space-y-1">
                <div className="px-2 py-1.5 border-b border-[#D4CCBC]/60 flex items-center justify-between">
                  <label className="text-[11px] font-ui text-[#292B25] flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keepVocab}
                      onChange={(e) => setKeepVocab(e.target.checked)}
                      className="rounded-xs text-[#73785E]"
                    />
                    <span>保留当前生词 (Keep Vocab)</span>
                  </label>
                </div>
                <div className="max-h-60 overflow-y-auto pt-1">
                  {rewriteOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setIsRewriteMenuOpen(false);
                        onRewrite(opt.id, keepVocab);
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs font-ui text-[#292B25] hover:bg-[#E5DED0] rounded-xs transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Generate PDF Button */}
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#73785E] text-[#F2EEE4] hover:bg-[#73785E]/90 text-xs font-ui rounded-sm transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Generate PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>

          {/* History Button */}
          <button
            onClick={onOpenHistory}
            title="查看历史短文"
            className="p-1.5 text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0] border border-[#D4CCBC] rounded-sm transition-colors"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Reading Area: Side-by-side Bilingual Layout */}
      {showTranslation ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: English Reading Card */}
          <article className="bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm p-6 sm:p-8 shadow-xs flex flex-col">
            <header className="mb-6 pb-4 border-b border-[#D4CCBC]/50 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-ui text-xs text-[#717265]">
                    Topic: {reading.topic}
                  </span>
                </div>
                <h1 className="font-editorial text-xl sm:text-2xl font-semibold text-[#292B25] tracking-tight leading-tight">
                  {reading.title}
                </h1>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                {renderReadAloudButton()}

                {/* Dialogue vs Paragraph Toggle */}
                {isDetectedDialogue && (
                  <div className="flex items-center gap-1 bg-[#E5DED0]/70 p-1 rounded-sm text-xs font-ui border border-[#D4CCBC]/50">
                    <button
                      type="button"
                      onClick={() => setFormatMode('dialogue')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xs transition-colors ${
                        formatMode === 'dialogue'
                          ? 'bg-[#F2EEE4] text-[#292B25] font-semibold shadow-xs'
                          : 'text-[#717265] hover:text-[#292B25]'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>剧本</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormatMode('paragraph')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xs transition-colors ${
                        formatMode === 'paragraph'
                          ? 'bg-[#F2EEE4] text-[#292B25] font-semibold shadow-xs'
                          : 'text-[#717265] hover:text-[#292B25]'
                      }`}
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                      <span>段落</span>
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* Content with highlighted vocabulary */}
            <div className="prose max-w-none text-[#292B25] flex-1">
              {formatMode === 'dialogue' && isDetectedDialogue
                ? renderDialogueContent()
                : renderParagraphContent()}
            </div>
          </article>

          {/* Right Column: Humanised Translation Card ("短文我需要旁边有个翻译") */}
          <article className="bg-[#FAF7F2] border border-[#D4CCBC] rounded-sm p-6 sm:p-8 shadow-xs flex flex-col relative">
            <header className="mb-6 pb-4 border-b border-[#D4CCBC]/50 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-ui px-2 py-0.5 rounded-xs bg-[#5F654D]/10 text-[#5F654D] font-medium">
                    <Sparkles className="w-3 h-3" />
                    自然语感译文 (Humanised)
                  </span>
                  <span className="text-xs font-ui text-[#717265]">
                    {SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage)?.native || targetLanguage}
                  </span>
                </div>
                <h2 className="font-ui text-lg sm:text-xl font-semibold text-[#292B25] tracking-tight leading-tight">
                  {currentTranslation?.title || (isTranslating ? '正在生成自然译文...' : reading.title)}
                </h2>
              </div>

              {/* Language Selector & Actions */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                {/* Language Picker Dropdown */}
                <div className="relative">
                  <select
                    value={targetLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="appearance-none bg-[#E5DED0]/70 hover:bg-[#E5DED0] border border-[#D4CCBC] text-[#292B25] text-xs font-ui py-1.5 pl-2.5 pr-7 rounded-sm focus:outline-none cursor-pointer"
                    title="选择目标翻译语言"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.native}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#717265] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Regenerate Button */}
                <button
                  type="button"
                  onClick={() => fetchTranslation(targetLanguage, true)}
                  disabled={isTranslating}
                  title="重新按母语习惯润色翻译"
                  className="p-1.5 text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0] border border-[#D4CCBC] rounded-sm transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTranslating ? 'animate-spin' : ''}`} />
                </button>

                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopyTranslation}
                  disabled={!currentTranslation || isTranslating}
                  title="复制地道译文"
                  className="p-1.5 text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0] border border-[#D4CCBC] rounded-sm transition-colors disabled:opacity-50"
                >
                  {copiedTranslation ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Hide Button */}
                <button
                  type="button"
                  onClick={() => setShowTranslation(false)}
                  title="收起对照翻译"
                  className="p-1.5 text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0] border border-[#D4CCBC] rounded-sm transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </header>

            {/* Translation Content */}
            <div className="prose max-w-none text-[#292B25] flex-1">
              {isTranslating ? (
                <div className="py-16 px-4 text-center">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#5F654D]/10 text-[#5F654D] mb-3 animate-pulse">
                    <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <h4 className="font-editorial text-base font-semibold text-[#292B25]">
                    正在生成地道母语译文...
                  </h4>
                  <p className="text-xs font-ui text-[#717265] mt-1.5 max-w-xs mx-auto leading-relaxed">
                    AI 正在根据母语说话习惯与情境语感进行 Humanise 润色，确保译文自然地道，消除机械直译痕迹。
                  </p>
                </div>
              ) : translationError ? (
                <div className="p-4 rounded-sm bg-amber-50 border border-amber-200 text-center my-6">
                  <p className="text-xs text-amber-800 font-ui mb-2">{translationError}</p>
                  <button
                    type="button"
                    onClick={() => fetchTranslation(targetLanguage, true)}
                    className="px-3 py-1 bg-amber-700 text-white rounded-xs text-xs font-ui hover:bg-amber-800"
                  >
                    重试翻译
                  </button>
                </div>
              ) : currentTranslation ? (
                formatMode === 'dialogue' && isDetectedDialogue
                  ? renderTranslatedDialogue(currentTranslation.translatedContent)
                  : renderTranslatedParagraphs(currentTranslation.translatedContent)
              ) : (
                <div className="py-16 text-center text-xs font-ui text-[#717265]">
                  暂无翻译，请点击刷新生成
                </div>
              )}
            </div>
          </article>
        </div>
      ) : (
        /* Translation is closed: Single Column View */
        <article className="bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm p-6 sm:p-10 shadow-xs">
          <header className="mb-6 pb-4 border-b border-[#D4CCBC]/50 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-ui text-xs text-[#717265]">
                  Topic: {reading.topic}
                </span>
              </div>
              <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#292B25] tracking-tight leading-tight">
                {reading.title}
              </h1>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              {renderReadAloudButton()}

              <button
                type="button"
                onClick={() => setShowTranslation(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#FAF7F2] text-[#5F654D] hover:bg-[#E5DED0] border border-[#5F654D]/40 text-xs font-ui rounded-xs transition-colors"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>展开对照翻译</span>
              </button>

              {isDetectedDialogue && (
                <div className="flex items-center gap-1 bg-[#E5DED0]/70 p-1 rounded-sm text-xs font-ui self-start sm:self-auto border border-[#D4CCBC]/50">
                  <button
                    type="button"
                    onClick={() => setFormatMode('dialogue')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xs transition-colors ${
                      formatMode === 'dialogue'
                        ? 'bg-[#F2EEE4] text-[#292B25] font-semibold shadow-xs'
                        : 'text-[#717265] hover:text-[#292B25]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>对话剧本</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormatMode('paragraph')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xs transition-colors ${
                      formatMode === 'paragraph'
                        ? 'bg-[#F2EEE4] text-[#292B25] font-semibold shadow-xs'
                        : 'text-[#717265] hover:text-[#292B25]'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                    <span>段落格式</span>
                  </button>
                </div>
              )}
            </div>
          </header>

          <div className="prose max-w-none text-[#292B25]">
            {formatMode === 'dialogue' && isDetectedDialogue
              ? renderDialogueContent()
              : renderParagraphContent()}
          </div>
        </article>
      )}

      {/* Vocabulary Section (PRD Section 13 & 16) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#D4CCBC] flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-editorial text-xl sm:text-2xl font-semibold text-[#5F654D]">
                {getI18nText(targetLanguage, 'vocabSectionTitle')} ({reading.selectedVocabulary.length})
              </h2>
              {isTranslating && (
                <span className="text-[11px] font-ui text-[#5F654D] inline-flex items-center gap-1 bg-[#5F654D]/10 px-2 py-0.5 rounded-xs">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {getI18nText(targetLanguage, 'syncingVocab')}
                </span>
              )}
            </div>
            <p className="text-xs font-ui text-[#717265]">
              {getI18nText(targetLanguage, 'vocabSectionSub')}
            </p>
          </div>
          <button
            onClick={() => setIsEditVocabOpen(true)}
            className="text-xs font-ui text-[#73785E] hover:underline"
          >
            {getI18nText(targetLanguage, 'adjustVocab')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {reading.selectedVocabulary.map((vocab) => {
            const inWordbook = wordbookVocabIds.has(vocab.term.toLowerCase());
            const localizedMeaning = getLocalizedVocabMeaning(vocab, targetLanguage, currentTranslation);
            const localizedExample = getLocalizedExampleTranslation(vocab, targetLanguage, currentTranslation);

            return (
              <div
                key={vocab.id}
                onClick={() => {
                  setSelectedVocab(vocab);
                  setIsDetailOpen(true);
                }}
                className="group cursor-pointer p-4 bg-[#E5DED0]/30 hover:bg-[#E5DED0]/70 border border-[#D4CCBC] rounded-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-editorial text-lg font-semibold text-[#5F654D] group-hover:text-[#292B25] transition-colors">
                      {vocab.term}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWordbook(vocab);
                      }}
                      title={inWordbook ? getI18nText(targetLanguage, 'inWordbook') : getI18nText(targetLanguage, 'addToWordbook')}
                      className={`p-1 rounded-xs transition-colors ${
                        inWordbook
                          ? 'text-[#5F654D] bg-[#73785E]/10'
                          : 'text-[#A5AA91] hover:text-[#73785E]'
                      }`}
                    >
                      <Bookmark className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#717265] font-ui mb-2">
                    {vocab.phonetic && <span>{vocab.phonetic}</span>}
                    <span>•</span>
                    <span className="italic">{vocab.partOfSpeech}</span>
                  </div>

                  <p className="text-xs font-ui font-medium text-[#292B25] mb-1">
                    {localizedMeaning}
                  </p>

                  <p className="font-editorial text-sm text-[#717265] line-clamp-2 italic">
                    "{vocab.example}"
                  </p>
                  {localizedExample && (
                    <p className="font-ui text-xs text-[#717265]/85 line-clamp-1 mt-0.5">
                      {localizedExample}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Rewrite the Sentence Practice Section (PRD Section 22-27) */}
      {reading.rewritePractice && reading.rewritePractice.length > 0 && (
        <section className="space-y-4 pt-4">
          <div className="pb-2 border-b border-[#D4CCBC]">
            <h2 className="font-editorial text-xl sm:text-2xl font-semibold text-[#292B25]">
              {getI18nText(targetLanguage, 'rewriteSectionTitle')}
            </h2>
            <p className="text-xs font-ui text-[#717265]">
              {getI18nText(targetLanguage, 'rewriteSectionSub')}
            </p>
          </div>

          <div className="space-y-4">
            {reading.rewritePractice.map((item, idx) => (
              <RewritePracticeCard
                key={item.id || idx}
                item={item}
                index={idx}
                cefrLevel={reading.cefrLevel}
                targetLanguage={targetLanguage}
                currentTranslation={currentTranslation}
              />
            ))}
          </div>
        </section>
      )}

      {/* Modals */}
      <WordDetailModal
        vocab={selectedVocab}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        isInWordbook={selectedVocab ? wordbookVocabIds.has(selectedVocab.term.toLowerCase()) : false}
        onToggleWordbook={onToggleWordbook}
        targetLanguage={targetLanguage}
        currentTranslation={currentTranslation}
      />

      <EditVocabularyModal
        isOpen={isEditVocabOpen}
        onClose={() => setIsEditVocabOpen(false)}
        currentVocabList={reading.selectedVocabulary}
        readingId={reading.id}
        readingContent={reading.content}
        onSave={onUpdateReadingVocabulary}
        targetLanguage={targetLanguage}
      />
    </div>
  );
};
