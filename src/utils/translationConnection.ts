declare const __APP_RELEASE__: string;

interface ConnectionCheck {
  origin: string;
  release: string;
  fetcher: typeof fetch;
  timeoutMs: number;
}

// A failed POST may already have reached the provider. Probe a free GET rather
// than automatically repeating an AI request and potentially charging twice.
export async function translationConnectionMessage(signal?: AbortSignal, options?: Partial<ConnectionCheck>): Promise<string> {
  signal?.throwIfAborted();
  const origin = options?.origin ?? (typeof window === 'undefined' ? '' : window.location.origin);
  const release = options?.release ?? (typeof __APP_RELEASE__ === 'string' ? __APP_RELEASE__ : 'local');
  const fetcher = options?.fetcher ?? fetch;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let onAbort: () => void;
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => { controller.abort(); reject(signal?.reason ?? new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => { reject(new Error('connection-check-timeout')); controller.abort(); }, options?.timeoutMs ?? 5000);
  });
  let status: string;
  try {
    status = await Promise.race([
      (async () => {
        const response = await fetcher('/api/health', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return `站点返回 HTTP ${response.status}`;
        const body = await response.json();
        return body?.status === 'ok' ? '站点可达，翻译连接中断' : '入口未返回预期服务';
      })(),
      interrupted,
    ]);
  } catch (error) {
    signal?.throwIfAborted();
    status = error instanceof Error && error.message === 'connection-check-timeout' ? '连接检查超时' : '当前入口无法连接服务';
  } finally {
    clearTimeout(timer!);
    signal?.removeEventListener('abort', onAbort!);
  }
  return `翻译连接失败。${status}。入口：${origin}；版本：${release}。已有译文会保留，请将此提示反馈给我们。`;
}
