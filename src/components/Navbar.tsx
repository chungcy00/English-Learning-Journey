import React from 'react';
import { BookOpen, Bookmark, History, Sparkles } from 'lucide-react';

export type NavTab = 'home' | 'reading' | 'history' | 'practice' | 'wordbook' | 'rewrite';

interface NavbarProps {
  activeTab: NavTab | 'settings'; // keep 'settings' literal here just in case App passes it
  setActiveTab: (tab: NavTab | 'settings') => void;
  reviewCount: number;
  hasCurrentReading: boolean;
  targetLanguage: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  reviewCount,
  hasCurrentReading,
  targetLanguage,
}) => {
  const tabs = [
    { id: 'home' as NavTab, label: targetLanguage === 'zh-CN' ? '生成短文' : targetLanguage === 'zh-TW' ? '生成短文' : targetLanguage === 'ja' ? '文章生成' : targetLanguage === 'ko' ? '지문 생성' : targetLanguage === 'es' ? 'Generar' : targetLanguage === 'fr' ? 'Générer' : targetLanguage === 'de' ? 'Generieren' : targetLanguage === 'vi' ? 'Tạo bài' : targetLanguage === 'ru' ? 'Генерация' : 'Generate', icon: Sparkles },
    { id: 'reading' as NavTab, label: targetLanguage === 'zh-CN' ? '当前阅读' : targetLanguage === 'zh-TW' ? '當前閱讀' : targetLanguage === 'ja' ? '現在の文章' : targetLanguage === 'ko' ? '현재 읽기' : targetLanguage === 'es' ? 'Lectura actual' : targetLanguage === 'fr' ? 'Lecture' : targetLanguage === 'de' ? 'Aktuell' : targetLanguage === 'vi' ? 'Đang đọc' : targetLanguage === 'ru' ? 'Текущее' : 'Reading', icon: BookOpen, disabled: !hasCurrentReading },
    { id: 'practice' as NavTab, label: targetLanguage === 'zh-TW' ? '練習與生詞' : targetLanguage === 'zh-CN' ? '练习与生词' : 'Practice & Wordbook', icon: Bookmark, badge: reviewCount },
    { id: 'history' as NavTab, label: '历史记录', icon: History },
  ];

  return (
    <header className="app-header sticky top-0 z-30 bg-[var(--bg-primary)]/90 backdrop-blur-sm border-b border-[var(--border-subtle)] px-4 sm:px-6 lg:px-8 py-3.5 transition-colors">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 lg:gap-4">
        {/* Brand & Editorial Title */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 min-h-11 text-left group self-start shrink-0"
        >
          <img
            src="/site-icon.png"
            alt=""
            aria-hidden="true"
            className="w-10 h-10 object-contain flex-shrink-0"
          />
          <div>
            <span className="font-editorial text-[length:var(--type-section)] leading-[1.3]  font-semibold text-[var(--text-primary)] tracking-tight group-hover:text-[var(--accent-vocab)] transition-colors">
              Mine English
            </span>
          </div>
        </button>

        {/* Navigation Tabs */}
        <nav aria-label="主导航" className="grid grid-cols-4 lg:flex lg:items-center gap-1 sm:gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id || (tab.id === 'practice' && (activeTab === 'wordbook' || activeTab === 'rewrite'));
            return (
              <button
                key={tab.id}
                type="button"
                aria-label={`${tab.label}${tab.badge ? `，${tab.badge} 个词条` : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`relative flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-1.5 min-h-12 lg:min-h-11 min-w-0 px-1 lg:px-3 py-1.5 text-[length:var(--type-meta)] leading-[1.4]  font-medium transition-colors rounded-sm ${
                  isActive
                    ? 'text-[var(--accent-primary)] bg-[var(--surface-selected)] border-b-2 border-[var(--accent-primary)]'
                    : tab.disabled
                    ? 'text-[var(--accent-secondary)] opacity-50 cursor-not-allowed'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-alt)]/50'
                }`}
              >
                <Icon aria-hidden="true" className="w-4 h-4 shrink-0" />
                <span className="text-center leading-[1.4] break-words">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span aria-hidden="true" className="absolute top-0 right-0 lg:static lg:ml-1 px-1.5 text-[length:var(--type-meta)] leading-[1.4] rounded-full bg-[var(--accent-warm)] text-[var(--text-primary)] font-semibold">
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
