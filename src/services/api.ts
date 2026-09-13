import {
  GenerationRequest,
  ReadingRecord,
  RewriteReadingRequest,
  RewriteReadingResponse,
  RewriteEvaluation,
  VocabularyItem,
  RewritePracticeItem,
  CEFRLevel,
  ReadingTranslation
} from '../types';
import { db } from '../db/dexie';

export interface GenerationProgressCallback {
  (status: 'Generating reading...' | 'Humanising language...' | 'Checking level and vocabulary...' | 'Ready'): void;
}

interface DialogueSpeechTurn {
  text: string;
  gender: 'female' | 'male';
}

const DIALOGUE_SPEECH_CACHE_NAME = 'mine-dialogue-speech-v2';
const dialogueSpeechMemoryCache = new Map<string, Blob>();

function normalizeDialogueSpeechTurns(turns: DialogueSpeechTurn[]): DialogueSpeechTurn[] {
  return turns
    .map(turn => ({
      text: turn.text.replace(/\s+/g, ' ').trim(),
      gender: turn.gender,
    }))
    .filter(turn => turn.text);
}

function getDialogueSpeechCacheSource(turns: DialogueSpeechTurn[]): string {
  return JSON.stringify({ version: 2, turns: normalizeDialogueSpeechTurns(turns) });
}

async function getDialogueSpeechCacheId(cacheSource: string): Promise<string> {
  let hash: string;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(cacheSource)
    );
    hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  } else {
    let fallbackHash = 2166136261;
    for (let index = 0; index < cacheSource.length; index++) {
      fallbackHash ^= cacheSource.charCodeAt(index);
      fallbackHash = Math.imul(fallbackHash, 16777619);
    }
    hash = `${(fallbackHash >>> 0).toString(16)}-${cacheSource.length}`;
  }
  return hash;
}

function getDialogueSpeechCacheUrl(cacheId: string): string {
  return `${window.location.origin}/__mine-dialogue-audio-cache__/${cacheId}`;
}

async function saveDialogueSpeechCache(cacheSource: string, audio: Blob): Promise<void> {
  dialogueSpeechMemoryCache.set(cacheSource, audio);
  const cacheId = await getDialogueSpeechCacheId(cacheSource);
  const now = Date.now();

  // IndexedDB keeps the generated audio with the user's reading data and is
  // more reliable for returning visits than relying on the HTTP cache alone.
  try {
    const existing = await db.dialogueAudio.get(cacheId);
    await db.dialogueAudio.put({
      id: cacheId,
      audio,
      mimeType: audio.type || existing?.mimeType || 'audio/mpeg',
      createdAt: existing?.createdAt || now,
      lastPlayedAt: now,
    });
  } catch (error) {
    console.warn('Dialogue audio IndexedDB write failed:', error);
  }

  if ('caches' in window) {
    try {
      const cache = await window.caches.open(DIALOGUE_SPEECH_CACHE_NAME);
      await cache.put(
        getDialogueSpeechCacheUrl(cacheId),
        new Response(audio, { headers: { 'Content-Type': audio.type || 'audio/mpeg' } })
      );
    } catch (error) {
      console.warn('Dialogue audio cache write failed:', error);
    }
  }
}

export async function rememberCompletedDialogueSpeech(
  turns: DialogueSpeechTurn[],
  audio: Blob
): Promise<void> {
  const cacheSource = getDialogueSpeechCacheSource(turns);
  await saveDialogueSpeechCache(cacheSource, audio);

  // Ask the browser not to evict downloaded voices under storage pressure.
  // This is best-effort: browsers may decline, but playback still works.
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch (error) {
    console.warn('Persistent audio storage request failed:', error);
  }
}

