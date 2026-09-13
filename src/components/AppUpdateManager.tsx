import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, Loader2, RefreshCw, X } from 'lucide-react';

type UpdateStatus = 'idle' | 'checking' | 'current' | 'available' | 'updating' | 'error';

function isMobileOrTablet(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const nav = navigator as Navigator & {
    standalone?: boolean;
    userAgentData?: { mobile?: boolean };
  };
  const touchMac = /Macintosh|MacIntel/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(
    navigator.userAgent
  );
  const coarseTablet = window.matchMedia('(pointer: coarse) and (max-width: 1366px)').matches;

  return Boolean(nav.userAgentData?.mobile || nav.standalone || touchMac || mobileUserAgent || coarseTablet);
}

export const AppUpdateManager: React.FC = () => {
  const [isEligibleDevice, setIsEligibleDevice] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const applyingUpdateRef = useRef(false);
  const reloadingRef = useRef(false);

  const markUpdateAvailable = useCallback((worker: ServiceWorker) => {
    waitingWorkerRef.current = worker;
    setStatus('available');
  }, []);

  useEffect(() => {
    setIsEligibleDevice(isMobileOrTablet());
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !isEligibleDevice || !('serviceWorker' in navigator)) return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    let updateFoundHandler: (() => void) | null = null;

    const watchInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (disposed || worker.state !== 'installed') return;
        if (navigator.serviceWorker.controller) {
          markUpdateAvailable(registration?.waiting || worker);
        } else {
          setStatus('idle');
        }
      });
    };

    const checkSilently = () => {
      registrationRef.current?.update().catch(() => {
        // A temporary offline state should not interrupt the learning interface.
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkSilently();
    };

    const handleControllerChange = () => {
      if (!applyingUpdateRef.current || reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    }).then((registered) => {
      if (disposed) return;
      registration = registered;
      registrationRef.current = registered;

      if (registered.waiting && navigator.serviceWorker.controller) {
        markUpdateAvailable(registered.waiting);
      }

      updateFoundHandler = () => watchInstallingWorker(registered.installing);
      registered.addEventListener('updatefound', updateFoundHandler);
      checkSilently();
    }).catch(() => {
      if (!disposed) setStatus('error');
    });

    const intervalId = window.setInterval(checkSilently, 60 * 60 * 1000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (registration && updateFoundHandler) {
        registration.removeEventListener('updatefound', updateFoundHandler);
      }
    };
  }, [isEligibleDevice, markUpdateAvailable]);

  const checkForUpdate = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      setStatus('error');
      return;
    }

    setStatus('checking');
    try {
      const registration = registrationRef.current ||
        await navigator.serviceWorker.getRegistration('/');
      if (!registration) {
        setStatus('error');
        return;
      }

      registrationRef.current = registration;
      await registration.update();
      if (registration.waiting) {
        markUpdateAvailable(registration.waiting);
      } else if (!registration.installing) {
        setStatus('current');
      }
    } catch {
      setStatus('error');
    }
  }, [markUpdateAvailable]);

  const applyUpdate = useCallback(() => {
    const worker = waitingWorkerRef.current || registrationRef.current?.waiting;
    if (!worker) {
      void checkForUpdate();
      return;
    }

    applyingUpdateRef.current = true;
    setStatus('updating');
    worker.postMessage({ type: 'SKIP_WAITING' });

    // Safari may delay controllerchange; reload as a safe fallback.
    window.setTimeout(() => {
      if (!reloadingRef.current) window.location.reload();
    }, 5000);
  }, [checkForUpdate]);

  if (!isEligibleDevice || !('serviceWorker' in navigator)) return null;

  return (
    <>
      <div className="flex items-center justify-center gap-2 pt-1 font-ui text-[11px] text-[#717265]">
        <button
          type="button"
          onClick={() => void checkForUpdate()}
          disabled={status === 'checking' || status === 'updating'}
          className="inline-flex items-center gap-1.5 hover:text-[#292B25] disabled:opacity-60 transition-colors"
        >
          {status === 'checking' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : status === 'current' ? (
            <Check className="w-3 h-3" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {status === 'checking'
            ? '正在检查更新…'
            : status === 'current'
              ? '已是最新版本'
              : status === 'error'
                ? '检查失败，点击重试'
                : '检查软件更新'}
        </button>
      </div>

      {(status === 'available' || status === 'updating') && (
        <div className="fixed z-50 left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:w-96 bg-[#FAF7F2] border border-[#73785E]/40 rounded-sm shadow-xl p-4 font-ui">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-[#73785E]/15 flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-[#5F654D]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#292B25]">发现 Mine English 新版本</p>
              <p className="text-xs text-[#717265] mt-1 leading-relaxed">
                更新后会自动重新打开，生词本和阅读记录不会被清除。
              </p>
              <button
                type="button"
                onClick={applyUpdate}
                disabled={status === 'updating'}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#73785E] text-[#F2EEE4] rounded-sm text-xs font-medium disabled:opacity-60"
              >
                {status === 'updating' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {status === 'updating' ? '正在更新…' : '立即更新'}
              </button>
            </div>
            {status !== 'updating' && (
              <button
                type="button"
                onClick={() => setStatus('idle')}
                aria-label="稍后更新"
                className="text-[#717265] hover:text-[#292B25]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
