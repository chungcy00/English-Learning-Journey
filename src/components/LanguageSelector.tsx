import React from 'react';
import { Languages } from 'lucide-react';

interface LanguageSelectorProps {
  targetLanguage: string;
  onLanguageChange: (lang: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ targetLanguage, onLanguageChange }) => {
  return (
    <div className="select-with-icon inline-flex items-center">
      <Languages aria-hidden="true" className="w-4 h-4 text-[var(--text-secondary)]" />
      <select
        aria-label="选择释义语言"
        value={targetLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="pl-9 pr-8 py-2 bg-[var(--bg-primary)] hover:bg-[var(--bg-alt)] border border-[var(--border-subtle)] text-xs font-ui text-[var(--text-primary)] rounded-sm appearance-none cursor-pointer transition-colors focus:outline-none focus:border-[var(--accent-primary)]"
      >
        <option value="zh-CN">🇨🇳 中文 (简体)</option>
        <option value="zh-TW">🇹🇼 中文 (繁體)</option>
        <option value="es">🇪🇸 Español</option>
        <option value="ja">🇯🇵 日本語</option>
        <option value="ko">🇰🇷 한국어</option>
        <option value="fr">🇫🇷 Français</option>
        <option value="de">🇩🇪 Deutsch</option>
        <option value="vi">🇻🇳 Tiếng Việt</option>
        <option value="ru">🇷🇺 Русский</option>
      </select>
    </div>
  );
};
