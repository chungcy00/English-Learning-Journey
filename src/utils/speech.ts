export type SpeechGender = 'male' | 'female';

export const WORD_SPEECH_RATE = 0.78;
export const NARRATION_SPEECH_RATE = 0.8;
export const DIALOGUE_SPEECH_RATE = 0.82;

const FEMALE_NAME_HINTS = new Set([
  'alice', 'anna', 'ava', 'bella', 'chloe', 'claire', 'diana', 'ella', 'emma',
  'emily', 'grace', 'hannah', 'jane', 'jessica', 'julia', 'kate', 'laura',
  'lena', 'lily', 'linda', 'lucy', 'maya', 'mia', 'nina', 'olivia', 'rachel',
  'sarah', 'sophia', 'sophie', 'susan', 'woman', 'girl', 'mother', 'mom',
]);

const MALE_NAME_HINTS = new Set([
  'adam', 'alex', 'andrew', 'ben', 'charles', 'chris', 'daniel', 'david',
  'edward', 'ethan', 'george', 'henry', 'jack', 'james', 'john', 'kai', 'leo',
  'liam', 'mark', 'marcus', 'michael', 'mike', 'noah', 'oliver', 'peter',
  'ryan', 'sam', 'thomas', 'tom', 'man', 'boy', 'father', 'dad',
]);

const FEMALE_VOICE_HINTS = [
  'google uk english female', 'samantha', 'flo', 'sandy', 'shelley', 'ava',
  'allison', 'aria', 'jenny', 'michelle', 'sonia', 'libby', 'karen', 'tessa',
  'moira', 'victoria', 'zira', 'fiona', 'serena', 'veena', 'female',
];

const MALE_VOICE_HINTS = [
  'google uk english male', 'eddy', 'reed', 'rocko', 'alex', 'daniel', 'guy',
  'ryan', 'eric', 'christopher', 'david', 'mark', 'aaron', 'arthur', 'fred',
  'albert', 'ralph', 'bruce', 'tom', 'gordon', 'male',
];

const NOVELTY_VOICE_HINTS = [
  'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news',
  'jester', 'organ', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox',
];

function getEnglishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.filter(voice => {
    const name = voice.name.toLowerCase();
    return voice.lang.toLowerCase().startsWith('en') &&
      !NOVELTY_VOICE_HINTS.some(hint => name.includes(hint));
  });
}

function findVoiceByHints(
  voices: SpeechSynthesisVoice[],
  hints: string[]
): SpeechSynthesisVoice | undefined {
  for (const hint of hints) {
    const voice = voices
      .filter(candidate => candidate.name.toLowerCase().includes(hint))
      .sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a))[0];
    if (voice) return voice;
  }
  return undefined;
}

function voiceQualityScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const qualityHints = ['premium', 'enhanced', 'natural', 'neural', 'online'];
  return qualityHints.reduce(
    (score, hint, index) => score + (name.includes(hint) ? qualityHints.length - index : 0),
    voice.localService ? 1 : 0
  );
}

export function getAvailableSpeechVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

export function inferSpeakerGender(speaker: string, speakerIndex: number): SpeechGender {
  const words = speaker
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.some(word => FEMALE_NAME_HINTS.has(word))) return 'female';
  if (words.some(word => MALE_NAME_HINTS.has(word))) return 'male';
  return speakerIndex % 2 === 0 ? 'male' : 'female';
}

export function selectDialogueVoice(
  voices: SpeechSynthesisVoice[],
  gender: SpeechGender
): SpeechSynthesisVoice | undefined {
  const englishVoices = getEnglishVoices(voices);
  const matchedVoice = findVoiceByHints(
    englishVoices,
    gender === 'female' ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS
  );
  if (matchedVoice) return matchedVoice;

  // Voice gender is not exposed by the Web Speech API. When a browser uses
  // unfamiliar voice names, choose two deterministic, distinct English voices
  // if possible instead of silently assigning the same default to both roles.
  const qualitySorted = [...englishVoices].sort(
    (a, b) => voiceQualityScore(b) - voiceQualityScore(a) || a.name.localeCompare(b.name)
  );
  if (gender === 'female') {
    return qualitySorted.find(voice => voice.default) || qualitySorted[0];
  }

  const femaleFallback = qualitySorted.find(voice => voice.default) || qualitySorted[0];
  return qualitySorted.find(voice => voice.voiceURI !== femaleFallback?.voiceURI) || femaleFallback;
}

export function selectVocabularyVoice(
  voices: SpeechSynthesisVoice[] = getAvailableSpeechVoices()
): SpeechSynthesisVoice | undefined {
  const englishVoices = getEnglishVoices(voices);
  const defaultEnglishVoice = englishVoices.find(voice => voice.default);
  return defaultEnglishVoice || findVoiceByHints(englishVoices, FEMALE_VOICE_HINTS);
}

export function stopEnglishSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakEnglishTerm(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const normalizedText = text.trim();
  if (!normalizedText) return;

  stopEnglishSpeech();
  const utterance = new SpeechSynthesisUtterance(normalizedText);
  utterance.lang = 'en-US';
  utterance.voice = selectVocabularyVoice() || null;
  utterance.rate = WORD_SPEECH_RATE;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}
