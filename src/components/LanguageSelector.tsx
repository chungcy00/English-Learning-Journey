import React from 'react';
import { Languages } from 'lucide-react';

interface LanguageSelectorProps {
  targetLanguage: string;
  onLanguageChange: (lang: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ targetLanguage, onLanguageChange }) => {
  return (
    <div className="relative inline-flex items-center">
      <div className="absolute left-3 text-[#717265] pointer-events-none">
        <Languages className="w-4 h-4" />
      </div>
      <select
        value={targetLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="pl-9 pr-8 py-2 bg-[#F2EEE4] hover:bg-[#E5DED0] border border-[#D4CCBC] text-xs font-ui text-[#292B25] rounded-sm appearance-none cursor-pointer transition-colors focus:outline-none focus:border-[#73785E]"
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
      <div className="absolute right-3 text-[#717265] pointer-events-none">
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
};
