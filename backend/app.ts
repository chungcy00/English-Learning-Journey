import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();

app.use(express.json({ limit: '10mb' }));

let ai: GoogleGenAI | null = null;

// Initialize Gemini lazily so a missing Vercel secret produces a clear JSON
// response instead of falling back to unavailable Google Cloud credentials.
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Vercel 尚未配置 GEMINI_API_KEY，请添加环境变量后重新部署');
  }

  if (!ai) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  return ai;
}

interface GenerateWithRetryOptions {
  contents: any;
  config?: any;
  preferredModel?: string;
  operationName?: string;
}

/**
 * Available high-performance Gemini models in priority order.
 * Tested active with available quota and high-quality structured output.
 */
const ROBUST_MODEL_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite'
];

/**
 * Robust Gemini model invoker with quota switching and automatic model fallback.
 * Solves 503 UNAVAILABLE / high demand spikes and 429 rate limit / quota exhaustion.
 */
async function callGeminiWithFallback(options: GenerateWithRetryOptions) {
  const primaryModel = options.preferredModel || 'gemini-3.1-flash-lite';
  // Ensure the preferred model is first, followed by the rest of the working candidates
  const modelChain = [
    primaryModel,
    ...ROBUST_MODEL_CHAIN.filter((m) => m !== primaryModel)
  ];

  let lastError: any = null;

  for (let mIdx = 0; mIdx < modelChain.length; mIdx++) {
    const currentModel = modelChain[mIdx];
    const maxRetries = 1; // 1 retry for transient glitches before switching models

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await getGeminiClient().models.generateContent({
          model: currentModel,
          contents: options.contents,
          config: options.config,
        });

        if (response && response.text) {
          if (mIdx > 0 || attempt > 0) {
            console.log(`[Gemini API] Successfully generated with ${currentModel} (fallback step ${mIdx + 1}) for ${options.operationName || 'request'}`);
          }
          return response;
        }
        throw new Error(`Empty response text returned from ${currentModel}`);
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const status = err?.status || err?.code || '';

        const isQuotaExhausted =
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('Quota exceeded') ||
          msg.includes('exceeded your current quota') ||
          msg.includes('is no longer available') ||
          msg.includes('404') ||
          status === 404;

        const isDemandSpike =
          msg.includes('503') ||
          msg.includes('high demand') ||
          msg.includes('UNAVAILABLE') ||
          status === 503 ||
          status === 'UNAVAILABLE';

        console.log(`[Gemini API] ${options.operationName || 'Call'} with model ${currentModel} encountered: ${msg.slice(0, 160)}`);

        // If quota is exhausted on this model, do not wait - switch immediately to next model
        if (isQuotaExhausted) {
          console.log(`[Gemini API] Quota exhausted on ${currentModel}, switching immediately to next fallback model...`);
          break;
        }

        // If demand spike, do one fast retry with brief backoff, then switch to next model
        if (isDemandSpike && attempt < maxRetries) {
          const delay = 600 + Math.floor(Math.random() * 400);
          console.log(`[Gemini API] Temporary demand spike on ${currentModel}. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Any other non-recoverable error or retries exhausted, try next model
        break;
      }
    }
  }

  throw lastError || new Error('All model attempts failed');
}

/**
 * Safely parse JSON from Gemini response, stripping markdown codeblocks if present.
 */
function safeParseJson<T = any>(rawText: string | undefined): T {
  if (!rawText) {
    throw new Error('Received empty text from Gemini');
  }
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned.trim());
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const DIALOGUE_FEMALE_NAMES = ['Anna', 'Sarah', 'Emma', 'Maya'] as const;
const DIALOGUE_MALE_NAMES = ['Tom', 'Mark', 'Daniel', 'Leo'] as const;
const DIALOGUE_NAME_GENDER = new Map<string, 'female' | 'male'>([
  ...DIALOGUE_FEMALE_NAMES.map(name => [name.toLowerCase(), 'female'] as const),
  ...DIALOGUE_MALE_NAMES.map(name => [name.toLowerCase(), 'male'] as const),
]);

export function enforceDialogueCast<T extends Record<string, any>>(
  result: T,
  forceDialogue = false
): T {
  const isDialogue = forceDialogue || String(result.readingType || '').toLowerCase() === 'dialogue';
  if (!isDialogue || typeof result.reading !== 'string') return result;

  const uniqueSpeakers = [...new Set(extractDialogueSpeakerSequence(result.reading))];
  if (uniqueSpeakers.length === 0) return result;

  const suppliedProfiles = Array.isArray(result.speakers) ? result.speakers : [];
  const suppliedGender = new Map<string, 'female' | 'male'>();
  suppliedProfiles.forEach((profile: any) => {
    const name = String(profile?.name || '').trim().toLowerCase();
    const gender = String(profile?.gender || '').trim().toLowerCase();
    if (name && (gender === 'female' || gender === 'male')) {
      suppliedGender.set(name, gender);
    }
  });

  const genders = uniqueSpeakers.map((speaker, index) =>
    DIALOGUE_NAME_GENDER.get(speaker.toLowerCase()) ||
    suppliedGender.get(speaker.toLowerCase()) ||
    (index % 2 === 0 ? 'female' : 'male')
  );

  // Generated dialogue uses one female and one male role. If the model returns
  // duplicate gender metadata, correct the second role deterministically.
  if (uniqueSpeakers.length === 2 && genders[0] === genders[1]) {
    genders[1] = genders[0] === 'female' ? 'male' : 'female';
  }

  const usedNames = new Set<string>();
  let femaleIndex = 0;
  let maleIndex = 0;
  const renamedProfiles = uniqueSpeakers.map((speaker, index) => {
    const gender = genders[index];
    const allowedNames = gender === 'female' ? DIALOGUE_FEMALE_NAMES : DIALOGUE_MALE_NAMES;
    const currentName = allowedNames.find(name => name.toLowerCase() === speaker.toLowerCase());
    let name = currentName;

    if (!name || usedNames.has(name.toLowerCase())) {
      const startIndex = gender === 'female' ? femaleIndex : maleIndex;
      name = allowedNames.find((candidate, offset) =>
        offset >= startIndex && !usedNames.has(candidate.toLowerCase())
      ) || allowedNames.find(candidate => !usedNames.has(candidate.toLowerCase())) || allowedNames[0];
    }

    usedNames.add(name.toLowerCase());
    if (gender === 'female') femaleIndex = Math.min(femaleIndex + 1, DIALOGUE_FEMALE_NAMES.length - 1);
    else maleIndex = Math.min(maleIndex + 1, DIALOGUE_MALE_NAMES.length - 1);
    return { originalName: speaker, name, gender };
  });

  let reading = result.reading;
  renamedProfiles.forEach(({ originalName, name }) => {
    const escapedOriginal = escapeRegex(originalName);
    reading = reading.replace(
      new RegExp(`(^\\s*)${escapedOriginal}(\\s*:)`, 'gmi'),
      (_match: string, boundary: string, colon: string) => `${boundary}${name}${colon}`
    );
    if (originalName !== name) {
      // Replace capitalised direct address/name mentions without changing an
      // ordinary lowercase word such as the verb "mark".
      reading = reading.replace(new RegExp(`\\b${escapedOriginal}\\b`, 'g'), name);
    }
  });

  return {
    ...result,
    readingType: 'dialogue',
    reading,
    speakers: renamedProfiles.map(({ name, gender }) => ({ name, gender })),
  };
}

function extractDialogueSpeakerSequence(text: string): string[] {
  const speakerPattern = '[A-Z][A-Za-z0-9_-]*(?:\\s+[A-Z][A-Za-z0-9_-]*){0,2}';
  const lineRegex = new RegExp(`^\\s*(${speakerPattern})\\s*[:：]`, 'gm');
  const speakers: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = lineRegex.exec(text)) !== null) {
    const speaker = match[1].trim();
    if (!['note', 'step', 'tip', 'warning'].includes(speaker.toLowerCase())) {
      speakers.push(speaker);
    }
  }

  return speakers;
}

function normalizeDialogueTranslation(translatedText: string, speakerSequence: string[]): string {
  let normalized = translatedText
    .replace(/\r\n?/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();

  const uniqueSpeakers = [...new Set(speakerSequence)].filter(Boolean);
  if (uniqueSpeakers.length === 0 || !normalized) return normalized;

  const speakerPattern = uniqueSpeakers
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  const markerRegex = new RegExp(
    `(^|[\\s。！？!?；;”"'）)])(${speakerPattern})\\s*[:：]\\s*`,
    'gmi'
  );

  normalized = normalized.replace(markerRegex, (_match, boundary: string, speaker: string) => {
    const punctuation = boundary && !/\\s/.test(boundary) ? boundary : '';
    return `${punctuation}\n\n${speaker}: `;
  });
  normalized = normalized.replace(/^\s+/, '').replace(/\n{3,}/g, '\n\n').trim();

  // Gemini occasionally drops the first label but keeps all following labels.
  // Restore it so the client can render the first turn like the source dialogue.
  const startsWithSpeaker = new RegExp(`^(?:${speakerPattern})\\s*[:：]`, 'i').test(normalized);
  if (!startsWithSpeaker && speakerSequence[0]) {
    normalized = `${speakerSequence[0]}: ${normalized}`;
  }

  return normalized;
}

const DIALOGUE_TTS_MODEL = 'gemini-3.1-flash-tts-preview';

const DIALOGUE_TTS_VOICES: Record<'female' | 'male', string> = {
  // These are fixed, documented voice genders.
  female: 'Kore',
  male: 'Orus',
};

interface DialogueTtsTurn {
  text: string;
  gender: 'female' | 'male';
}

export function wrapPcmAsWav(pcm: Buffer, sampleRate = 24000): Buffer {
  // Gemini GenerateContent TTS returns mono, signed 16-bit little-endian PCM.
  // Browsers need the small RIFF/WAVE header in order to play it reliably.
  if (pcm.length >= 12 && pcm.toString('ascii', 0, 4) === 'RIFF') return pcm;

  const header = Buffer.alloc(44);
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * bytesPerSample, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function buildDialogueTtsPrompt(turns: DialogueTtsTurn[]): string {
  const transcript = turns
    .map(turn => `${turn.gender === 'female' ? 'Female' : 'Male'}: ${turn.text}`)
    .join('\n\n');

  return `Synthesize the complete English conversation after <TRANSCRIPT>.

Audio profiles:
- Female is an adult woman with a clearly feminine, warm, natural voice.
- Male is an adult man with a clearly masculine, warm, natural voice.

Director's notes: Keep the assigned voice for each speaker throughout the whole conversation. Speak conversationally with natural emotion and intonation at a relaxed, slightly slow learning pace. Add a brief natural pause whenever the speaker changes. Do not sound like an announcement or a robot. Preserve every spoken word exactly. Do not speak the labels "Female" and "Male", these instructions, or the XML tags.

<TRANSCRIPT>
${transcript}
</TRANSCRIPT>`;
}

async function generateDialogueAudio(turns: DialogueTtsTurn[]) {
  const hasFemale = turns.some(turn => turn.gender === 'female');
  const hasMale = turns.some(turn => turn.gender === 'male');
  const speakerConfig = hasFemale && hasMale
    ? [
        { speaker: 'Female', voice: DIALOGUE_TTS_VOICES.female },
        { speaker: 'Male', voice: DIALOGUE_TTS_VOICES.male },
      ]
    : [{ voice: hasMale ? DIALOGUE_TTS_VOICES.male : DIALOGUE_TTS_VOICES.female }];

  const interaction = await getGeminiClient().interactions.create({
    model: DIALOGUE_TTS_MODEL,
    input: buildDialogueTtsPrompt(turns),
    response_format: {
      type: 'audio',
      mime_type: 'audio/mp3',
      bit_rate: 64000,
      delivery: 'inline',
    },
    generation_config: {
      speech_config: speakerConfig,
    },
  });

  const audioData = interaction.output_audio?.data;
  if (!audioData) throw new Error('TTS_EMPTY_AUDIO');

  return {
    buffer: Buffer.from(audioData, 'base64'),
    mimeType: interaction.output_audio?.mime_type || 'audio/mp3',
  };
}

function isDialogueTtsQuotaError(error: any): boolean {
  const message = String(error?.message || error || '');
  return error?.status === 429 || error?.code === 429 ||
    message.includes('429') || message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('Quota exceeded');
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: !!process.env.GEMINI_API_KEY?.trim() });
});

// Generate the whole dialogue in one request. This keeps fixed male/female
// voices without consuming the free TTS quota once for every sentence.
app.post('/api/speech/dialogue', async (req, res) => {
  try {
    const rawTurns = Array.isArray(req.body?.turns) ? req.body.turns : [];
    const turns: DialogueTtsTurn[] = rawTurns
      .map((turn: any) => ({
        text: String(turn?.text || '').replace(/\s+/g, ' ').trim(),
        gender: String(turn?.gender || '').toLowerCase(),
      }))
      .filter((turn: any) => turn.text && (turn.gender === 'female' || turn.gender === 'male'));

    if (turns.length === 0) {
      return res.status(400).json({ error: '对话内容不能为空' });
    }
    if (turns.length > 80 || turns.some(turn => turn.text.length > 1800)) {
      return res.status(400).json({ error: '对话内容过长，请缩短后重试' });
    }
    const totalLength = turns.reduce((sum, turn) => sum + turn.text.length, 0);
    if (totalLength > 7000) {
      return res.status(400).json({ error: '对话内容过长，请缩短后重试' });
    }

    const audio = await generateDialogueAudio(turns);
    const genders = [...new Set(turns.map(turn => turn.gender))].join(',');

    res.setHeader('Content-Type', audio.mimeType);
    res.setHeader('Content-Length', String(audio.buffer.length));
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Dialogue-Genders', genders);
    res.setHeader('X-Dialogue-Voices', `${DIALOGUE_TTS_VOICES.female},${DIALOGUE_TTS_VOICES.male}`);
    res.setHeader('X-Dialogue-TTS-Model', DIALOGUE_TTS_MODEL);
    return res.status(200).send(audio.buffer);
  } catch (error: any) {
    console.error('Dialogue TTS error:', error);
    if (isDialogueTtsQuotaError(error)) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({
        code: 'TTS_RATE_LIMIT',
        error: '角色语音服务暂时繁忙，请约一分钟后重试。',
      });
    }
    if (String(error?.message || '').includes('GEMINI_API_KEY')) {
      return res.status(503).json({
        code: 'TTS_NOT_CONFIGURED',
        error: '角色语音服务尚未配置，请联系网站管理员。',
      });
    }
    return res.status(500).json({
      code: 'TTS_GENERATION_FAILED',
      error: '角色语音暂时无法生成，请稍后重试。',
    });
  }
});

// 1. Reading Generation Pipeline with Automatic Humanise & Structured Output
app.post('/api/reading/generate', async (req, res) => {
  try {
    const { input, cefrLevel = 'B1', readingType = 'story', length = 'medium', vocabularyCount = 8, specifiedVocabulary = [], targetLanguage = 'zh-CN' } = req.body;

    if (!input && (!specifiedVocabulary || specifiedVocabulary.length === 0)) {
      return res.status(400).json({ error: 'Input or vocabulary is required' });
    }

    const languageNames: Record<string, string> = {
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'es': 'Spanish (Español)',
      'ja': 'Japanese (日本語)',
      'ko': 'Korean (한국어)',
      'fr': 'French (Français)',
      'de': 'German (Deutsch)',
      'vi': 'Vietnamese (Tiếng Việt)',
      'ru': 'Russian (Русский)',
    };
    const targetLangName = languageNames[targetLanguage] || targetLanguage;

    const wordCountGuide = {
      short: '80-120 words',
      medium: '150-200 words',
      long: '250-350 words'
    }[length as 'short' | 'medium' | 'long'] || '150-200 words';

    const chosenType = readingType === 'random' ? (['story', 'non-story', 'dialogue'][Math.floor(Math.random() * 3)]) : readingType;

    const typeGuidance = {
      story: 'Must be a narrative story with characters, relatable situation, emotional development, natural pacing. Avoid cliche fables.',
      'non-story': 'Must be an expository, opinion, lifestyle, or practical reflection article (daily life, relationships, workplace, social skills). Do NOT turn it into a character story.',
      dialogue: `CRITICAL: Must be formatted strictly line-by-line as a realistic spoken dialogue script. Use exactly two speakers: one female chosen only from ${DIALOGUE_FEMALE_NAMES.join(', ')}, and one male chosen only from ${DIALOGUE_MALE_NAMES.join(', ')}. Every turn MUST start with that exact character name followed by a colon and be separated by newlines. Do NOT use gender-neutral names, do NOT introduce additional speakers, and do NOT turn the dialogue into a narrative paragraph. Return the exact two names in the speakers array with female or male gender.`
    }[chosenType] || 'Natural narrative';

    const systemInstruction = `You are a master English educator and editor.
Follow this internal multi-stage pipeline strictly:
Step 1: Understand the user's topic, word, phrase, or prompt (which might be in Chinese or English).
Step 2: Generate an initial draft matching the target CEFR level (${cefrLevel}), type (${chosenType}), and length (${wordCountGuide}).
Step 3: AUTOMATIC HUMANISE (Mandatory):
  - Eliminate generic AI clichés like "In today's world...", "It is important to remember...", "Furthermore...", "Moreover...", "In conclusion...", "This highlights...".
  - Ensure natural sentence rhythm with dynamic sentence lengths (short punchy sentences mixed with balanced complex clauses).
  - Avoid repetitive subject-verb openers (e.g. He was... He felt... He thought...).
  - Ensure seamless thematic transitions instead of forced connector words.
  - If target vocabulary is specified (${specifiedVocabulary.length > 0 ? specifiedVocabulary.join(', ') : 'none specified'}), ensure every specified term is naturally woven into the context without feeling forced.
  - Strictly preserve the CEFR level (${cefrLevel}): do not unnecessarily elevate difficulty.
Step 4: Select exactly ${vocabularyCount} high-value vocabulary items (words or practical phrases/collocations) from the final reading. Include all user-specified terms if applicable.
Step 5: For each selected vocabulary, provide pronunciation (IPA), part of speech, accurate ${targetLangName} meaning (assigned to meaningZh), simple clear English definition, a natural example sentence, and 2-4 common collocations.
Step 6: Create 3 to 4 "Rewrite the Sentence" exercises. Each exercise gives an original sentence expressing a thought, and a target vocabulary/phrase from the reading, with an authentic reference answer that naturally uses the target.`;

    const prompt = `Topic / Input: "${input || specifiedVocabulary.join(', ')}"
Specified Vocabulary (MUST include naturally if provided): ${specifiedVocabulary.join(', ') || 'None'}
Target CEFR Level: ${cefrLevel}
Target Reading Type: ${chosenType}
Length target: ${wordCountGuide}
Type instructions: ${typeGuidance}

Please generate the complete structured JSON response adhering strictly to the schema.`;

    const response = await callGeminiWithFallback({
      preferredModel: 'gemini-3.1-flash-lite',
      contents: prompt,
      operationName: 'Reading Generation',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Editorial title for the reading' },
            readingType: { type: Type.STRING, description: 'The chosen reading type: story, non-story, or dialogue' },
            cefrLevel: { type: Type.STRING, description: 'The verified CEFR level' },
            humanised: { type: Type.BOOLEAN, description: 'Always true as the text has undergone the humanise pipeline' },
            reading: { type: Type.STRING, description: 'The full humanised text' },
            speakers: {
              type: Type.ARRAY,
              description: 'For dialogue only: each unique speaker and voice gender. Return an empty array for other reading types.',
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Speaker name exactly as written before the colon' },
                  gender: { type: Type.STRING, description: 'male or female' }
                },
                required: ['name', 'gender']
              }
            },
            vocabulary: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  type: { type: Type.STRING, description: 'word or phrase' },
                  phonetic: { type: Type.STRING, description: 'IPA phonetic notation' },
                  partOfSpeech: { type: Type.STRING },
                  meaningZh: { type: Type.STRING, description: `Accurate natural ${targetLangName} translation` },
                  definitionEn: { type: Type.STRING, description: 'Simple, direct English definition' },
                  example: { type: Type.STRING, description: 'Clear illustrative example sentence' },
                  collocations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ['term', 'type', 'phonetic', 'partOfSpeech', 'meaningZh', 'definitionEn', 'example', 'collocations']
              }
            },
            rewritePractice: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  originalSentence: { type: Type.STRING, description: 'Sentence expressing the idea without the target idiom/word' },
                  target: { type: Type.STRING, description: 'The target vocabulary or phrase to use' },
                  referenceAnswer: { type: Type.STRING, description: 'Natural reference rewrite answer' }
                },
                required: ['originalSentence', 'target', 'referenceAnswer']
              }
            }
          },
          required: ['title', 'readingType', 'cefrLevel', 'humanised', 'reading', 'vocabulary', 'rewritePractice']
        }
      }
    });

    const parsed = safeParseJson(response.text);
    return res.json(enforceDialogueCast(parsed, chosenType === 'dialogue'));
  } catch (error: any) {
    console.error('Reading generation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate reading' });
  }
});

