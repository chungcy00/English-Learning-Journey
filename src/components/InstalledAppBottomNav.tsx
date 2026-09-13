import React from 'react';
import { BookOpen, Bookmark, History, RotateCcw, Smartphone, Sparkles } from 'lucide-react';
import { NavTab } from './Navbar';

interface InstalledAppBottomNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  reviewDueCount: number;
  hasCurrentReading: boolean;
}

export const InstalledAppBottomNav: React.FC<InstalledAppBottomNavProps> = ({
  activeTab,
  setActiveTab,
  reviewDueCount,
  hasCurrentReading,
}) => {
  const tabs = [
    { id: 'home' as NavTab, label: '生成', icon: Sparkles },
    { id: 'reading' as NavTab, label: '阅读', icon: BookOpen, disabled: !hasCurrentReading },
    { id: 'history' as NavTab, label: '历史', icon: History },
    { id: 'wordbook' as NavTab, label: '生词本', icon: Bookmark },
    { id: 'review' as NavTab, label: '复习', icon: RotateCcw, badge: reviewDueCount },
    { id: 'update' as NavTab, label: '更新', icon: Smartphone },
  ];

  return (
    <nav
      aria-label="软件主导航"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D4CCBC] bg-[#FAF7F2]/95 backdrop-blur-md shadow-[0_-4px_18px_rgba(41,43,37,0.08)]"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-6 px-1 pt-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              disabled={tab.disabled}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg font-ui transition-colors ${
                isActive
                  ? 'text-[#292B25]'
                  : tab.disabled
                    ? 'text-[#A5AA91] opacity-45'
                    : 'text-[#858679] active:bg-[#E5DED0]/70'
              }`}
            >
              <span className={`relative flex h-7 min-w-11 items-center justify-center rounded-full ${
                isActive ? 'bg-[#73785E]/15' : ''
              }`}>
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.4]' : ''}`} />
                {tab.badge !== undefined && tab.badge > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#B49379] px-1 text-[9px] font-semibold leading-4 text-[#FAF7F2]">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                ) : null}
              </span>
              <span className={`text-[10px] leading-4 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