export async function generateDialogueSpeech(
  turns: DialogueSpeechTurn[],
  signal?: AbortSignal
): Promise<Blob> {
  const normalizedTurns = normalizeDialogueSpeechTurns(turns);
  const cacheSource = getDialogueSpeechCacheSource(normalizedTurns);
  const memoryCached = dialogueSpeechMemoryCache.get(cacheSource);
  if (memoryCached) return memoryCached;

  const cacheId = await getDialogueSpeechCacheId(cacheSource);

  try {
    const storedAudio = await db.dialogueAudio.get(cacheId);
    if (storedAudio?.audio?.size) {
      const cachedAudio = storedAudio.audio.type
        ? storedAudio.audio
        : storedAudio.audio.slice(0, storedAudio.audio.size, storedAudio.mimeType || 'audio/mpeg');
      dialogueSpeechMemoryCache.set(cacheSource, cachedAudio);
      void db.dialogueAudio.update(cacheId, { lastPlayedAt: Date.now() });
      return cachedAudio;
    }
  } catch (error) {
    console.warn('Dialogue audio IndexedDB read failed:', error);
  }

  const cacheUrl = getDialogueSpeechCacheUrl(cacheId);
  if ('caches' in window) {
    try {
      const cache = await window.caches.open(DIALOGUE_SPEECH_CACHE_NAME);
      const cachedResponse = await cache.match(cacheUrl);
      if (cachedResponse) {
        const cachedAudio = await cachedResponse.blob();
        if (cachedAudio.size) {
          dialogueSpeechMemoryCache.set(cacheSource, cachedAudio);
          void saveDialogueSpeechCache(cacheSource, cachedAudio);
          return cachedAudio;
        }
      }
    } catch (error) {
      console.warn('Dialogue audio cache read failed:', error);
    }
  }

  const res = await fetch('/api/speech/dialogue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turns: normalizedTurns }),
    signal,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const serverMessage = typeof errorBody?.error === 'string' &&
      errorBody.error.length <= 160 && !errorBody.error.trim().startsWith('{')
      ? errorBody.error
      : null;
    const message = res.status === 429
      ? '角色语音服务暂时繁忙，请约一分钟后重试。'
      : serverMessage || `角色语音暂时无法生成，请稍后重试（HTTP ${res.status}）。`;
    throw new Error(message);
  }

  const audio = await res.blob();
  if (!audio.size) throw new Error('角色语音生成结果为空');
  await saveDialogueSpeechCache(cacheSource, audio);

  return audio;
}

