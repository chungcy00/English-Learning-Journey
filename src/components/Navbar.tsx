import React from 'react';
import { BookOpen, Bookmark, RotateCcw, Settings as SettingsIcon, Sparkles } from 'lucide-react';

import { getI18nText } from '../utils/i18n';

export type NavTab = 'home' | 'reading' | 'wordbook' | 'review';

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
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#F2EEE4]/90 backdrop-blur-sm border-b border-[#D4CCBC] px-4 sm:px-8 py-3.5 transition-colors">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand & Editorial Title */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 text-left focus:outline-none group"
        >
          <img
            src="/site-icon.png"
            alt=""
            aria-hidden="true"
            className="w-10 h-10 object-contain flex-shrink-0"
          />
          <div>
            <h1 className="font-editorial text-xl sm:text-2xl font-semibold text-[#292B25] tracking-tight group-hover:text-[#5F654D] transition-colors">
              Mine English
            </h1>
            <p className="text-[11px] text-[#717265] tracking-wide uppercase font-ui">
              Humanised Contextual Reader
            </p>
          </div>
        </button>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium transition-all rounded-sm ${
                  isActive
                    ? 'text-[#292B25] bg-[#E5DED0] border-b-2 border-[#73785E]'
                    : tab.disabled
                    ? 'text-[#A5AA91] opacity-50 cursor-not-allowed'
                    : 'text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0]/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-[#B49379] text-[#F2EEE4] font-semibold">
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
