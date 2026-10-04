import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildAppWorker } from './appWorker';

function harness() {
  const storage = new Map<string, Map<string, Response>>();
  const key = (value: any) => new URL(typeof value === 'string' ? value : value.url, 'https://app.test').href;
  let deployed = 'one';
  const fetch = async (request: any) => new Response(key(request).endsWith('/') ? `<script src="/assets/${deployed}.js"></script>` : `resource:${key(request)}`);
  const caches = {
    async keys() { return [...storage.keys()]; },
    async delete(name: string) { return storage.delete(name); },
    async open(name: string) {
      if (!storage.has(name)) storage.set(name, new Map());
      const data = storage.get(name)!;
      return {
        async match(url: any) { return data.get(key(url))?.clone(); },
        async put(url: any, response: Response) { data.set(key(url), response.clone()); },
        async addAll(urls: string[]) { for (const url of urls) data.set(key(url), await fetch(url)); },
      };
    },
  };
  function worker(build: string) {
    const listeners: Record<string, (event: any) => void> = {};
    let skips = 0;
    const self = { location: { origin: 'https://app.test' }, clients: { async claim() {} }, async skipWaiting() { skips++; },
      addEventListener(type: string, handler: any) { listeners[type] = handler; } };
    vm.runInNewContext(buildAppWorker(build, build, [`/assets/${build}.js`], `assets/${build}.js`), { self, caches, fetch, URL, Response });
    const dispatch = async (type: string, extra = {}) => {
      let work: Promise<any> | undefined;
      listeners[type]({ ...extra, waitUntil(promise: Promise<any>) { work = promise; } });
      await work;
    };
    return { dispatch, skips: () => skips,
      async message(type: string) { let result: any; await dispatch('message', { data: { type }, ports: [{ postMessage(data: any) { result = data; } }] }); return result; },
      async navigate(url: string) {
        let response: Promise<Response> | undefined;
        listeners.fetch({ request: { url, mode: 'navigate', method: 'GET' }, respondWith(promise: Promise<Response>) { response = promise; } });
        return response ? (await response).text() : null;
      },
    };
  }
  return { worker, deploy: (build: string) => { deployed = build; } };
}

test('background install and activation preserve the installed shell until explicit approval', async () => {
  const h = harness();
  const first = h.worker('one'); await first.dispatch('install'); await first.dispatch('activate');
  assert.match((await first.navigate('https://app.test/?app=installed'))!, /one.js/);
  h.deploy('two'); const next = h.worker('two'); await next.dispatch('install');
  await next.dispatch('activate'); // Browser may activate after every window closes.
  assert.equal(next.skips(), 0);
  assert.match((await next.navigate('https://app.test/?app=installed'))!, /one.js/);
  assert.equal((await next.message('GET_UPDATE_STATE')).hasUpdate, true);
  // Checking alone cannot commit an update.
  assert.match((await next.navigate('https://app.test/?app=installed'))!, /one.js/);
  assert.equal((await next.message('SKIP_WAITING')).ok, true);
  assert.equal(next.skips(), 1);
  assert.match((await next.navigate('https://app.test/?app=installed'))!, /two.js/);
  assert.equal((await next.message('GET_UPDATE_STATE')).hasUpdate, false);
});

test('normal browser navigation is not pinned and a mismatched deployment does not replace the shell', async () => {
  const h = harness(); const first = h.worker('one'); await first.dispatch('install');
  assert.equal(await first.navigate('https://app.test/'), null);
  const next = h.worker('two'); // HTML still references build one.
  await assert.rejects(next.dispatch('install'), /Deployment is not ready/);
  assert.match((await first.navigate('https://app.test/?app=installed'))!, /one.js/);
});
