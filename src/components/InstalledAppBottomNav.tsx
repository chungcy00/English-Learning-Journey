import React from 'react';
import { BookOpen, Bookmark, History, Sparkles } from 'lucide-react';
import { NavTab } from './Navbar';

interface InstalledAppBottomNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  reviewCount: number;
  hasCurrentReading: boolean;
}

export const InstalledAppBottomNav: React.FC<InstalledAppBottomNavProps> = ({
  activeTab,
  setActiveTab,
  reviewCount,
  hasCurrentReading,
}) => {
  const tabs = [
    { id: 'home' as NavTab, label: '生成', icon: Sparkles },
    { id: 'reading' as NavTab, label: '阅读', icon: BookOpen, disabled: !hasCurrentReading },
    { id: 'practice' as NavTab, label: '练习与生词', icon: Bookmark, badge: reviewCount },
    { id: 'history' as NavTab, label: '历史', icon: History },
  ];

  return (
    <nav
      aria-label="软件主导航"
      className="installed-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--surface-paper)]/95 backdrop-blur-md shadow-[0_-4px_18px_rgba(41,43,37,0.08)]"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-4 px-1 pt-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === 'practice' && (activeTab === 'wordbook' || activeTab === 'rewrite'));
          return (
            <button
              key={tab.id}
              type="button"
              aria-label={`${tab.label}${tab.badge !== undefined ? `，${tab.badge} 个词条` : ''}`}
              onClick={() => setActiveTab(tab.id)}
              disabled={tab.disabled}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg font-ui transition-colors ${
                isActive
                  ? 'text-[var(--accent-primary)]'
                  : tab.disabled
                    ? 'text-[var(--accent-secondary)] opacity-45'
                    : 'text-[var(--text-secondary)] active:bg-[var(--bg-alt)]/70'
              }`}
            >
              <span className={`relative flex h-7 min-w-11 items-center justify-center rounded-full ${
                isActive ? 'bg-[var(--surface-selected)]' : ''
              }`}>
                <Icon aria-hidden="true" className={`h-5 w-5 ${isActive ? 'stroke-[2.4]' : ''}`} />
                {tab.badge !== undefined && tab.badge > 0 ? (
                  <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[var(--accent-warm)] px-1 text-[length:var(--type-meta)] leading-[1.4] font-semibold leading-4 text-[var(--text-primary)]">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                ) : null}
              </span>
              <span className={`text-[length:var(--type-meta)] leading-[1.4] leading-4 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
