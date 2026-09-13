export type SpeechGender = 'male' | 'female';

export interface DialogueVoicePair {
  male?: SpeechSynthesisVoice;
  female?: SpeechSynthesisVoice;
}

export const WORD_SPEECH_RATE = 0.78;
export const NARRATION_SPEECH_RATE = 0.8;
export const DIALOGUE_SPEECH_RATE = 0.82;

const FEMALE_NAME_HINTS = new Set([
  'abigail', 'alice', 'amanda', 'amy', 'anna', 'ava', 'bella', 'beth', 'brooke',
  'camila', 'caroline', 'catherine', 'charlotte', 'chloe', 'christine', 'claire',
  'clara', 'daisy', 'diana', 'elena', 'elizabeth', 'ella', 'ellen', 'emma',
  'emily', 'evelyn', 'gabriella', 'grace', 'hannah', 'helen', 'iris', 'isabella',
  'jane', 'jasmine', 'jennifer', 'jessica', 'joanna', 'josephine', 'joy', 'julia',
  'julie', 'kate', 'katie', 'laura', 'leah', 'lena', 'lily', 'linda', 'lisa',
  'louise', 'madison', 'margaret', 'maria', 'marie', 'maya', 'megan', 'melissa',
  'mia', 'monica', 'natalie', 'nicole', 'nina', 'olivia', 'paula', 'rachel',
  'rebecca', 'rose', 'ruby', 'sabrina', 'sally', 'sarah', 'sophia', 'sophie',
  'stella', 'stephanie', 'susan', 'tina', 'vanessa', 'violet', 'wendy',
  'woman', 'girl', 'mother', 'mom',
]);

const MALE_NAME_HINTS = new Set([
  'adam', 'andrew', 'anthony', 'ben', 'brian', 'bruce', 'carl', 'charles',
  'connor', 'daniel', 'david', 'derek', 'donald', 'douglas', 'dylan', 'edward',
  'ethan', 'frank', 'george', 'harry', 'henry', 'hugo', 'ian', 'jack', 'james',
  'jason', 'jeff', 'jeremy', 'john', 'joseph', 'kevin', 'lawrence', 'leo',
  'liam', 'luke', 'marcus', 'mark', 'martin', 'matthew', 'michael', 'mike',
  'nathan', 'nicholas', 'noah', 'oliver', 'oscar', 'patrick', 'paul', 'peter',
  'philip', 'richard', 'robert', 'roger', 'ryan', 'sean', 'simon', 'stephen',
  'steven', 'thomas', 'tim', 'tom', 'victor', 'william',
  'man', 'boy', 'father', 'dad',
]);

const FEMALE_VOICE_HINTS = [
  'google uk english female', 'google us english', 'samantha', 'flo', 'sandy', 'shelley', 'ava',
  'allison', 'aria', 'jenny', 'michelle', 'sonia', 'libby', 'karen', 'tessa',
  'moira', 'victoria', 'zira', 'fiona', 'serena', 'veena', 'nicky', 'zoe',
  'kathy', 'susan', 'female',
];

const MALE_VOICE_HINTS = [
  'google uk english male', 'daniel', 'alex', 'aaron', 'arthur', 'oliver',
  'andrew', 'brian', 'guy', 'david', 'ryan', 'eric', 'christopher', 'mark',
  'eddy', 'reed', 'rocko', 'fred',
  'albert', 'ralph', 'bruce', 'tom', 'gordon', 'evan',
  'nathan', 'oliver', 'roger', 'stefan', 'steffan', 'male',
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
      .filter(candidate => voiceNameMatchesHint(candidate.name, hint))
      .sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a))[0];
    if (voice) return voice;
  }
  return undefined;
}

function voiceNameMatchesHint(voiceName: string, hint: string): boolean {
  const normalizedName = voiceName.toLowerCase();
  if (hint.includes(' ')) return normalizedName.includes(hint);

  // Match single names and gender labels as complete tokens. This prevents
  // "female" matching "male" and names such as "Tom" matching "Custom".
  const escapedHint = hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escapedHint}([^a-z]|$)`).test(normalizedName);
}

function classifyVoiceGender(voice: SpeechSynthesisVoice): SpeechGender | null {
  const name = voice.name.toLowerCase();
  if (/(^|[^a-z])female([^a-z]|$)/.test(name)) return 'female';
  if (/(^|[^a-z])male([^a-z]|$)/.test(name)) return 'male';
  if (FEMALE_VOICE_HINTS.some(hint => voiceNameMatchesHint(name, hint))) return 'female';
  if (MALE_VOICE_HINTS.some(hint => voiceNameMatchesHint(name, hint))) return 'male';
  return null;
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

function inferKnownSpeakerGender(speaker: string): SpeechGender | null {
  const words = speaker
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.some(word => FEMALE_NAME_HINTS.has(word))) return 'female';
  if (words.some(word => MALE_NAME_HINTS.has(word))) return 'male';
  return null;
}

export function inferSpeakerGender(speaker: string, speakerIndex: number): SpeechGender {
  const knownGender = inferKnownSpeakerGender(speaker);
  if (knownGender) return knownGender;
  return speakerIndex % 2 === 0 ? 'male' : 'female';
}

export function resolveSpeakerGender(
  speaker: string,
  speakerIndex: number,
  storedGender?: SpeechGender
): SpeechGender {
  // Old history records can be missing speaker metadata or contain an incorrect
  // AI-assigned gender. A clearly recognised name such as Anna or Tom wins.
  return inferKnownSpeakerGender(speaker) || storedGender ||
    (speakerIndex % 2 === 0 ? 'male' : 'female');
}

export function selectDialogueVoice(
  voices: SpeechSynthesisVoice[],
  gender: SpeechGender
): SpeechSynthesisVoice | undefined {
  const englishVoices = getEnglishVoices(voices);
  const confirmedGenderVoices = englishVoices.filter(
    voice => classifyVoiceGender(voice) === gender
  );
  const matchedVoice = findVoiceByHints(
    confirmedGenderVoices,
    gender === 'female' ? FEMALE_VOICE_HINTS : MALE_VOICE_HINTS
  );
  if (matchedVoice) return matchedVoice;

  // Never assign an unverified or opposite-gender voice to a role. If the
  // device exposes no confirmed voice for that gender, ReadingView keeps the
  // browser default and applies an explicit pitch fallback instead.
  return [...confirmedGenderVoices].sort(
    (a, b) => voiceQualityScore(b) - voiceQualityScore(a) || a.name.localeCompare(b.name)
  )[0];
}

export function selectDialogueVoicePair(
  voices: SpeechSynthesisVoice[]
): DialogueVoicePair {
  const englishVoices = getEnglishVoices(voices);
  const female = selectDialogueVoice(englishVoices, 'female');
  let male = selectDialogueVoice(englishVoices, 'male');

  // If the first pass still resolves both genders to one source, force a
  // different English source whenever the device has another one available.
  if (male && female && male.voiceURI === female.voiceURI) {
    const alternatives = englishVoices.filter(
      voice => voice.voiceURI !== female.voiceURI && classifyVoiceGender(voice) === 'male'
    );
    male = findVoiceByHints(alternatives, MALE_VOICE_HINTS) ||
      [...alternatives].sort(
        (a, b) => voiceQualityScore(b) - voiceQualityScore(a) || a.name.localeCompare(b.name)
      )[0];
  }

  return { male, female };
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