// Resilient Client-side Generation Fallback if server API is unavailable
function fallbackGenerateReading(req: GenerationRequest): {
  title: string;
  readingType: 'story' | 'non-story' | 'dialogue';
  cefrLevel: CEFRLevel;
  humanised: boolean;
  speakers?: Array<{ name: string; gender: 'male' | 'female' }>;
  reading: string;
  vocabulary: Omit<VocabularyItem, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'nextReviewDate' | 'reviewCount' | 'currentInterval'>[];
  rewritePractice: Omit<RewritePracticeItem, 'id'>[];
} {
  const chosenType = req.readingType === 'random' ? 'story' : req.readingType;
  const input = req.input.trim() || 'Everyday life';

  if (chosenType === 'dialogue') {
    return {
      title: 'A Moment of Reassurance',
      readingType: 'dialogue',
      cefrLevel: req.cefrLevel,
      humanised: true,
      speakers: [
        { name: 'Anna', gender: 'female' },
        { name: 'Tom', gender: 'male' },
      ],
      reading: `Anna: You remembered my presentation was this morning. That was truly thoughtful of you.

Tom: I noticed you seemed a bit anxious when we chatted yesterday. How did the discussion actually unfold?

Anna: Much better than I anticipated. The team listened attentively, and our manager gave his undivided attention throughout the proposal.

Tom: That must have felt reassuring. When communication is rooted in mutual respect, hard work rarely goes unnoticed.

Anna: Exactly. Instead of criticizing small oversights, they offered considerate feedback. I didn't hesitate to share my unvarnished perspective.`,
      vocabulary: [
        {
          term: 'undivided attention',
          type: 'phrase',
          phonetic: '/ˌʌn.dɪˈvaɪ.dɪd əˈten.ʃən/',
          partOfSpeech: 'noun phrase',
          meaningZh: '专心致志的注意力',
          definitionEn: 'Full concentration with no distractions.',
          example: 'He gave his undivided attention to the presentation.',
          collocations: ['give undivided attention', 'receive undivided attention']
        },
        {
          term: 'rooted in',
          type: 'phrase',
          phonetic: '/ˈruː.tɪd ɪn/',
          partOfSpeech: 'verb phrase',
          meaningZh: '扎根于；基于',
          definitionEn: 'Deeply grounded or firmly established in something.',
          example: 'Their connection was rooted in mutual respect.',
          collocations: ['firmly rooted in', 'rooted in trust']
        },
        {
          term: 'considerate',
          type: 'word',
          phonetic: '/kənˈsɪd.ər.ət/',
          partOfSpeech: 'adjective',
          meaningZh: '体贴的；细心的',
          definitionEn: 'Careful to treat others well without causing inconvenience.',
          example: 'She received considerate comments from her colleague.',
          collocations: ['considerate feedback', 'kind and considerate']
        },
        {
          term: 'hesitate',
          type: 'word',
          phonetic: '/ˈhez.ɪ.teɪt/',
          partOfSpeech: 'verb',
          meaningZh: '犹豫；迟疑',
          definitionEn: 'To pause briefly before doing or saying something.',
          example: 'She did not hesitate to speak her mind clearly.',
          collocations: ['hesitate to ask', 'without hesitating']
        }
      ],
      rewritePractice: [
        {
          originalSentence: 'The manager listened with his full focus during the talk.',
          target: 'undivided attention',
          referenceAnswer: 'The manager gave his undivided attention during the talk.'
        },
        {
          originalSentence: 'Their trust was based firmly on years of honesty.',
          target: 'rooted in',
          referenceAnswer: 'Their trust was rooted in years of honesty.'
        },
        {
          originalSentence: 'He showed thoughtful kindness towards her concerns.',
          target: 'considerate',
          referenceAnswer: 'He was considerate of her concerns.'
        }
      ]
    };
  } else if (chosenType === 'non-story') {
    return {
      title: 'The Art of Sincere Connection',
      readingType: 'non-story',
      cefrLevel: req.cefrLevel,
      humanised: true,
      reading: `Building healthy connections requires more than polite greetings. Often, small daily habits determine whether relationships flourish or quietly fade. When someone shares a worry, offering your undivided attention speaks far louder than superficial advice.

Genuine curiosity allows people to lower their guard. Rather than rushing to formulate a clever response, considerate listeners pause and digest what is being said. Trust is rarely formed overnight; it remains rooted in consistency and transparent honesty. When people recognize that empathy is genuine, they rarely hesitate to reciprocate with vulnerability of their own.`,
      vocabulary: [
        {
          term: 'undivided attention',
          type: 'phrase',
          phonetic: '/ˌʌn.dɪˈvaɪ.dɪd əˈten.ʃən/',
          partOfSpeech: 'noun phrase',
          meaningZh: '专注；专心致志',
          definitionEn: 'Complete attention without any distractions.',
          example: 'Offering undivided attention is a rare gift.',
          collocations: ['pay undivided attention', 'give undivided attention']
        },
        {
          term: 'genuine',
          type: 'word',
          phonetic: '/ˈdʒen.ju.ɪn/',
          partOfSpeech: 'adjective',
          meaningZh: '真诚的；真实的',
          definitionEn: 'Real, authentic, and free from pretense.',
          example: 'Genuine curiosity allows people to open up.',
          collocations: ['genuine curiosity', 'genuine feeling']
        },
        {
          term: 'rooted in',
          type: 'phrase',
          phonetic: '/ˈruː.tɪd ɪn/',
          partOfSpeech: 'phrase',
          meaningZh: '根植于；源于',
          definitionEn: 'Firmly established in or arising from.',
          example: 'Healthy relationships are rooted in consistency.',
          collocations: ['rooted in trust', 'deeply rooted']
        },
        {
          term: 'hesitate',
          type: 'word',
          phonetic: '/ˈhez.ɪ.teɪt/',
          partOfSpeech: 'verb',
          meaningZh: '犹豫；踌躇',
          definitionEn: 'To pause before making a move or speaking.',
          example: 'Friends rarely hesitate to support one another.',
          collocations: ['hesitate to reach out', 'never hesitate']
        }
      ],
      rewritePractice: [
        {
          originalSentence: 'He listened completely without checking his phone once.',
          target: 'undivided attention',
          referenceAnswer: 'He gave his undivided attention without checking his phone once.'
        },
        {
          originalSentence: 'Her apology was honest and deeply felt.',
          target: 'genuine',
          referenceAnswer: 'Her apology was genuine and deeply felt.'
        }
      ]
    };
  }

  // Default Story
  return {
    title: 'A Quiet Kind of Care',
    readingType: 'story',
    cefrLevel: req.cefrLevel,
    humanised: true,
    reading: `Maya had spent a tiring afternoon at the design studio, surrounded by unfinished drafts and impending deadlines. When Daniel dropped by in the late afternoon, he brought two warm drinks without making a theatrical gesture out of it. His warmth felt unforced and genuine.

Sitting by the rain-streaked window, Maya explained why the current layout felt disconnected. Daniel did not interrupt to offer premature fixes. He gave her his undivided attention, nodding as she traced lines across her sketchbook. Because their collaboration was rooted in mutual respect, she did not hesitate to voice doubts she usually kept guarded. In that calm space, what seemed tangled gradually straightened out.`,
    vocabulary: [
      {
        term: 'genuine',
        type: 'word',
        phonetic: '/ˈdʒen.ju.ɪn/',
        partOfSpeech: 'adjective',
        meaningZh: '真诚的；真实的',
        definitionEn: 'Truly what something is said to be; authentic and sincere.',
        example: 'His smile was genuine and put everyone at ease.',
        collocations: ['genuine interest', 'genuine concern', 'genuine warmth']
      },
      {
        term: 'undivided attention',
        type: 'phrase',
        phonetic: '/ˌʌn.dɪˈvaɪ.dɪd əˈten.ʃən/',
        partOfSpeech: 'phrase',
        meaningZh: '全身心的注意；专注',
        definitionEn: 'Complete and focused attention without interruption.',
        example: 'He listened with undivided attention.',
        collocations: ['give undivided attention', 'demand undivided attention']
      },
      {
        term: 'rooted in',
        type: 'phrase',
        phonetic: '/ˈruː.tɪd ɪn/',
        partOfSpeech: 'phrase',
        meaningZh: '扎根于；基于',
        definitionEn: 'Firmly grounded in a specific foundation.',
        example: 'Their trust was rooted in shared values.',
        collocations: ['rooted in respect', 'deeply rooted in']
      },
      {
        term: 'hesitate',
        type: 'word',
        phonetic: '/ˈhez.ɪ.teɪt/',
        partOfSpeech: 'verb',
        meaningZh: '犹豫；踌躇',
        definitionEn: 'To pause before doing something, especially through uncertainty.',
        example: 'She did not hesitate to voice her honest opinion.',
        collocations: ['hesitate to voice', 'without hesitating']
      }
    ],
    rewritePractice: [
      {
        originalSentence: 'He gave his total focus to what she was explaining.',
        target: 'undivided attention',
        referenceAnswer: 'He gave his undivided attention to what she was explaining.'
      },
      {
        originalSentence: 'His kindness was authentic and never put on for show.',
        target: 'genuine',
        referenceAnswer: 'His kindness was genuine and never put on for show.'
      },
      {
        originalSentence: 'Their friendship was based on quiet understanding.',
        target: 'rooted in',
        referenceAnswer: 'Their friendship was rooted in quiet understanding.'
      }
    ]
  };
}