// 2. Rewrite Reading (Easier, Harder, Shorter, Longer, More Conversational, etc.)
app.post('/api/reading/rewrite', async (req, res) => {
  try {
    const { reading, currentVocabulary = [], mode, keepCurrentVocabulary = true, cefrLevel = 'B1' } = req.body;

    const modeInstructions: Record<string, string> = {
      easier: 'Simplify vocabulary and syntactic complexity by roughly one CEFR half-step, keeping prose natural.',
      harder: 'Enrich nuance, varied clause structures, and sophisticated idiomatic flow.',
      shorter: 'Condense into a tighter, more compact version while preserving key narrative/thematic beats.',
      longer: 'Expand with vivid situational detail, sensory observation, or realistic context.',
      moreConversational: 'Inject natural colloquial cadences, spoken rhythms, and authentic interpersonal warmth.',
      story: 'Convert the content into a narrative story format with real human characters.',
      'non-story': 'Convert into an insightful reflective/expository non-story essay.',
      dialogue: `Convert into a realistic spoken dialogue with exactly two speakers: one female chosen only from ${DIALOGUE_FEMALE_NAMES.join(', ')}, and one male chosen only from ${DIALOGUE_MALE_NAMES.join(', ')}. Put every turn on its own line using the exact character name followed by a colon. Do not use gender-neutral names or additional speakers.`
    };

    const instruction = modeInstructions[mode] || 'Rewrite with enhanced natural rhythm and style.';

    const systemInstruction = `You are a master English editor.
Rewrite the given reading based on the requested modification: "${instruction}".
${keepCurrentVocabulary ? `IMPORTANT: You MUST naturally retain these key target vocabulary words/phrases: ${currentVocabulary.join(', ')}.` : ''}
Execute the Automatic Humanise pipeline: eliminate robotic transitions, enhance sentence rhythm, and preserve authentic context.
If the resulting reading is a dialogue, use exactly one female name from ${DIALOGUE_FEMALE_NAMES.join(', ')} and one male name from ${DIALOGUE_MALE_NAMES.join(', ')}, and return both in the speakers array with their fixed gender.
Output the complete structured JSON response matching the schema.`;

    const prompt = `Current Reading:
${reading}

Target Modification: ${mode} (${instruction})
Keep Target Vocabulary: ${keepCurrentVocabulary ? currentVocabulary.join(', ') : 'Optional'}
CEFR Level: ${cefrLevel}

Generate the updated reading, updated vocabulary details, and refreshed rewrite sentence practice.`;

    const response = await callGeminiWithFallback({
      preferredModel: 'gemini-3.1-flash-lite',
      contents: prompt,
      operationName: 'Reading Rewrite',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            readingType: { type: Type.STRING },
            cefrLevel: { type: Type.STRING },
            humanised: { type: Type.BOOLEAN },
            reading: { type: Type.STRING },
            speakers: {
              type: Type.ARRAY,
              description: 'For dialogue only: unique speakers with male or female voice gender; otherwise an empty array.',
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  gender: { type: Type.STRING, description: 'male or female' }
                },
                required: ['name', 'gender']
              }
            },
            vocabulary: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  type: { type: Type.STRING },
                  phonetic: { type: Type.STRING },
                  partOfSpeech: { type: Type.STRING },
                  meaningZh: { type: Type.STRING },
                  definitionEn: { type: Type.STRING },
                  example: { type: Type.STRING },
                  collocations: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['term', 'type', 'phonetic', 'partOfSpeech', 'meaningZh', 'definitionEn', 'example', 'collocations']
              }
            },
            rewritePractice: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  originalSentence: { type: Type.STRING },
                  target: { type: Type.STRING },
                  referenceAnswer: { type: Type.STRING }
                },
                required: ['originalSentence', 'target', 'referenceAnswer']
              }
            }
          },
          required: ['title', 'readingType', 'cefrLevel', 'humanised', 'reading', 'vocabulary', 'rewritePractice']
        }
      }
    });

    const parsed = safeParseJson(response.text);
    return res.json(enforceDialogueCast(parsed, mode === 'dialogue'));
  } catch (error: any) {
    console.error('Reading rewrite error:', error);
    return res.status(500).json({ error: error.message || 'Failed to rewrite reading' });
  }
});

