import html2pdf from 'html2pdf.js';
import { ReadingRecord, ReadingTranslation } from '../types';

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

interface PdfDialogueTurn {
  speaker: string;
  speech: string;
}

function getDialogueSpeakerNames(reading: ReadingRecord): string[] {
  const names = new Set(
    (reading.speakers || []).map(speaker => speaker.name.trim()).filter(Boolean)
  );
  const labelPattern = /(?:^|\s)([A-Z][A-Za-z'’-]{1,30})\s*[:：]/g;
  let match: RegExpExecArray | null;
  while ((match = labelPattern.exec(reading.content)) !== null) names.add(match[1]);
  return Array.from(names);
}

function parseDialogue(text: string, knownSpeakers: string[]): PdfDialogueTurn[] {
  const cleanText = text.trim();
  if (!cleanText) return [];

  const escapedNames = knownSpeakers
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const findMatches = (speakerPattern: string, flags = 'g') =>
    Array.from(cleanText.matchAll(new RegExp(`(${speakerPattern})\\s*[:：]\\s*`, flags)));
  let matches = escapedNames.length ? findMatches(escapedNames.join('|')) : [];
  // A translated script may localize character names. Recognize short Unicode
  // speaker labels as a fallback so its complete turn structure is preserved.
  if (!matches.length) {
    matches = findMatches("[\\p{L}\\p{M}][\\p{L}\\p{M}'’·-]{0,20}", 'gu');
  }
  if (!matches.length) return [];

  return matches.map((match, index) => {
    const speechStart = (match.index || 0) + match[0].length;
    const speechEnd = index + 1 < matches.length ? (matches[index + 1].index || cleanText.length) : cleanText.length;
    return {
      speaker: match[1].trim(),
      speech: cleanText.slice(speechStart, speechEnd).trim(),
    };
  }).filter(turn => turn.speech);
}

function renderDialogueTurns(turns: PdfDialogueTurn[], translated = false): string {
  return turns.map(turn => `
    <div class="pdf-dialogue-turn ${translated ? 'pdf-dialogue-translation' : ''}">
      <div class="pdf-dialogue-speaker">${escapeHtml(turn.speaker)}</div>
      <div class="pdf-dialogue-speech">${escapeHtml(turn.speech)}</div>
    </div>
  `).join('');
}

function renderParagraphs(text: string, translated = false): string {
  return text.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean).map(paragraph => `
    <p class="${translated ? 'pdf-translation-paragraph' : 'pdf-reading-paragraph'}">${escapeHtml(paragraph)}</p>
  `).join('');
}

export function generateReadingPDF(reading: ReadingRecord, options?: {
  showTranslation: boolean;
  currentTranslation?: ReadingTranslation;
  vocabTranslations?: Record<string, { meaning: string; exampleTranslation?: string }>;
  exerciseTranslations?: Record<string, string>;
  targetLanguage?: string;
}) {
  const container = document.createElement('div');
  // Add a unique ID to ensure we can target it if needed, but we pass the element directly to html2pdf
  container.id = 'pdf-container';
  
  // Set fixed width for standard A4 portrait proportions
  container.style.width = '800px';
  container.style.backgroundColor = '#FFFFFF';
  container.style.color = '#292B25';
  container.style.fontFamily = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
  
  // Sanitize and split content
  const title = reading.title || 'Reading Practice';
  const isDialogue = reading.readingType === 'dialogue';
  const speakerNames = getDialogueSpeakerNames(reading);
  
  let readingHtml = '';
  if (reading.content) {
    const originalTurns = isDialogue ? parseDialogue(reading.content, speakerNames) : [];
    readingHtml = originalTurns.length
      ? `<div class="pdf-dialogue-list">${renderDialogueTurns(originalTurns)}</div>`
      : renderParagraphs(reading.content);

    const translatedContent = options?.showTranslation
      ? options.currentTranslation?.translatedContent?.trim()
      : '';
    if (translatedContent) {
      const translatedTurns = isDialogue ? parseDialogue(translatedContent, speakerNames) : [];
      const translationBody = translatedTurns.length
        ? `<div class="pdf-dialogue-list">${renderDialogueTurns(translatedTurns, true)}</div>`
        : renderParagraphs(translatedContent, true);
      readingHtml += `
        <div class="pdf-complete-translation">
          <h3>${escapeHtml(options?.currentTranslation?.languageName || 'Translation')}</h3>
          ${translationBody}
        </div>
      `;
    }
  }

  let vocabHtml = '';
  reading.selectedVocabulary?.forEach((vocab, i) => {
    const trans = options?.vocabTranslations?.[vocab.id];
    const meaning = options?.showTranslation && trans?.meaning ? trans.meaning : vocab.meaningZh;
    const exampleTrans = options?.showTranslation && trans?.exampleTranslation ? `<div style="margin-top: 4px; font-size: 12px; line-height: 1.45; color: #5F654D; font-family: system-ui, -apple-system, sans-serif;">${escapeHtml(trans.exampleTranslation)}</div>` : '';
    
    vocabHtml += `
      <div style="margin-bottom: 24px; padding: 16px; background-color: #F2EEE4; border: 1px solid #D4CCBC; border-radius: 6px; page-break-inside: avoid;">
        <div style="font-weight: bold; font-size: 18px; color: #5F654D; margin-bottom: 8px;">
          ${escapeHtml(vocab.term)} <span style="font-size: 12px; font-weight: normal; color: #717265; font-family: system-ui, -apple-system, sans-serif; margin-left: 6px;">${escapeHtml(vocab.phonetic || '')} [${escapeHtml(vocab.partOfSpeech)}] &mdash; ${escapeHtml(meaning)}</span>
        </div>
        <div style="font-size: 12px; line-height: 1.45; margin-bottom: 7px; font-family: system-ui, -apple-system, sans-serif;"><strong>Definition:</strong> ${escapeHtml(vocab.definitionEn)}</div>
        <div style="font-size: 13px; line-height: 1.45; font-style: italic; color: #5F654D;">&ldquo;${escapeHtml(vocab.example)}&rdquo;</div>
        ${exampleTrans}
        ${vocab.collocations?.length ? `<div style="margin-top: 9px; font-size: 11px; line-height: 1.4; color: #717265; font-family: system-ui, -apple-system, sans-serif;">Collocations: ${vocab.collocations.map(escapeHtml).join(' &bull; ')}</div>` : ''}
      </div>
    `;
  });

  let exerciseHtml = '';
  reading.rewritePractice?.forEach((ex, i) => {
    const trans = options?.showTranslation && options?.exerciseTranslations?.[ex.id] 
      ? `<div style="margin-top: 4px; font-size: 13px; color: #5F654D; font-family: system-ui, -apple-system, sans-serif;">${options.exerciseTranslations[ex.id]}</div>` 
      : '';
      
    exerciseHtml += `
      <div style="margin-bottom: 32px; page-break-inside: avoid;">
        <div style="font-size: 16px; margin-bottom: 4px;">${i + 1}. Original: "${ex.originalSentence}"</div>
        ${trans}
        <div style="font-size: 15px; font-weight: bold; color: #73785E; margin-top: 12px; margin-bottom: 24px;">Rewrite using "${ex.target}":</div>
        <div style="border-bottom: 1px solid #B49379; height: 30px; margin-bottom: 16px;"></div>
        <div style="font-size: 14px; color: #717265; font-family: system-ui, -apple-system, sans-serif;">Reference Answer: ${ex.referenceAnswer}</div>
      </div>
    `;
  });

  const languageLabel = options?.showTranslation && options?.targetLanguage ? ` | Target Language: ${options.targetLanguage}` : '';

  container.innerHTML = `
    <!-- Header -->
    <div style="margin-bottom: 40px; border-bottom: 2px solid #D4CCBC; padding-bottom: 16px;">
      <h1 style="font-size: 32px; font-weight: bold; margin: 0 0 8px 0; color: #292B25;">${escapeHtml(title)}</h1>
      <div style="font-size: 13px; color: #717265; font-family: system-ui, -apple-system, sans-serif;">
        CEFR: ${escapeHtml(reading.cefrLevel)} | Type: ${escapeHtml(reading.readingType.toUpperCase())}${escapeHtml(languageLabel)}
      </div>
    </div>

    <!-- Part 1: Reading -->
    <div style="margin-bottom: 60px;">
      <h2 style="font-size: 20px; font-weight: bold; color: #73785E; margin-bottom: 24px; font-family: system-ui, -apple-system, sans-serif;">Part 1 &mdash; Reading</h2>
      ${readingHtml}
    </div>

    <!-- Part 2: Vocabulary -->
    <div style="margin-bottom: 60px; page-break-before: always;">
      <h2 style="font-size: 20px; font-weight: bold; color: #73785E; margin-bottom: 24px; font-family: system-ui, -apple-system, sans-serif;">Part 2 &mdash; Vocabulary & Key Expressions</h2>
      <div class="pdf-vocabulary-grid">${vocabHtml}</div>
    </div>

    <!-- Part 3: Exercises -->
    <div style="margin-bottom: 40px; page-break-before: always;">
      <h2 style="font-size: 20px; font-weight: bold; color: #73785E; margin-bottom: 8px; font-family: system-ui, -apple-system, sans-serif;">Part 3 &mdash; Rewrite the Sentence Practice</h2>
      <p style="font-size: 14px; color: #717265; margin-bottom: 32px; font-family: system-ui, -apple-system, sans-serif;">Rewrite each sentence using the designated target word or phrase to express the idea naturally.</p>
      ${exerciseHtml}
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #pdf-container { box-sizing: border-box; }
    #pdf-container * { box-sizing: border-box; }
    .pdf-reading-paragraph { margin: 0 0 16px; font-size: 16px; line-height: 1.65; }
    .pdf-complete-translation { margin-top: 26px; padding-top: 18px; border-top: 1px solid #D4CCBC; }
    .pdf-complete-translation h3 { margin: 0 0 14px; color: #73785E; font: 700 14px/1.4 system-ui, -apple-system, sans-serif; }
    .pdf-translation-paragraph { margin: 0 0 14px; color: #5F654D; font: 14px/1.7 system-ui, -apple-system, sans-serif; }
    .pdf-dialogue-list { display: block; }
    .pdf-dialogue-turn { display: flex; align-items: flex-start; gap: 14px; margin: 0 0 12px; break-inside: avoid; page-break-inside: avoid; }
    .pdf-dialogue-speaker { width: 86px; flex: 0 0 86px; padding-top: 2px; color: #5F654D; font: 700 13px/1.5 system-ui, -apple-system, sans-serif; text-transform: uppercase; }
    .pdf-dialogue-speech { flex: 1 1 auto; min-width: 0; font-size: 16px; line-height: 1.6; }
    .pdf-dialogue-translation .pdf-dialogue-speech { color: #5F654D; font: 14px/1.7 system-ui, -apple-system, sans-serif; }
    .pdf-vocabulary-grid { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 14px 3%; }
    .pdf-vocabulary-grid > div { width: 48.5%; margin-bottom: 0 !important; break-inside: avoid; page-break-inside: avoid; }
  `;
  container.prepend(style);

  // Use html2pdf
  const opt = {
    margin:       0.6,
    filename:     `${title.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').slice(0, 30)}_learning_material.pdf`,
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' as const },
    pagebreak:    { mode: ['css', 'legacy'] }
  };

  html2pdf().set(opt).from(container).save();
}