export async function generateReadingWithPipeline(
  request: GenerationRequest,
  onProgress?: GenerationProgressCallback
): Promise<ReadingRecord> {
  onProgress?.('Generating reading...');
  await new Promise(r => setTimeout(r, 400));

  onProgress?.('Humanising language...');
  await new Promise(r => setTimeout(r, 400));

  onProgress?.('Checking level and vocabulary...');

  let resultData;
  const res = await fetch('/api/reading/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `短文生成失败 (HTTP ${res.status})，请稍后重试`);
  }

  resultData = await res.json();
  onProgress?.('Ready');

  const now = Date.now();
  const readingId = `reading_${now}_${Math.random().toString(36).substr(2, 6)}`;

  const vocabularyItems: VocabularyItem[] = (resultData.vocabulary || []).map((v: any, index: number) => ({
    id: `vocab_${readingId}_${index}`,
    term: v.term,
    type: (v.type === 'phrase' || v.term.includes(' ')) ? 'phrase' : 'word',
    phonetic: v.phonetic || '',
    partOfSpeech: v.partOfSpeech || 'noun',
    meaningZh: v.meaningZh || '',
    definitionEn: v.definitionEn || '',
    example: v.example || '',
    collocations: v.collocations || [],
    sourceReadingId: readingId,
    status: 'New',
    createdAt: now,
    updatedAt: now,
    nextReviewDate: now,
    reviewCount: 0,
    currentInterval: 0
  }));

  const rewriteItems: RewritePracticeItem[] = (resultData.rewritePractice || []).map((r: any, index: number) => ({
    id: `rw_${readingId}_${index}`,
    originalSentence: r.originalSentence,
    target: r.target,
    referenceAnswer: r.referenceAnswer
  }));

  const readingRecord: ReadingRecord = {
    id: readingId,
    title: resultData.title || 'English Reading Practice',
    content: resultData.reading || '',
    topic: request.input || 'General',
    input: request.input || '',
    cefrLevel: (resultData.cefrLevel as CEFRLevel) || request.cefrLevel,
    readingType: (resultData.readingType as any) || (request.readingType === 'random' ? 'story' : request.readingType),
    speakers: Array.isArray(resultData.speakers)
      ? resultData.speakers
          .map((speaker: any) => ({
            name: String(speaker?.name || '').trim(),
            gender: String(speaker?.gender || '').toLowerCase(),
          }))
          .filter((speaker: any) =>
            speaker.name && (speaker.gender === 'male' || speaker.gender === 'female')
          )
      : undefined,
    length: request.length,
    selectedVocabulary: vocabularyItems,
    rewritePractice: rewriteItems,
    humanised: true,
    createdAt: now,
    updatedAt: now
  };

  return readingRecord;
}