// 3. Rewrite Evaluation (PRD Section 23-27)
app.post('/api/rewrite/evaluate', async (req, res) => {
  try {
    const { originalSentence, target, userAnswer, referenceAnswer, cefrLevel = 'B1', targetLanguage = 'zh-CN' } = req.body;

    if (!userAnswer || !userAnswer.trim()) {
      return res.status(400).json({ error: 'User answer is required' });
    }

    const languageNames: Record<string, string> = {
      'zh-CN': 'Simplified Chinese (简体中文)',
      'zh-TW': 'Traditional Chinese (繁體中文)',
      'ja': 'Japanese (日本語)',
      'ko': 'Korean (한국어)',
      'es': 'Spanish (Español)',
      'fr': 'French (Français)',
      'de': 'German (Deutsch)',
      'vi': 'Vietnamese (Tiếng Việt)',
      'ru': 'Russian (Русский)',
    };
    const targetLangName = languageNames[targetLanguage] || targetLanguage;

    const systemInstruction = `You are an expert English teacher evaluating a student's "Rewrite the Sentence" practice.
Evaluation Guidelines (PRD Sections 23-27):
1. Principle of Multiple Correct Answers:
   - The reference answer is just ONE possible good answer, NOT the only correct answer.
   - If the student's answer correctly preserves the meaning, uses the target vocabulary/phrase naturally and accurately, and has correct grammar, award "Excellent" even if the sentence structure differs from the reference!
2. Ratings:
   - "Excellent": Meaning, grammar, target usage, and naturalness are all solid.
   - "Very Good": Natural and correct with only minor polish possibilities.
   - "Good": Core meaning is preserved, but contains minor grammatical slips, preposition errors, or slightly awkward collocations.
   - "Needs Improvement": Noticeable error in vocabulary usage, ungrammatical structure, or distorted meaning.
3. Detailed Feedback Language:
   - Provide "whatYouDidWell" encouraging comments and "issues" explanations in ${targetLangName} so the learner easily understands.
   - whatYouDidWell: 1-2 encouraging bullet points noting what the learner got right.
   - issues: Identify specific mistakes. Provide: original fragment, corrected fragment, and a brief constructive explanation in ${targetLangName}.
   - improvedVersion: A polished, natural revision of the student's own sentence in English.
   - referenceAnswer: The teacher's clean reference model in English.`;

    const prompt = `Original Sentence: "${originalSentence}"
Target Vocabulary/Phrase: "${target}"
Student's Answer: "${userAnswer}"
Reference Answer: "${referenceAnswer}"
Target CEFR: ${cefrLevel}
Learner's Explanation Language: ${targetLangName}

Evaluate the student's answer and output structured JSON.`;

    const response = await callGeminiWithFallback({
      preferredModel: 'gemini-3.1-flash-lite',
      contents: prompt,
      operationName: 'Rewrite Evaluation',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rating: {
              type: Type.STRING,
              description: 'One of: Excellent, Very Good, Good, Needs Improvement'
            },
            meaningPreserved: { type: Type.BOOLEAN },
            targetUsedCorrectly: { type: Type.BOOLEAN },
            whatYouDidWell: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING, description: 'Incorrect phrase or fragment from user answer' },
                  correction: { type: Type.STRING, description: 'Corrected version of that fragment' },
                  explanation: { type: Type.STRING, description: 'Short clear explanation in target language' }
                },
                required: ['original', 'correction', 'explanation']
              }
            },
            improvedVersion: { type: Type.STRING, description: 'Polished natural version of student sentence' },
            referenceAnswer: { type: Type.STRING, description: 'Clean reference sentence' }
          },
          required: ['rating', 'meaningPreserved', 'targetUsedCorrectly', 'whatYouDidWell', 'issues', 'improvedVersion', 'referenceAnswer']
        }
      }
    });

    const parsed = safeParseJson(response.text);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Rewrite evaluation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to evaluate answer' });
  }
});

