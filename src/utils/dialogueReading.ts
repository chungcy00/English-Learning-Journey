import type { ReadingTranslation } from '../types';
import { groupReadingSentences, splitReadingSentences } from './readingSegments';

export interface DialogueTurn { speaker: string | null; speech: string; }
const NON_SPEAKER_LABELS = new Set(['note', 'ps', 'p.s', 'step', 'tip', 'warning']);
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Helper to parse dialogue turns from text (handles line-by-line, single-paragraph merged dialogues, and scene notes)
export function parseDialogueTurns(text: string, knownSpeakers: string[] = []): DialogueTurn[] {
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

// Exact source mappings preserve the original speaker and turn boundaries even
// when the full translated text renames characters or omits their labels.
export function mappedDialogueTranslation(turns: DialogueTurn[], translation?: ReadingTranslation): DialogueTurn[] | null {
  const result: DialogueTurn[] = [];
  for (const turn of turns) {
    const sentences = splitReadingSentences(turn.speech);
    const translated = groupReadingSentences(sentences, translation).map(segment => segment.translation);
    if (!sentences.length || translated.some(sentence => !sentence)) return null;
    result.push({ speaker: turn.speaker, speech: translated.join(' ') });
  }
  return result.length ? result : null;
}
