import React from 'react';
import { Languages } from 'lucide-react';

interface LanguageSelectorProps {
  targetLanguage: string;
  onLanguageChange: (lang: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ targetLanguage, onLanguageChange }) => {
  return (
    <div className="select-with-icon inline-flex items-center">
      <Languages aria-hidden="true" className="w-4 h-4 text-[#555848]" />
      <select
        aria-label="选择释义语言"
        value={targetLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="pl-9 pr-8 py-2 bg-[#F2EEE4] hover:bg-[#E5DED0] border border-[#D4CCBC] text-xs font-ui text-[#292B25] rounded-sm appearance-none cursor-pointer transition-colors focus:outline-none focus:border-[#62694D]"
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