// 4. Vocabulary Explanation (For newly added custom words/phrases)
app.post('/api/vocabulary/explain', async (req, res) => {
  try {
    const { term, contextReading, targetLanguage = 'zh-CN' } = req.body;
    if (!term) {
      return res.status(400).json({ error: 'Term is required' });
    }

    const systemInstruction = `You are an English lexicographer. Provide accurate, clean dictionary details for the English word or phrase:
Context Reading: ${contextReading || 'General usage'}
Provide IPA pronunciation, part of speech, authentic Chinese definition (or specified language assigned to meaningZh), simple English explanation, a vivid example sentence, and 3-4 common collocations.`;

    const response = await callGeminiWithFallback({
      preferredModel: 'gemini-3.1-flash-lite',
      contents: `Explain English term: "${term}"`,
      operationName: 'Vocabulary Explanation',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING },
            type: { type: Type.STRING, description: 'word or phrase' },
            phonetic: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            meaningZh: { type: Type.STRING },
            definitionEn: { type: Type.STRING },
            example: { type: Type.STRING },
            collocations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['term', 'type', 'phonetic', 'partOfSpeech', 'meaningZh', 'definitionEn', 'example', 'collocations']
        }
      }
    });

    const parsed = safeParseJson(response.text);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Vocabulary explanation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to explain term' });
  }
});

