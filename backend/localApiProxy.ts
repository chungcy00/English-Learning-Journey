import type { RequestHandler } from 'express';

/** Explicit development-only forwarding; protected production endpoints remain authoritative. */
export function localApiProxy(env: Record<string, string | undefined>, fetcher: typeof fetch = fetch): RequestHandler | null {
  const source = env.LOCAL_AI_API_ORIGIN?.trim();
  if (!source || env.NODE_ENV === 'production') return null;
  const upstream = new URL(source);
  if (upstream.protocol !== 'https:' || upstream.username || upstream.password || upstream.pathname !== '/' || upstream.search || upstream.hash) throw new Error('LOCAL_AI_API_ORIGIN must be an HTTPS origin without credentials or a path.');
  const routes = new Set(['/api/reading/generate', '/api/reading/translate', '/api/vocabulary/explain']);
  return async (req, res, next) => {
    if (!(req.method === 'POST' && routes.has(req.path)) && !(req.method === 'GET' && req.path === '/api/health')) return next();
    try {
      const response = await fetcher(new URL(req.path, upstream), {
        method: req.method, redirect: 'error', signal: AbortSignal.timeout(55_000),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        ...(req.method === 'POST' ? { body: JSON.stringify(req.body) } : {}),
      });
      for (const name of ['content-type', 'retry-after', 'cache-control']) {
        const value = response.headers.get(name); if (value) res.setHeader(name, value);
      }
      res.status(response.status).send(await response.text());
    } catch {
      res.status(502).json({ error: '开发环境暂时无法连接现有 AI 服务，请稍后重试。已有资料已保留。' });
    }
  };
}
