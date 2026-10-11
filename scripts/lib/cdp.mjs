// Minimal Chrome DevTools Protocol client. Drives a locally installed Chrome, Chromium, Edge or Brave in
// headless mode, so the collector needs no npm packages. Needs Node 22+ (global WebSocket and fetch).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/usr/bin/microsoft-edge'],
  win32: [
    `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ],
};

export function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  return (CANDIDATES[process.platform] || []).find((p) => p && existsSync(p)) || null;
}

export const VIEWPORTS = {
  phone: {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, userAgent: null },
};

export class Browser {
  static async launch() {
    const bin = findChrome();
    if (!bin) throw new Error('No Chrome, Chromium, Edge or Brave found. Install Google Chrome or set CHROME_PATH.');
    const dir = mkdtempSync(join(tmpdir(), 'saa-chrome-'));
    const args = [
      '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check',
      '--hide-scrollbars', '--mute-audio', '--disable-extensions', '--disable-sync', '--disable-background-networking',
      '--disable-features=Translate,OptimizationHints,MediaRouter', 'about:blank',
    ];
    if (process.platform === 'linux' && process.getuid?.() === 0) args.unshift('--no-sandbox');
    const proc = spawn(bin, args, { stdio: 'ignore' });
    let ws = null;
    for (let i = 0; i < 150 && !ws; i++) {
      try {
        const [port, path] = readFileSync(join(dir, 'DevToolsActivePort'), 'utf8').trim().split('\n');
        if (port && path) ws = `ws://127.0.0.1:${port}${path}`;
      } catch {}
      if (!ws) await sleep(100);
    }
    if (!ws) { proc.kill(); throw new Error('Chrome did not start (no DevToolsActivePort).'); }
    const b = new Browser(proc, dir);
    await b.#connect(ws);
    const v = await b.send('Browser.getVersion');
    b.version = v.product;
    b.desktopUA = (v.userAgent || '').replace(/HeadlessChrome/g, 'Chrome');
    return b;
  }

  constructor(proc, dir) {
    this.proc = proc; this.dir = dir; this.id = 0; this.pending = new Map(); this.listeners = new Set();
  }

  async #connect(url) {
    this.ws = new WebSocket(url);
    await new Promise((res, rej) => { this.ws.addEventListener('open', res, { once: true }); this.ws.addEventListener('error', rej, { once: true }); });
    this.ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); }
      else if (m.method) for (const l of this.listeners) { try { l(m); } catch {} }
    });
  }

  // Resolves to `result`; on protocol error or timeout resolves to { __error } instead of throwing.
  send(method, params = {}, sessionId = undefined, timeout = 30000) {
    return new Promise((res) => {
      const id = ++this.id;
      const t = setTimeout(() => { this.pending.delete(id); res({ __error: `timeout ${method}` }); }, timeout);
      this.pending.set(id, (m) => { clearTimeout(t); res(m.error ? { __error: m.error.message } : m.result); });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  // A fresh browser context has its own cookies and storage: a new visitor with an empty cart.
  async newPage(viewport = 'desktop', { isolated = true } = {}) {
    let browserContextId;
    if (isolated) browserContextId = (await this.send('Target.createBrowserContext', { disposeOnDetach: true })).browserContextId;
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank', ...(browserContextId ? { browserContextId } : {}) });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this, targetId, sessionId, browserContextId, viewport);
    await page.init();
    return page;
  }

  async close() {
    try { await this.send('Browser.close', {}, undefined, 3000); } catch {}
    try { this.ws.close(); } catch {}
    try { this.proc.kill(); } catch {}
    await sleep(300);
    try { rmSync(this.dir, { recursive: true, force: true }); } catch {}
  }
}

export class Page {
  constructor(browser, targetId, sessionId, contextId, viewport) {
    Object.assign(this, { browser, targetId, sessionId, contextId, viewportName: viewport });
    this.vp = VIEWPORTS[viewport];
    this.handlers = new Map();
    this.inflight = new Set();
    this.requests = new Map();
    this.console = [];
    this.navigations = [];
    this.blocked = [];
    this.lastLoad = 0;
    this.lastNetwork = Date.now();
    this.blockRules = [];
    browser.listeners.add((m) => {
      if (m.sessionId !== this.sessionId) return;
      this.#track(m);
      for (const fn of this.handlers.get(m.method) || []) { try { fn(m.params); } catch {} }
    });
  }

  on(method, fn) { if (!this.handlers.has(method)) this.handlers.set(method, []); this.handlers.get(method).push(fn); }
  send(method, params = {}, timeout) { return this.browser.send(method, params, this.sessionId, timeout); }

  async init() {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable', { maxPostDataSize: 4096 });
    await this.send('Log.enable');
    const ua = this.vp.userAgent || this.browser.desktopUA;
    await this.send('Emulation.setDeviceMetricsOverride', { width: this.vp.width, height: this.vp.height, deviceScaleFactor: this.vp.deviceScaleFactor, mobile: this.vp.mobile });
    await this.send('Emulation.setUserAgentOverride', { userAgent: ua });
    if (this.vp.mobile) await this.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const ft = await this.send('Page.getFrameTree');
    this.mainFrameId = ft.frameTree?.frame?.id;
    // Safety net: requests matching a block rule never leave the browser (checkout, login, form posts).
    await this.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    this.on('Fetch.requestPaused', (p) => {
      const rule = this.blockRules.find((r) => r.test(p.request, p));
      if (rule) {
        this.blocked.push({ t: Date.now(), url: p.request.url, method: p.request.method, rule: rule.name });
        this.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' });
      } else this.send('Fetch.continueRequest', { requestId: p.requestId });
    });
  }

  #track(m) {
    const p = m.params;
    switch (m.method) {
      case 'Network.requestWillBeSent':
        this.inflight.add(p.requestId); this.lastNetwork = Date.now();
        this.requests.set(p.requestId, { url: p.request.url, method: p.request.method, type: p.type, t: p.timestamp, initiator: p.initiator?.type, postData: p.request.postData?.slice(0, 2000) });
        break;
      case 'Network.responseReceived': {
        const r = this.requests.get(p.requestId); if (r) { r.status = p.response.status; r.mime = p.response.mimeType; r.remote = p.response.remoteIPAddress; }
        break;
      }
      case 'Network.loadingFinished': {
        this.inflight.delete(p.requestId); this.lastNetwork = Date.now();
        const r = this.requests.get(p.requestId); if (r) r.bytes = p.encodedDataLength;
        break;
      }
      case 'Network.loadingFailed': {
        this.inflight.delete(p.requestId); this.lastNetwork = Date.now();
        const r = this.requests.get(p.requestId); if (r) { r.failed = p.errorText; r.blocked = p.blockedReason || undefined; }
        break;
      }
      case 'Page.loadEventFired': this.lastLoad = Date.now(); break;
      case 'Page.frameNavigated': if (!p.frame.parentId) this.navigations.push({ t: Date.now(), url: p.frame.url }); break;
      case 'Runtime.consoleAPICalled':
        if (p.type === 'error' || p.type === 'warning' || p.type === 'assert')
          this.console.push({ level: p.type, text: (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400), url: p.stackTrace?.callFrames?.[0]?.url });
        break;
      case 'Runtime.exceptionThrown':
        this.console.push({ level: 'exception', text: (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').slice(0, 400), url: p.exceptionDetails?.url });
        break;
      case 'Log.entryAdded':
        if ((p.entry.level === 'error' || p.entry.level === 'warning') && !/ERR_BLOCKED_BY_CLIENT|ERR_ABORTED/.test(p.entry.text || '')) this.console.push({ level: p.entry.level, source: p.entry.source, text: (p.entry.text || '').slice(0, 400), url: p.entry.url });
        break;
    }
  }

  resetLogs() { this.requests = new Map(); this.console = []; this.navigations = []; this.blocked = []; this.inflight = new Set(); }

  async goto(url, { settle = 1500, maxWait = 30000 } = {}) {
    const before = Date.now();
    const nav = await this.send('Page.navigate', { url }, maxWait);
    if (nav.__error || nav.errorText) return { ok: false, error: nav.__error || nav.errorText };
    for (let i = 0; i < maxWait / 200 && this.lastLoad < before; i++) await sleep(200);
    await this.idle({ quiet: 800, max: 8000 });
    await sleep(settle);
    return { ok: this.lastLoad >= before, loadMs: this.lastLoad - before };
  }

  // Waits until no request has started or finished for `quiet` ms, or `max` ms have passed.
  async idle({ quiet = 800, max = 8000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < max) {
      if (Date.now() - this.lastNetwork >= quiet) return true;
      await sleep(150);
    }
    return false;
  }

  async eval(expression, { awaitPromise = false, timeout = 30000 } = {}) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise, userGesture: true }, timeout);
    if (r.__error) return { __error: r.__error };
    if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    return r.result?.value;
  }

  async addInitScript(source) { return this.send('Page.addScriptToEvaluateOnNewDocument', { source }); }

  // JPEG keeps evidence small. fullPage captures up to maxScreens of page height at `scale`.
  async screenshot(file, { fullPage = false, quality = 72, scale = 1, maxScreens = 30 } = {}) {
    let params = { format: 'jpeg', quality };
    if (fullPage) {
      const m = await this.send('Page.getLayoutMetrics');
      const h = Math.min(m.cssContentSize?.height || m.contentSize?.height || this.vp.height, this.vp.height * maxScreens);
      params = { ...params, captureBeyondViewport: true, clip: { x: 0, y: 0, width: this.vp.width, height: h, scale } };
    }
    const s = await this.send('Page.captureScreenshot', params, 60000);
    if (s.data) { writeFileSync(file, Buffer.from(s.data, 'base64')); return file; }
    return null;
  }

  async responseBody(requestId) {
    const r = await this.send('Network.getResponseBody', { requestId });
    if (r.__error) return null;
    return r.base64Encoded ? Buffer.from(r.body, 'base64').toString('utf8') : r.body;
  }

  async cookies() { return (await this.send('Network.getCookies')).cookies || []; }

  async close() {
    await this.browser.send('Target.closeTarget', { targetId: this.targetId });
    if (this.contextId) await this.browser.send('Target.disposeBrowserContext', { browserContextId: this.contextId });
  }
}

// Blocks anything that could change state on the store beyond a shopper's cart: checkout, account,
// login, contact and newsletter form posts. Cart additions made by the theme itself are allowed.
export const SAFETY_RULES = [
  // Navigations and posts only: the theme may legitimately preload checkout scripts.
  { name: 'checkout', test: (r, p) => (p.resourceType === 'Document' || r.method === 'POST') && /\/(checkouts?|checkout)(\/|\?|$)|\/cart\/\d+:\d+|shop\.app\/checkout|pay\.shopify\.com/i.test(r.url) && !/\/cart\/(add|change|update)/i.test(r.url) },
  { name: 'account', test: (r, p) => (p.resourceType === 'Document' || r.method === 'POST') && /\/account(\/|\?|$)|\/account\/login|\/challenge(\/|\?|$)/i.test(r.url) },
  { name: 'form-post', test: (r) => r.method === 'POST' && /\/contact(\/|\?|$)|subscri|newsletter|\/reviews?\b|\/comments?\b|\/api\/\d+\/form|klaviyo\.com\/client\/(subscriptions|profiles)|\/forms?\//i.test(r.url) && !/\/cart\/(add|change|update)/i.test(r.url) },
];