// 5. Humanised Reading Translation & Synchronized Vocabulary/Practice Localizer
app.post('/api/reading/translate', async (req, res) => {
  try {
    const {
      text,
      title,
      targetLanguage = 'zh-CN',
      readingType = 'story',
      vocabulary = [],
      rewriteExercises = []
    } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text to translate is required' });
    }

    const languageNames: Record<string, string> = {
      'zh-CN': 'Simplified Chinese (简体中文)',
      'zh-TW': 'Traditional Chinese (繁體中文)',
      'ja': 'Japanese (日本語)',
      'ko': 'Korean (한국어)',
      'es': 'Spanish (Español)',
      'fr': 'French (Français)',
      'de': 'German (Deutsch)',
      'vi': 'Vietnamese (Tiếng Việt)',
      'ru': 'Russian (Русский)',
    };

    const targetLangName = languageNames[targetLanguage] || targetLanguage;
    const dialogueSpeakerSequence = readingType === 'dialogue'
      ? extractDialogueSpeakerSequence(text)
      : [];
    const dialogueOutputContract = readingType === 'dialogue'
      ? `
STRICT DIALOGUE OUTPUT CONTRACT:
   - translatedContent must remain a dialogue script, never a prose paragraph.
   - Keep every speaker name unchanged and put every turn on its own line in exactly this form: SpeakerName: translated speech
   - Separate consecutive turns with a blank line (two newline characters in the JSON string).
   - Never merge one speaker's words with another speaker's words.
   - Never omit a speaker label, including the very first turn.
   - Original speaker sequence: ${JSON.stringify(dialogueSpeakerSequence)}`
      : '';

    const systemInstruction = `You are a master bilingual literary translator, lexicographer, and native stylistics expert.
Your mission is to provide an exquisitely NATURAL, HUMAN-LIKE ("humanised") translation of an English reading, as well as its accompanying selected vocabulary and rewrite practice exercises, into ${targetLangName}.

CRITICAL GUIDELINES FOR HUMANISATION:
1. Pure Natural Native Idiom (杜绝机翻腔/字面死译):
   - Translate for meaning, resonance, emotional warmth, and authentic cadence, not literal word-by-word substitution.
   - Employ the natural colloquialisms, idiomatic phrasing, and rhythm characteristic of an articulate native speaker of ${targetLangName}.
   - Capture psychological nuance, understated humor, interpersonal tenderness, or workplace subtext.
2. Dialogue Handling (If Dialogue):
   - Every speaker turn MUST be preserved line-by-line: SpeakerName: "..."
   - Translate spoken dialogue into vivid, authentic spoken language that people actually say in daily life.
   - For character names (e.g. Lena, Kai, Marcus), preserve their names or use natural localized names consistently.
3. Vocabulary Translations (Synchronized with ${targetLangName}):
   - For every provided vocabulary item, provide its precise, natural, and idiomatic definition/meaning in ${targetLangName}.
   - Also translate the example sentence naturally into ${targetLangName}.
4. Practice Exercise Translations:
   - For every sentence rewrite exercise, provide a natural translation of the original sentence in ${targetLangName}.
5. Structural Fidelity:
   - Preserve paragraphs and line breaks matching the original source text.
${dialogueOutputContract}`;

    const prompt = `Please translate this entire English learning unit into ${targetLangName}:

Title: "${title || ''}"
Type: ${readingType}

English Reading:
"""
${text}
"""

Selected Vocabulary to Translate:
${JSON.stringify(vocabulary.map((v: any) => ({ id: v.id, term: v.term, definitionEn: v.definitionEn, example: v.example, meaningZh: v.meaningZh })))}

Sentence Rewriting Exercises to Translate:
${JSON.stringify(rewriteExercises.map((e: any) => ({ id: e.id, originalSentence: e.originalSentence, target: e.target })))}

Return JSON with translated title, translatedContent, vocabularyTranslations, and exerciseTranslations.`;

    const response = await callGeminiWithFallback({
      preferredModel: 'gemini-3.1-flash-lite',
      contents: prompt,
      operationName: 'Humanised Translation with Vocab Sync',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Naturally translated title' },
            translatedContent: {
              type: Type.STRING,
              description: 'Exquisitely natural, humanised translated text matching original line breaks or dialogue format'
            },
            vocabularyTranslations: {
              type: Type.ARRAY,
              description: 'Translations for vocabulary items',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  term: { type: Type.STRING },
                  meaning: { type: Type.STRING, description: 'Idiomatic definition/meaning in target language' },
                  exampleTranslation: { type: Type.STRING, description: 'Translation of example sentence in target language' }
                },
                required: ['term', 'meaning']
              }
            },
            exerciseTranslations: {
              type: Type.ARRAY,
              description: 'Translations for exercises',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  originalSentenceMeaning: { type: Type.STRING, description: 'Translation of original sentence in target language' }
                },
                required: ['originalSentenceMeaning']
              }
            }
          },
          required: ['title', 'translatedContent']
        }
      }
    });

    const parsed = safeParseJson(response.text);

    // Build lookup maps for rapid frontend access
    const vocabMap: Record<string, { meaning: string; exampleTranslation?: string }> = {};
    if (Array.isArray(parsed.vocabularyTranslations)) {
      for (const item of parsed.vocabularyTranslations) {
        if (item.id) {
          vocabMap[item.id] = { meaning: item.meaning, exampleTranslation: item.exampleTranslation };
        }
        if (item.term) {
          vocabMap[item.term.toLowerCase()] = { meaning: item.meaning, exampleTranslation: item.exampleTranslation };
        }
      }
    }

    const exerciseMap: Record<string, { originalSentenceMeaning: string }> = {};
    if (Array.isArray(parsed.exerciseTranslations)) {
      for (let i = 0; i < parsed.exerciseTranslations.length; i++) {
        const item = parsed.exerciseTranslations[i];
        if (item.id) {
          exerciseMap[item.id] = { originalSentenceMeaning: item.originalSentenceMeaning };
        }
        exerciseMap[String(i)] = { originalSentenceMeaning: item.originalSentenceMeaning };
      }
    }

    return res.json({
      title: parsed.title || title,
      translatedContent: readingType === 'dialogue'
        ? normalizeDialogueTranslation(parsed.translatedContent || '', dialogueSpeakerSequence)
        : parsed.translatedContent || '',
      language: targetLanguage,
      languageName: targetLangName,
      humanised: true,
      vocabularyTranslations: vocabMap,
      exerciseTranslations: exerciseMap,
      updatedAt: Date.now()
    });
  } catch (error: any) {
    console.error('Translation error:', error);
    return res.status(500).json({ error: error.message || 'Translation failed' });
  }
});

