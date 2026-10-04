// Stable installed-app shell; worker activation alone must never change it.
export function buildAppWorker(version: string, buildId: string, assets: string[], entry: string) {
  return `const APP_VERSION = ${JSON.stringify(version)};
const APP_BUILD_ID = ${JSON.stringify(buildId)};
const BUILD_CACHE = 'mine-english-build-' + APP_BUILD_ID;
const POINTER_CACHE = 'mine-english-installed-shell';
const POINTER_URL = new URL('/__installed-shell', self.location.origin).href;
const ASSETS = ${JSON.stringify(assets)};
const ENTRY = ${JSON.stringify(entry)};
async function readPin() {
  const response = await (await caches.open(POINTER_CACHE)).match(POINTER_URL);
  return response ? response.json() : null;
}
async function pinBuild() {
  if (!(await (await caches.open(BUILD_CACHE)).match('/'))) throw new Error('Incomplete app shell');
  await (await caches.open(POINTER_CACHE)).put(POINTER_URL, new Response(JSON.stringify({ cache: BUILD_CACHE, buildId: APP_BUILD_ID })));
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(BUILD_CACHE);
    const html = await fetch('/', { cache: 'no-store' });
    if (!html.ok || !(await html.clone().text()).includes(ENTRY)) throw new Error('Deployment is not ready');
    await cache.addAll(ASSETS);
    await cache.put('/', html);
    if (!(await readPin())) await pinBuild();
    const pin = await readPin();
    for (const name of await caches.keys()) {
      if (name.startsWith('mine-english-build-') && name !== BUILD_CACHE && name !== pin.cache) await caches.delete(name);
    }
  })());
});
self.addEventListener('activate', event => {
  // Even if a waiting worker activates after all windows close, retain the pin.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil((async () => {
      try { await pinBuild(); await self.skipWaiting(); event.ports[0]?.postMessage({ ok: true }); }
      catch { event.ports[0]?.postMessage({ ok: false }); }
    })());
  }
  if (event.data?.type === 'GET_UPDATE_STATE') {
    event.waitUntil(readPin().then(pin => event.ports[0]?.postMessage({ hasUpdate: Boolean(pin && pin.buildId !== APP_BUILD_ID), version: APP_VERSION })));
  }
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && url.searchParams.get('app') === 'installed') {
    event.respondWith((async () => {
      const pin = await readPin();
      const shell = pin && await (await caches.open(pin.cache)).match('/');
      return shell || fetch(event.request);
    })());
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const pin = await readPin();
      return (pin && await (await caches.open(pin.cache)).match(event.request)) ||
        await (await caches.open(BUILD_CACHE)).match(event.request) || fetch(event.request);
    })());
  }
});
`;
}
