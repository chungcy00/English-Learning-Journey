import { VocabularyItem, RewritePracticeItem, ReadingTranslation } from '../types';

export interface LanguageOption {
  code: string;
  name: string;
  native: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'zh-CN', name: '简体中文', native: '中文 (简体)', flag: '🇨🇳' },
  { code: 'zh-TW', name: '繁體中文', native: '中文 (繁體)', flag: '🇭🇰' },
  { code: 'ja', name: '日本語', native: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', native: '한국어', flag: '🇰🇷' },
  { code: 'es', name: 'Español', native: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', native: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', native: 'Deutsch', flag: '🇩🇪' },
  { code: 'vi', name: 'Tiếng Việt', native: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ru', name: 'Русский', native: 'Русский', flag: '🇷🇺' },
];

export const I18N_STRINGS: Record<string, Record<string, string>> = {
  'zh-CN': {

    wordbookTitle: '个人生词本 (My Wordbook)',
    wordbookSub: '共收录 {count} 个重点词汇与短语',
    reviewTitle: '间隔复习 (Vocabulary Review)',
    reviewSub: '根据艾宾浩斯记忆曲线科学安排复习间隔，加深真实语境记忆',
    revealDetails: '显示详细释义与例句 (Reveal Details)',
    searchPlaceholder: '搜索英文、{lang}或释义...',
    syncingWordbook: '正在同步 {lang} 释义...',
  
    vocabSectionTitle: '精选生词与短语 (Selected Vocabulary)',
    vocabSectionSub: '点击生词卡片查看目标母语释义、英文定义、例句与常见搭配',
    adjustVocab: '调整生词列表',
    addToWordbook: '加入生词本',
    inWordbook: '已在生词本',
    targetMeaningLabel: '母语地道释义 (Meaning)',
    enDefinitionLabel: '英文释义 (Definition)',
    exampleLabel: '例句 (Example)',
    exampleTranslationLabel: '例句译文 (Translation)',
    collocationsLabel: '常见搭配 (Collocations)',
    rewriteSectionTitle: 'Rewrite the Sentence 强化练习',
    rewriteSectionSub: '使用指定目标词汇改写原句，AI 将针对句意保留、语法、自然度与搭配给予详细评分',
    exerciseLabel: '练习',
    targetLabel: '目标词汇',
    rewritePromptPrefix: '用目标词汇改写句子',
    inputPlaceholder: '在此输入您的改写答案...',
    checkButton: '评估改写',
    evaluating: 'AI 评分中...',
    originalMeaningLabel: '原句释义',
    meaningPreserved: '句意保留',
    targetUsed: '正确使用目标词',
    whatYouDidWell: '亮点表现',
    issuesToImprove: '改进建议',
    improvedVersion: '更佳润色表达',
    referenceAnswer: '参考范例',
    close: '关闭',
    syncingVocab: '正在同步更新词汇与练习释义...',
  },
  'zh-TW': {

    wordbookTitle: '個人生詞本 (My Wordbook)',
    wordbookSub: '共收錄 {count} 個重點詞彙與短語',
    reviewTitle: '間隔複習 (Vocabulary Review)',
    reviewSub: '根據艾賓浩斯記憶曲線科學安排複習間隔，加深真實語境記憶',
    revealDetails: '顯示詳細釋義與例句 (Reveal Details)',
    searchPlaceholder: '搜尋英文、{lang}或釋義...',
    syncingWordbook: '正在同步 {lang} 釋義...',
  
    vocabSectionTitle: '精選生詞與短語 (Selected Vocabulary)',
    vocabSectionSub: '點擊生詞卡片查看目標母語釋義、英文定義、例句與常見搭配',
    adjustVocab: '調整生詞清單',
    addToWordbook: '加入生詞本',
    inWordbook: '已在生詞本',
    targetMeaningLabel: '母語地道釋義 (Meaning)',
    enDefinitionLabel: '英文釋義 (Definition)',
    exampleLabel: '例句 (Example)',
    exampleTranslationLabel: '例句譯文 (Translation)',
    collocationsLabel: '常見搭配 (Collocations)',
    rewriteSectionTitle: 'Rewrite the Sentence 強化練習',
    rewriteSectionSub: '使用指定目標詞彙改寫原句，AI 將針對句意保留、語法、自然度與搭配給予詳細評分',
    exerciseLabel: '練習',
    targetLabel: '目標詞彙',
    rewritePromptPrefix: '用目標詞彙改寫句子',
    inputPlaceholder: '在此輸入您的改寫答案...',
    checkButton: '評估改寫',
    evaluating: 'AI 評分中...',
    originalMeaningLabel: '原句釋義',
    meaningPreserved: '句意保留',
    targetUsed: '正確使用目標詞',
    whatYouDidWell: '亮點表現',
    issuesToImprove: '改進建議',
    improvedVersion: '更佳潤色表達',
    referenceAnswer: '參考範例',
    close: '關閉',
    syncingVocab: '正在同步更新詞彙與練習釋義...',
  },
  'ja': {

    wordbookTitle: 'マイ単語帳 (My Wordbook)',
    wordbookSub: '全 {count} 個の重要語彙・フレーズを収録',
    reviewTitle: '間隔反復学習 (Vocabulary Review)',
    reviewSub: 'エビングハウスの忘却曲線に基づき、実際の文脈で記憶を定着させます',
    revealDetails: '詳細な意味と例文を表示 (Reveal Details)',
    searchPlaceholder: '英語、{lang}、または意味を検索...',
    syncingWordbook: '{lang} の意味を同期中...',
  
    vocabSectionTitle: '重要語彙・キー表現 (Selected Vocabulary)',
    vocabSectionSub: 'カードをクリックして日本語訳、英語定義、例文、コロケーションを確認',
    adjustVocab: '単語リストを編集',
    addToWordbook: '単語帳に追加',
    inWordbook: '単語帳登録済',
    targetMeaningLabel: '日本語訳 (Meaning)',
    enDefinitionLabel: '英語定義 (Definition)',
    exampleLabel: '例文 (Example)',
    exampleTranslationLabel: '例文の日本語訳 (Translation)',
    collocationsLabel: '頻出コロケーション (Collocations)',
    rewriteSectionTitle: 'Rewrite the Sentence 文の書き換え練習',
    rewriteSectionSub: '指定された重要語彙を使って文を書き換えてください。AIが意味の保持、文法、自然さ、コロケーションを詳細に採点します',
    exerciseLabel: '練習',
    targetLabel: '指定語彙',
    rewritePromptPrefix: '指定語彙を使って文を書き換える',
    inputPlaceholder: 'ここに書き換え文を入力してください...',
    checkButton: '判定・採点する',
    evaluating: 'AI 採点中...',
    originalMeaningLabel: '原句の日本語訳',
    meaningPreserved: '意味の保持',
    targetUsed: '指定語の正しい使用',
    whatYouDidWell: '良かった点',
    issuesToImprove: '改善のアドバイス',
    improvedVersion: 'より自然な推敲案',
    referenceAnswer: '模範解答',
    close: '閉じる',
    syncingVocab: '語彙と練習問題を日本語へ同期中...',
  },
  'ko': {

    wordbookTitle: '내 단어장 (My Wordbook)',
    wordbookSub: '총 {count}개의 핵심 어휘 및 표현 수록',
    reviewTitle: '간격 복습 (Vocabulary Review)',
    reviewSub: '에빙하우스 망각 곡선에 기반하여 실제 문맥에서의 기억을 강화합니다',
    revealDetails: '상세 뜻과 예문 보기 (Reveal Details)',
    searchPlaceholder: '영어, {lang} 또는 뜻 검색...',
    syncingWordbook: '{lang} 뜻 동기화 중...',
  
    vocabSectionTitle: '핵심 어휘 및 표현 (Selected Vocabulary)',
    vocabSectionSub: '단어 카드를 클릭하여 한국어 뜻, 영문 정의, 예문 및 연어를 확인하세요',
    adjustVocab: '어휘 목록 수정',
    addToWordbook: '단어장에 추가',
    inWordbook: '단어장에 저장됨',
    targetMeaningLabel: '한국어 뜻 (Meaning)',
    enDefinitionLabel: '영문 정의 (Definition)',
    exampleLabel: '예문 (Example)',
    exampleTranslationLabel: '예문 번역 (Translation)',
    collocationsLabel: '자주 쓰이는 연어 (Collocations)',
    rewriteSectionTitle: 'Rewrite the Sentence 문장 고쳐 쓰기 연습',
    rewriteSectionSub: '지정된 핵심 어휘를 사용하여 원문을 고쳐 쓰세요. AI가 의미 보존, 문법, 자연스러움 및 연어를 상세히 평가합니다',
    exerciseLabel: '연습',
    targetLabel: '목표 어휘',
    rewritePromptPrefix: '목표 어휘를 사용하여 문장 고쳐 쓰기',
    inputPlaceholder: '여기에 고쳐 쓴 문장을 입력하세요...',
    checkButton: '채점 및 평가',
    evaluating: 'AI 채점 중...',
    originalMeaningLabel: '원문 해석',
    meaningPreserved: '의미 보존',
    targetUsed: '목표 어휘 올바른 사용',
    whatYouDidWell: '잘한 점',
    issuesToImprove: '개선 제안',
    improvedVersion: '더 자연스러운 다듬은 문장',
    referenceAnswer: '참고 모범 답안',
    close: '닫기',
    syncingVocab: '어휘 및 연습 번역 동기화 중...',
  },
  'es': {

    wordbookTitle: 'Mi vocabulario (My Wordbook)',
    wordbookSub: 'Contiene {count} palabras y frases clave',
    reviewTitle: 'Repaso espaciado (Vocabulary Review)',
    reviewSub: 'Repaso científico basado en la curva del olvido para reforzar la memoria en contexto',
    revealDetails: 'Mostrar significado y ejemplos (Reveal Details)',
    searchPlaceholder: 'Buscar inglés, {lang} o significado...',
    syncingWordbook: 'Sincronizando significados en {lang}...',
  
    vocabSectionTitle: 'Vocabulario clave seleccionado (Selected Vocabulary)',
    vocabSectionSub: 'Haz clic en una tarjeta para ver significado, definición en inglés, ejemplos y colocaciones',
    adjustVocab: 'Ajustar vocabulario',
    addToWordbook: 'Guardar palabra',
    inWordbook: 'Guardada',
    targetMeaningLabel: 'Significado en español (Meaning)',
    enDefinitionLabel: 'Definición en inglés (Definition)',
    exampleLabel: 'Ejemplo (Example)',
    exampleTranslationLabel: 'Traducción del ejemplo (Translation)',
    collocationsLabel: 'Colocaciones frecuentes (Collocations)',
    rewriteSectionTitle: 'Práctica de reescritura (Rewrite the Sentence)',
    rewriteSectionSub: 'Reescribe la oración utilizando la palabra objetivo. La IA evaluará el sentido, gramática, naturalidad y colocaciones.',
    exerciseLabel: 'Ejercicio',
    targetLabel: 'Palabra clave',
    rewritePromptPrefix: 'Reescribe usando la palabra objetivo',
    inputPlaceholder: 'Escribe tu respuesta aquí...',
    checkButton: 'Evaluar respuesta',
    evaluating: 'Evaluando con IA...',
    originalMeaningLabel: 'Significado original',
    meaningPreserved: 'Sentido preservado',
    targetUsed: 'Término usado correctamente',
    whatYouDidWell: 'Puntos fuertes',
    issuesToImprove: 'Sugerencias de mejora',
    improvedVersion: 'Versión más natural',
    referenceAnswer: 'Respuesta modelo',
    close: 'Cerrar',
    syncingVocab: 'Sincronizando vocabulario y ejercicios al español...',
  },
  'fr': {

    wordbookTitle: 'Mon carnet de vocabulaire (My Wordbook)',
    wordbookSub: 'Contient {count} mots et expressions clés',
    reviewTitle: 'Révision espacée (Vocabulary Review)',
    reviewSub: 'Révision scientifique basée sur la courbe de l\'oubli pour renforcer la mémoire en contexte',
    revealDetails: 'Afficher les détails et exemples (Reveal Details)',
    searchPlaceholder: 'Rechercher anglais, {lang} ou signification...',
    syncingWordbook: 'Synchronisation des significations en {lang}...',
  
    vocabSectionTitle: 'Vocabulaire clé sélectionné (Selected Vocabulary)',
    vocabSectionSub: 'Cliquez sur une carte pour voir la signification, définition anglaise, exemples et collocations',
    adjustVocab: 'Modifier le vocabulaire',
    addToWordbook: 'Ajouter au carnet',
    inWordbook: 'Enregistré',
    targetMeaningLabel: 'Signification en français (Meaning)',
    enDefinitionLabel: 'Définition en anglais (Definition)',
    exampleLabel: 'Exemple (Example)',
    exampleTranslationLabel: 'Traduction de l’exemple (Translation)',
    collocationsLabel: 'Collocations fréquentes (Collocations)',
    rewriteSectionTitle: 'Exercices de reformulation (Rewrite the Sentence)',
    rewriteSectionSub: 'Reformulez la phrase en utilisant le terme cible. L’IA évaluera le respect du sens, la grammaire et la fluidité.',
    exerciseLabel: 'Exercice',
    targetLabel: 'Mot cible',
    rewritePromptPrefix: 'Reformulez avec le mot cible',
    inputPlaceholder: 'Entrez votre phrase ici...',
    checkButton: 'Évaluer',
    evaluating: 'Évaluation IA en cours...',
    originalMeaningLabel: 'Sens de la phrase originale',
    meaningPreserved: 'Sens préservé',
    targetUsed: 'Mot cible bien employé',
    whatYouDidWell: 'Points forts',
    issuesToImprove: 'Pistes d’amélioration',
    improvedVersion: 'Formulation plus naturelle',
    referenceAnswer: 'Réponse de référence',
    close: 'Fermer',
    syncingVocab: 'Synchronisation du vocabulaire et des exercices en français...',
  },
  'de': {

    wordbookTitle: 'Mein Vokabelheft (My Wordbook)',
    wordbookSub: 'Enthält {count} wichtige Wörter und Phrasen',
    reviewTitle: 'Verteilte Wiederholung (Vocabulary Review)',
    reviewSub: 'Wissenschaftliche Wiederholung basierend auf der Vergessenskurve',
    revealDetails: 'Details und Beispiele anzeigen (Reveal Details)',
    searchPlaceholder: 'Suche Englisch, {lang} oder Bedeutung...',
    syncingWordbook: 'Synchronisiere Bedeutungen in {lang}...',
  
    vocabSectionTitle: 'Ausgewählter Wortschatz (Selected Vocabulary)',
    vocabSectionSub: 'Klicken Sie auf eine Karte für deutsche Bedeutung, englische Definition, Beispiele und Kollokationen',
    adjustVocab: 'Wortschatz anpassen',
    addToWordbook: 'Im Vokabelheft speichern',
    inWordbook: 'Gespeichert',
    targetMeaningLabel: 'Bedeutung auf Deutsch (Meaning)',
    enDefinitionLabel: 'Englische Definition (Definition)',
    exampleLabel: 'Beispiel (Example)',
    exampleTranslationLabel: 'Beispielübersetzung (Translation)',
    collocationsLabel: 'Typische Kollokationen (Collocations)',
    rewriteSectionTitle: 'Satzumformung (Rewrite the Sentence)',
    rewriteSectionSub: 'Formen Sie den Satz mit dem Zielwort um. Die KI bewertet Bedeutungserhalt, Grammatik, Natürlichkeit und Kollokationen.',
    exerciseLabel: 'Übung',
    targetLabel: 'Zielwort',
    rewritePromptPrefix: 'Satz mit Zielwort umformen',
    inputPlaceholder: 'Geben Sie Ihre Antwort hier ein...',
    checkButton: 'Auswerten',
    evaluating: 'KI bewertet...',
    originalMeaningLabel: 'Bedeutung des Originals',
    meaningPreserved: 'Bedeutungserhalt',
    targetUsed: 'Zielwort korrekt verwendet',
    whatYouDidWell: 'Gelungene Aspekte',
    issuesToImprove: 'Verbesserungsvorschläge',
    improvedVersion: 'Natürlichere Formulierung',
    referenceAnswer: 'Referenzantwort',
    close: 'Schließen',
    syncingVocab: 'Synchronisiere Wortschatz und Übungen ins Deutsche...',
  },
  'vi': {

    wordbookTitle: 'Sổ từ vựng của tôi (My Wordbook)',
    wordbookSub: 'Bao gồm {count} từ vựng và cụm từ cốt lõi',
    reviewTitle: 'Ôn tập ngắt quãng (Vocabulary Review)',
    reviewSub: 'Ôn tập khoa học dựa trên đường cong lãng quên Ebbinghaus',
    revealDetails: 'Hiển thị chi tiết và ví dụ (Reveal Details)',
    searchPlaceholder: 'Tìm kiếm tiếng Anh, {lang} hoặc nghĩa...',
    syncingWordbook: 'Đang đồng bộ nghĩa {lang}...',
  
    vocabSectionTitle: 'Từ vựng cốt lõi được chọn lọc (Selected Vocabulary)',
    vocabSectionSub: 'Nhấp vào thẻ để xem nghĩa tiếng Việt, định nghĩa tiếng Anh, ví dụ và cụm từ đi kèm',
    adjustVocab: 'Chỉnh sửa từ vựng',
    addToWordbook: 'Lưu vào sổ từ',
    inWordbook: 'Đã lưu',
    targetMeaningLabel: 'Nghĩa tiếng Việt (Meaning)',
    enDefinitionLabel: 'Định nghĩa tiếng Anh (Definition)',
    exampleLabel: 'Ví dụ (Example)',
    exampleTranslationLabel: 'Dịch câu ví dụ (Translation)',
    collocationsLabel: 'Cụm từ thông dụng (Collocations)',
    rewriteSectionTitle: 'Luyện viết lại câu (Rewrite the Sentence)',
    rewriteSectionSub: 'Viết lại câu gốc bằng từ vựng mục tiêu. AI sẽ đánh giá mức độ giữ nguyên nghĩa, ngữ pháp, độ tự nhiên và kết hợp từ.',
    exerciseLabel: 'Bài tập',
    targetLabel: 'Từ mục tiêu',
    rewritePromptPrefix: 'Viết lại câu bằng từ mục tiêu',
    inputPlaceholder: 'Nhập câu viết lại của bạn vào đây...',
    checkButton: 'Đánh giá câu',
    evaluating: 'AI đang chấm điểm...',
    originalMeaningLabel: 'Nghĩa câu gốc',
    meaningPreserved: 'Bảo toàn ý nghĩa',
    targetUsed: 'Dùng đúng từ mục tiêu',
    whatYouDidWell: 'Điểm sáng',
    issuesToImprove: 'Gợi ý cải thiện',
    improvedVersion: 'Câu diễn đạt tự nhiên hơn',
    referenceAnswer: 'Câu mẫu tham khảo',
    close: 'Đóng',
    syncingVocab: 'Đang đồng bộ từ vựng và bài tập sang tiếng Việt...',
  },
  'ru': {

    wordbookTitle: 'Мой словарь (My Wordbook)',
    wordbookSub: 'Содержит {count} ключевых слов и фраз',
    reviewTitle: 'Интервальное повторение (Vocabulary Review)',
    reviewSub: 'Научное повторение на основе кривой забывания Эббингауза',
    revealDetails: 'Показать детали и примеры (Reveal Details)',
    searchPlaceholder: 'Поиск английского, {lang} или значения...',
    syncingWordbook: 'Синхронизация значений на {lang}...',
  
    vocabSectionTitle: 'Ключевая лексика (Selected Vocabulary)',
    vocabSectionSub: 'Нажмите на карточку, чтобы увидеть значение на русском, английское определение, примеры и сочетания',
    adjustVocab: 'Настроить список слов',
    addToWordbook: 'Добавить в словарь',
    inWordbook: 'В словаре',
    targetMeaningLabel: 'Значение на русском (Meaning)',
    enDefinitionLabel: 'Английское определение (Definition)',
    exampleLabel: 'Пример (Example)',
    exampleTranslationLabel: 'Перевод примера (Translation)',
    collocationsLabel: 'Устойчивые словосочетания (Collocations)',
    rewriteSectionTitle: 'Упражнения на перефразирование (Rewrite the Sentence)',
    rewriteSectionSub: 'Перефразируйте предложение с целевым словом. ИИ оценит сохранение смысла, грамматику, естественность и устойчивые выражения.',
    exerciseLabel: 'Упражнение',
    targetLabel: 'Целевое слово',
    rewritePromptPrefix: 'Перефразируйте с целевым словом',
    inputPlaceholder: 'Введите ваш вариант предложения...',
    checkButton: 'Проверить ответ',
    evaluating: 'ИИ оценивает...',
    originalMeaningLabel: 'Смысл оригинала',
    meaningPreserved: 'Смысл сохранён',
    targetUsed: 'Целевое слово использовано верно',
    whatYouDidWell: 'Что получилось хорошо',
    issuesToImprove: 'Рекомендации по улучшению',
    improvedVersion: 'Более естественный вариант',
    referenceAnswer: 'Эталонный ответ',
    close: 'Закрыть',
    syncingVocab: 'Синхронизация лексики и упражнений на русский...',
  },
};

export function getI18nText(lang: string, key: string, fallback?: string): string {
  const dict = I18N_STRINGS[lang] || I18N_STRINGS['zh-CN'] || {};
  return dict[key] || fallback || key;
}

/**
 * Returns localized meaning for a vocabulary item based on targetLanguage and currentTranslation cache
 */
export function getLocalizedVocabMeaning(
  vocab: VocabularyItem,
  targetLanguage: string = 'zh-CN',
  translation?: ReadingTranslation
): string {
  // 1. Direct translation stored on vocab item itself
  if (vocab.translations?.[targetLanguage]?.meaning) {
    return vocab.translations[targetLanguage].meaning;
  }

  // 2. From reading translation cache
  if (translation?.vocabularyTranslations) {
    const fromId = translation.vocabularyTranslations[vocab.id]?.meaning;
    if (fromId) return fromId;
    const fromTerm = translation.vocabularyTranslations[vocab.term.toLowerCase()]?.meaning;
    if (fromTerm) return fromTerm;
  }

  // 3. Simplified Chinese
  if (targetLanguage === 'zh-CN') {
    return vocab.meaningZh || '暂无释义';
  }

  // 4. Traditional Chinese
  if (targetLanguage === 'zh-TW') {
    return vocab.translations?.['zh-TW']?.meaning || vocab.meaningZh || '暫無釋義';
  }

  // 5. Fallback
  return vocab.translations?.[targetLanguage]?.meaning || vocab.meaningZh || vocab.definitionEn || '';
}

/**
 * Returns localized example translation if available
 */
export function getLocalizedExampleTranslation(
  vocab: VocabularyItem,
  targetLanguage: string = 'zh-CN',
  translation?: ReadingTranslation
): string | undefined {
  // 1. Direct translation stored on vocab item itself
  if (vocab.translations?.[targetLanguage]?.exampleTranslation) {
    return vocab.translations[targetLanguage].exampleTranslation;
  }

  // 2. From reading translation cache
  if (translation?.vocabularyTranslations) {
    return (
      translation.vocabularyTranslations[vocab.id]?.exampleTranslation ||
      translation.vocabularyTranslations[vocab.term.toLowerCase()]?.exampleTranslation
    );
  }
  return undefined;
}

/**
 * Returns localized original sentence meaning for rewrite exercises
 */
export function getLocalizedExerciseMeaning(
  exercise: RewritePracticeItem,
  index: number,
  targetLanguage: string,
  translation?: ReadingTranslation
): string | undefined {
  if (translation?.exerciseTranslations) {
    return (
      translation.exerciseTranslations[exercise.id]?.originalSentenceMeaning ||
      translation.exerciseTranslations[String(index)]?.originalSentenceMeaning
    );
  }
  return undefined;
}