// 6. Batch Vocabulary Translation for Wordbook & Review Learning
app.post('/api/vocabulary/translate', async (req, res) => {
  try {
    const { vocabularies = [], targetLanguage = 'zh-CN' } = req.body;
    if (!Array.isArray(vocabularies) || vocabularies.length === 0) {
      return res.json({ translations: {} });
    }

    const languageNames: Record<string, string> = {
      'zh-CN': 'Simplified Chinese (简体中文)',
      'zh-TW': 'Traditional Chinese (繁體中文)',
      'ja': 'Japanese (日本語)',
      'ko': 'Korean (한국어)',
      'es': 'Spanish (Español)',
      'fr': 'French (Français)',
      'de': 'Deutsch (German)',
      'vi': 'Vietnamese (Tiếng Việt)',
      'ru': 'Russian (Русский)',
    };
    const targetLangName = languageNames[targetLanguage] || targetLanguage;

    const systemInstruction = `You are a master bilingual lexicographer and language learning specialist.
Translate each English vocabulary item's meaning and example sentence into natural, idiomatic, and accurate ${targetLangName}.
Avoid robotic or literal translations; provide the most contextually fitting native equivalent for an ESL learner.`;

    const prompt = `Translate the following English vocabulary items into ${targetLangName}:
${JSON.stringify(
  vocabularies.map((v: any) => ({
    id: v.id,
    term: v.term,
    partOfSpeech: v.partOfSpeech,
    definitionEn: v.definitionEn,
    meaningZh: v.meaningZh,
    example: v.example
  }))
)}

Return a JSON object containing an array "translations" where each item has "id", "term", "meaning" (the natural definition in ${targetLangName}), and "exampleTranslation" (the natural translation of the example sentence in ${targetLangName}).`;

    const response = await callGeminiWithFallback({
      preferredModel: 'gemini-3.1-flash-lite',
      contents: prompt,
      operationName: 'Batch Vocabulary Translation',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  term: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                  exampleTranslation: { type: Type.STRING }
                },
                required: ['term', 'meaning']
              }
            }
          },
          required: ['translations']
        }
      }
    });

    const parsed = safeParseJson(response.text);
    const resultMap: Record<string, { meaning: string; exampleTranslation?: string }> = {};
    if (Array.isArray(parsed.translations)) {
      for (const item of parsed.translations) {
        if (item.id) {
          resultMap[item.id] = {
            meaning: item.meaning,
            exampleTranslation: item.exampleTranslation || ''
          };
        }
        if (item.term) {
          resultMap[item.term.toLowerCase()] = {
            meaning: item.meaning,
            exampleTranslation: item.exampleTranslation || ''
          };
        }
      }
    }

    return res.json({ translations: resultMap });
  } catch (error: any) {
    console.error('Batch vocabulary translation error:', error);
    return res.status(500).json({ error: error.message || 'Vocabulary translation failed' });
  }
});

export default app;
