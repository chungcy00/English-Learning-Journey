import React from 'react';
import { BookOpen, Bookmark, History, RotateCcw, Sparkles } from 'lucide-react';

export type NavTab = 'home' | 'reading' | 'history' | 'wordbook' | 'review';

interface NavbarProps {
  activeTab: NavTab | 'settings'; // keep 'settings' literal here just in case App passes it
  setActiveTab: (tab: NavTab | 'settings') => void;
  reviewDueCount: number;
  hasCurrentReading: boolean;
  targetLanguage: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  reviewDueCount,
  hasCurrentReading,
  targetLanguage,
}) => {
  const tabs = [
    { id: 'home' as NavTab, label: targetLanguage === 'zh-CN' ? '生成短文' : targetLanguage === 'zh-TW' ? '生成短文' : targetLanguage === 'ja' ? '文章生成' : targetLanguage === 'ko' ? '지문 생성' : targetLanguage === 'es' ? 'Generar' : targetLanguage === 'fr' ? 'Générer' : targetLanguage === 'de' ? 'Generieren' : targetLanguage === 'vi' ? 'Tạo bài' : targetLanguage === 'ru' ? 'Генерация' : 'Generate', icon: Sparkles },
    { id: 'reading' as NavTab, label: targetLanguage === 'zh-CN' ? '当前阅读' : targetLanguage === 'zh-TW' ? '當前閱讀' : targetLanguage === 'ja' ? '現在の文章' : targetLanguage === 'ko' ? '현재 읽기' : targetLanguage === 'es' ? 'Lectura actual' : targetLanguage === 'fr' ? 'Lecture' : targetLanguage === 'de' ? 'Aktuell' : targetLanguage === 'vi' ? 'Đang đọc' : targetLanguage === 'ru' ? 'Текущее' : 'Reading', icon: BookOpen, disabled: !hasCurrentReading },
    { id: 'wordbook' as NavTab, label: targetLanguage === 'zh-CN' ? '生词本' : targetLanguage === 'zh-TW' ? '生詞本' : targetLanguage === 'ja' ? '単語帳' : targetLanguage === 'ko' ? '단어장' : targetLanguage === 'es' ? 'Vocabulario' : targetLanguage === 'fr' ? 'Vocabulaire' : targetLanguage === 'de' ? 'Wortschatz' : targetLanguage === 'vi' ? 'Sổ từ' : targetLanguage === 'ru' ? 'Словарь' : 'Wordbook', icon: Bookmark },
    { id: 'review' as NavTab, label: targetLanguage === 'zh-CN' ? '复习' : targetLanguage === 'zh-TW' ? '複習' : targetLanguage === 'ja' ? '復習' : targetLanguage === 'ko' ? '복습' : targetLanguage === 'es' ? 'Repaso' : targetLanguage === 'fr' ? 'Révision' : targetLanguage === 'de' ? 'Wiederholung' : targetLanguage === 'vi' ? 'Ôn tập' : targetLanguage === 'ru' ? 'Повторение' : 'Review', icon: RotateCcw, badge: reviewDueCount },
    { id: 'history' as NavTab, label: '历史记录', icon: History },
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#F2EEE4]/90 backdrop-blur-sm border-b border-[#D4CCBC] px-4 sm:px-8 py-3.5 transition-colors">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-4">
        {/* Brand & Editorial Title */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 min-h-11 text-left group self-start"
        >
          <img
            src="/site-icon.png"
            alt=""
            aria-hidden="true"
            className="w-10 h-10 object-contain flex-shrink-0"
          />
          <div>
            <span className="font-editorial text-xl sm:text-2xl font-semibold text-[#292B25] tracking-tight group-hover:text-[#5F654D] transition-colors">
              Mine English
            </span>
          </div>
        </button>

        {/* Navigation Tabs */}
        <nav aria-label="主导航" className="grid grid-cols-5 md:flex md:items-center gap-1 sm:gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-label={`${tab.label}${tab.badge ? `，${tab.badge} 个词条` : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`relative flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 min-h-12 md:min-h-11 min-w-0 px-1 md:px-3 py-1.5 text-[11px] md:text-sm font-medium transition-all rounded-sm ${
                  isActive
                    ? 'text-[#292B25] bg-[#E5DED0] border-b-2 border-[#62694D]'
                    : tab.disabled
                    ? 'text-[#A5AA91] opacity-50 cursor-not-allowed'
                    : 'text-[#555848] hover:text-[#292B25] hover:bg-[#E5DED0]/50'
                }`}
              >
                <Icon aria-hidden="true" className="w-4 h-4 shrink-0" />
                <span className="text-center leading-tight break-words">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span aria-hidden="true" className="absolute top-0 right-0 md:static md:ml-1 px-1.5 text-[10px] rounded-full bg-[#B49379] text-[#292B25] font-semibold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
