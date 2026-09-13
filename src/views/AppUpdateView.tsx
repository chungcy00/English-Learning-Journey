import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { APP_VERSION, CURRENT_RELEASE_NOTES, VERSION_HISTORY_COUNT } from '../version';

type UpdateStatus = 'checking' | 'current' | 'available' | 'updating' | 'error';

export const AppUpdateView: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus>('checking');
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const applyingUpdateRef = useRef(false);
  const reloadingRef = useRef(false);

  const markUpdateAvailable = useCallback((worker: ServiceWorker) => {
    waitingWorkerRef.current = worker;
    setStatus('available');
  }, []);

  const checkForUpdate = useCallback(async (showChecking = true) => {
    if (!('serviceWorker' in navigator)) {
      setStatus('error');
      return;
    }

    if (showChecking) setStatus('checking');
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

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
      setStatus('current');
      return;
    }

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
          setStatus('current');
        }
      });
    };

    const handleControllerChange = () => {
      if (!applyingUpdateRef.current || reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    }).then((registered) => {
      if (disposed) return;
      registration = registered;
      registrationRef.current = registered;

      if (registered.waiting && navigator.serviceWorker.controller) {
        markUpdateAvailable(registered.waiting);
      } else {
        void checkForUpdate(false);
      }

      updateFoundHandler = () => watchInstallingWorker(registered.installing);
      registered.addEventListener('updatefound', updateFoundHandler);
    }).catch(() => {
      if (!disposed) setStatus('error');
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForUpdate(false);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = window.setInterval(() => void checkForUpdate(false), 60 * 60 * 1000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (registration && updateFoundHandler) {
        registration.removeEventListener('updatefound', updateFoundHandler);
      }
    };
  }, [checkForUpdate, markUpdateAvailable]);

  const applyUpdate = () => {
    const worker = waitingWorkerRef.current || registrationRef.current?.waiting;
    if (!worker) {
      void checkForUpdate();
      return;
    }

    applyingUpdateRef.current = true;
    setStatus('updating');
    worker.postMessage({ type: 'SKIP_WAITING' });
    window.setTimeout(() => {
      if (!reloadingRef.current) window.location.reload();
    }, 5000);
  };

  const statusContent = {
    checking: { icon: Loader2, title: '正在检测软件版本', detail: '正在连接服务器检查更新。' },
    current: { icon: CheckCircle2, title: '当前已是最新版本', detail: `Mine English ${APP_VERSION} 无需更新。` },
    available: { icon: Download, title: '发现新版本', detail: `当前安装版本为 ${APP_VERSION}，新版本已经准备好。` },
    updating: { icon: Loader2, title: '正在更新软件', detail: '完成后将自动重新打开，请稍候。' },
    error: { icon: RefreshCw, title: '暂时无法检查更新', detail: '请检查网络连接后重试。' },
  }[status];
  const StatusIcon = statusContent.icon;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="pb-5 border-b border-[#D4CCBC]">
        <div className="flex items-center gap-2 text-[#73785E] mb-2">
          <ShieldCheck className="w-5 h-5" />
          <span className="font-ui text-xs uppercase tracking-wider font-semibold">Installed App</span>
          <span className="font-ui text-xs px-2 py-0.5 rounded-full bg-[#73785E]/15 text-[#5F654D] font-semibold">
            {APP_VERSION}
          </span>
        </div>
        <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#292B25]">
          软件检测与更新
        </h1>
        <p className="font-ui text-sm text-[#717265] mt-2">
          此页面仅在已安装的手机或平板软件中显示。
        </p>
      </div>

      <div className="mt-7 bg-[#FAF7F2] border border-[#D4CCBC] rounded-sm p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[#73785E]/15 flex items-center justify-center flex-shrink-0">
            <StatusIcon
              className={`w-6 h-6 text-[#5F654D] ${status === 'checking' || status === 'updating' ? 'animate-spin' : ''}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-ui text-base font-semibold text-[#292B25]">{statusContent.title}</h2>
            <p className="font-ui text-sm text-[#717265] mt-1">{statusContent.detail}</p>
            <p className="font-ui text-xs text-[#717265] mt-3 leading-relaxed">
              更新软件不会删除生词本、短文记录或复习进度。
            </p>

            <div className="mt-5 pt-4 border-t border-[#D4CCBC]/70">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-ui text-sm font-semibold text-[#292B25]">
                  {APP_VERSION} 更新内容
                </h3>
                <span className="font-ui text-[10px] text-[#717265]">
                  共 {VERSION_HISTORY_COUNT} 个版本
                </span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {CURRENT_RELEASE_NOTES.map((note) => (
                  <li key={note} className="font-ui text-xs leading-relaxed text-[#717265] flex gap-2">
                    <span className="text-[#73785E]" aria-hidden="true">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 mt-5">
              {status === 'available' ? (
                <button
                  type="button"
                  onClick={applyUpdate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#73785E] text-[#F2EEE4] rounded-sm text-sm font-ui font-medium"
                >
                  <Download className="w-4 h-4" />
                  立即更新
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void checkForUpdate()}
                  disabled={status === 'checking' || status === 'updating'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#73785E] text-[#5F654D] rounded-sm text-sm font-ui font-medium disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  重新检查
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
