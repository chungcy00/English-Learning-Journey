import html2pdf from 'html2pdf.js';
import { ReadingRecord } from '../types';

export function generateReadingPDF(reading: ReadingRecord, options?: {
  showTranslation: boolean;
  currentTranslation?: any;
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
  
  let readingHtml = '';
  if (reading.content) {
    const paragraphs = reading.content.split(/\n\s*\n/).filter(Boolean);
    const transParagraphs = options?.currentTranslation?.translatedContent 
      ? options.currentTranslation.translatedContent.split(/\n\s*\n/).filter(Boolean)
      : [];
      
    paragraphs.forEach((p, i) => {
      readingHtml += `<p style="margin-bottom: 16px; font-size: 16px; line-height: 1.6;">${p}</p>`;
      if (options?.showTranslation && transParagraphs[i]) {
        readingHtml += `<p style="margin-bottom: 24px; font-size: 14px; line-height: 1.6; color: #5F654D; font-family: system-ui, -apple-system, sans-serif;">${transParagraphs[i]}</p>`;
      }
    });
  }

  let vocabHtml = '';
  reading.selectedVocabulary?.forEach((vocab, i) => {
    const trans = options?.vocabTranslations?.[vocab.id];
    const meaning = options?.showTranslation && trans?.meaning ? trans.meaning : vocab.meaningZh;
    const exampleTrans = options?.showTranslation && trans?.exampleTranslation ? `<div style="margin-top: 4px; font-size: 13px; color: #5F654D; font-family: system-ui, -apple-system, sans-serif;">${trans.exampleTranslation}</div>` : '';
    
    vocabHtml += `
      <div style="margin-bottom: 24px; padding: 16px; background-color: #F2EEE4; border: 1px solid #D4CCBC; border-radius: 6px; page-break-inside: avoid;">
        <div style="font-weight: bold; font-size: 18px; color: #5F654D; margin-bottom: 8px;">
          ${vocab.term} <span style="font-size: 14px; font-weight: normal; color: #717265; font-family: system-ui, -apple-system, sans-serif; margin-left: 8px;">${vocab.phonetic || ''} [${vocab.partOfSpeech}] &mdash; ${meaning}</span>
        </div>
        <div style="font-size: 14px; margin-bottom: 8px; font-family: system-ui, -apple-system, sans-serif;"><strong>Definition:</strong> ${vocab.definitionEn}</div>
        <div style="font-size: 15px; font-style: italic; color: #5F654D;">" ${vocab.example} "</div>
        ${exampleTrans}
        ${vocab.collocations?.length ? `<div style="margin-top: 12px; font-size: 13px; color: #717265; font-family: system-ui, -apple-system, sans-serif;">Collocations: ${vocab.collocations.join(' &bull; ')}</div>` : ''}
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
      <h1 style="font-size: 32px; font-weight: bold; margin: 0 0 8px 0; color: #292B25;">${title}</h1>
      <div style="font-size: 13px; color: #717265; font-family: system-ui, -apple-system, sans-serif;">
        CEFR: ${reading.cefrLevel} | Type: ${reading.readingType.toUpperCase()}${languageLabel}
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
      ${vocabHtml}
    </div>

    <!-- Part 3: Exercises -->
    <div style="margin-bottom: 40px; page-break-before: always;">
      <h2 style="font-size: 20px; font-weight: bold; color: #73785E; margin-bottom: 8px; font-family: system-ui, -apple-system, sans-serif;">Part 3 &mdash; Rewrite the Sentence Practice</h2>
      <p style="font-size: 14px; color: #717265; margin-bottom: 32px; font-family: system-ui, -apple-system, sans-serif;">Rewrite each sentence using the designated target word or phrase to express the idea naturally.</p>
      ${exerciseHtml}
    </div>
  `;

  // Use html2pdf
  const opt = {
    margin:       0.6,
    filename:     `${title.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').slice(0, 30)}_learning_material.pdf`,
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' as const }
  };

  html2pdf().set(opt).from(container).save();
}