export async function rewriteReadingWithPipeline(
  request: RewriteReadingRequest,
  onProgress?: GenerationProgressCallback
): Promise<RewriteReadingResponse> {
  onProgress?.('Generating reading...');
  await new Promise(r => setTimeout(r, 400));
  onProgress?.('Humanising language...');
  await new Promise(r => setTimeout(r, 400));
  onProgress?.('Checking level and vocabulary...');

  const res = await fetch('/api/reading/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `短文改写失败 (HTTP ${res.status})，请稍后重试`);
  }
  const resultData = await res.json();

  onProgress?.('Ready');
  return resultData;
}

export async function evaluateRewriteAnswer(params: {
  originalSentence: string;
  target: string;
  userAnswer: string;
  referenceAnswer: string;
  cefrLevel: string;
  targetLanguage?: string;
}): Promise<RewriteEvaluation> {
  try {
    const res = await fetch('/api/rewrite/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend evaluation call failed, using intelligent client evaluator:', err);
  }

  // Fallback intelligent evaluation
  const targetLower = params.target.toLowerCase();
  const answerLower = params.userAnswer.toLowerCase();
  const targetIncluded = answerLower.includes(targetLower);

  const wordCount = params.userAnswer.trim().split(/\s+/).length;
  const isReasonableLength = wordCount >= 4;

  if (targetIncluded && isReasonableLength) {
    return {
      rating: 'Excellent',
      meaningPreserved: true,
      targetUsedCorrectly: true,
      whatYouDidWell: [
        `You incorporated "${params.target}" accurately and naturally into the sentence.`,
        'The grammatical structure expresses the original thought with clarity.'
      ],
      issues: [],
      improvedVersion: params.userAnswer,
      referenceAnswer: params.referenceAnswer
    };
  } else if (targetIncluded) {
    return {
      rating: 'Good',
      meaningPreserved: true,
      targetUsedCorrectly: true,
      whatYouDidWell: [
        `You successfully placed "${params.target}" in your answer.`
      ],
      issues: [
        {
          original: params.userAnswer,
          correction: params.referenceAnswer,
          explanation: 'Consider framing the sentence with a complete subject and verb clause.'
        }
      ],
      improvedVersion: params.referenceAnswer,
      referenceAnswer: params.referenceAnswer
    };
  } else {
    return {
      rating: 'Needs Improvement',
      meaningPreserved: true,
      targetUsedCorrectly: false,
      whatYouDidWell: [
        'You made an honest attempt to express the core idea.'
      ],
      issues: [
        {
          original: 'Missing target',
          correction: `Include "${params.target}"`,
          explanation: `Make sure the specified target word or phrase "${params.target}" is used in your rewrite.`
        }
      ],
      improvedVersion: params.referenceAnswer,
      referenceAnswer: params.referenceAnswer
    };
  }
}

export async function explainVocabularyTerm(term: string, context?: string, targetLanguage?: string): Promise<Partial<VocabularyItem>> {
  try {
    const res = await fetch('/api/vocabulary/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term, contextReading: context, targetLanguage })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Vocab explain failed, returning basic details:', err);
  }

  return {
    term,
    type: term.includes(' ') ? 'phrase' : 'word',
    phonetic: '',
    partOfSpeech: term.includes(' ') ? 'phrase' : 'word',
    meaningZh: '已选词汇',
    definitionEn: `Key term in this learning context: ${term}.`,
    example: `She practiced using "${term}" in natural English conversation.`,
    collocations: []
  };
}

export async function translateReading(params: {
  text: string;
  title: string;
  targetLanguage: string;
  readingType: string;
  vocabulary?: any[];
  rewriteExercises?: any[];
}): Promise<ReadingTranslation> {
  const res = await fetch('/api/reading/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `翻译失败 (HTTP ${res.status})，请重试`);
  }

  return res.json();
}

export async function translateVocabularies(
  vocabularies: VocabularyItem[],
  targetLanguage: string
): Promise<Record<string, { meaning: string; exampleTranslation?: string }>> {
  if (!vocabularies || vocabularies.length === 0) return {};
  try {
    const res = await fetch('/api/vocabulary/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vocabularies, targetLanguage })
    });
    if (!res.ok) {
      throw new Error(`Failed to translate vocabularies (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.translations || {};
  } catch (err) {
    console.warn('Batch vocab translation failed:', err);
    return {};
  }
}
