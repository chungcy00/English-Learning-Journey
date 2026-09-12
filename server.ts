import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
        const response = await ai.models.generateContent({
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: !!process.env.GEMINI_API_KEY });
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
      dialogue: 'CRITICAL: Must be formatted strictly line-by-line as a realistic spoken dialogue script. Every speaker turn MUST be on its own line separated by newlines, starting with the character name followed by a colon (e.g. Lena: "..." \\n\\n Kai: "..."). Do NOT lump dialogue turns together into a continuous block of text or a narrative paragraph.'
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
    return res.json(parsed);
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
      dialogue: 'Convert into a realistic spoken dialogue formatted strictly line-by-line with speaker turns (e.g. Lena: "..." \\n\\n Kai: "..."). Each turn MUST be on its own line. Do NOT write as a continuous paragraph.'
    };

    const instruction = modeInstructions[mode] || 'Rewrite with enhanced natural rhythm and style.';

    const systemInstruction = `You are a master English editor.
Rewrite the given reading based on the requested modification: "${instruction}".
${keepCurrentVocabulary ? `IMPORTANT: You MUST naturally retain these key target vocabulary words/phrases: ${currentVocabulary.join(', ')}.` : ''}
Execute the Automatic Humanise pipeline: eliminate robotic transitions, enhance sentence rhythm, and preserve authentic context.
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
    return res.json(parsed);
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
   - Preserve paragraphs and line breaks matching the original source text.`;

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
      translatedContent: parsed.translatedContent || '',
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

// Set up Vite middleware for development, or static file serving for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Vercel imports this Express app from the endpoint files in api/ and manages
// the HTTP listener itself. Keep starting a normal server everywhere else so
// `npm run dev` and `npm start` continue to work locally.
if (!process.env.VERCEL) {
  startServer();
}

export default app;
