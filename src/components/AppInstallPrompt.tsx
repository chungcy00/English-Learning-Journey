import React, { useEffect, useRef, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { isAppleMobileDevice, isMobileOrTablet, isStandaloneApp } from '../utils/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'mine_english_install_prompt_dismissed';

export const AppInstallPrompt: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [nativePrompt, setNativePrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const isAppleDevice = isAppleMobileDevice();

  useEffect(() => {
    if (!isMobileOrTablet() || isStandaloneApp()) return;
    if (sessionStorage.getItem(DISMISSED_KEY) === 'true') return;

    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      }).catch(() => {
        // Installation instructions can still be useful when registration fails temporarily.
      });
    }

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
      setNativePrompt(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    const handleInstalled = () => {
      setIsVisible(false);
      setNativePrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    // iOS does not expose beforeinstallprompt. Other mobile browsers may also
    // require installation through their menu, so show clear fallback guidance.
    fallbackTimerRef.current = window.setTimeout(() => setIsVisible(true), 1400);

    return () => {
      if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, 'true');
    setIsVisible(false);
  };

  const install = async () => {
    if (!nativePrompt) return;
    await nativePrompt.prompt();
    const choice = await nativePrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsVisible(false);
    }
    setNativePrompt(null);
  };

  if (!isVisible || isStandaloneApp()) return null;

  return (
    <div
      role="dialog"
      aria-label="安装 Mine English 软件"
      className="fixed z-50 left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:w-[25rem] bg-[#FAF7F2] border border-[#73785E]/40 rounded-sm shadow-xl p-4 font-ui"
    >
      <div className="flex items-start gap-3">
        <img src="/site-icon.png" alt="" className="w-12 h-12 object-contain flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#292B25]">安装 Mine English 软件</p>
          <p className="text-xs text-[#717265] mt-1 leading-relaxed">
            添加到手机或平板主屏幕，之后可以像普通软件一样打开。
          </p>

          {nativePrompt ? (
            <button
              type="button"
              onClick={() => void install()}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#73785E] text-[#F2EEE4] rounded-sm text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              安装软件
            </button>
          ) : (
            <div className="mt-3 flex items-start gap-2 text-xs text-[#5F654D] bg-[#E5DED0]/60 px-3 py-2 rounded-sm">
              <Share className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                {isAppleDevice
                  ? '请点击浏览器的“分享”按钮，再选择“添加到主屏幕”。'
                  : '请打开浏览器菜单，再选择“安装应用”或“添加到主屏幕”。'}
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="关闭安装提示"
          className="text-[#717265] hover:text-[#292B25]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
