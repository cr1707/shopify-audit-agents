// Polite HTTP: one identifiable user agent, robots.txt rules, a minimum gap between requests per host,
// timeouts, and a small retry on 429/503.
import { sleep } from './cdp.mjs';

export const UA = 'Mozilla/5.0 (compatible; shopify-audit-agents/0.1; +https://github.com/cr1707/shopify-audit-agents)';
export const BOT_TOKEN = 'shopify-audit-agents';

const lastHit = new Map();
let gapMs = 1000;
export function setGap(ms) { gapMs = ms; }

export async function get(url, { timeout = 20000, accept = '*/*', method = 'GET', gap = gapMs, retries = 2 } = {}) {
  const host = new URL(url).host;
  for (let attempt = 0; ; attempt++) {
    const wait = (lastHit.get(host) || 0) + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(host, Date.now());
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const started = Date.now();
    try {
      const r = await fetch(url, { method, headers: { 'user-agent': UA, accept, 'accept-language': 'en;q=0.9,*;q=0.5' }, redirect: 'follow', signal: ctrl.signal });
      const text = method === 'HEAD' ? '' : await r.text();
      if ((r.status === 429 || r.status === 503) && attempt < retries) {
        const ra = Number(r.headers.get('retry-after')) || 5;
        await sleep(Math.min(ra, 30) * 1000);
        continue;
      }
      return { ok: r.ok, status: r.status, url: r.url, redirected: r.redirected, type: r.headers.get('content-type') || '', text, ms: Date.now() - started };
    } catch (e) {
      if (attempt < retries && e.name !== 'AbortError') { await sleep(2000); continue; }
      return { ok: false, status: 0, url, error: e.name === 'AbortError' ? 'timeout' : e.message, text: '', ms: Date.now() - started };
    } finally { clearTimeout(t); }
  }
}

export async function getJSON(url, opts) {
  const r = await get(url, { accept: 'application/json', ...opts });
  if (!r.ok) return { ...r, json: null };
  try { return { ...r, json: JSON.parse(r.text) }; } catch { return { ...r, json: null }; }
}

// robots.txt: groups for our token or '*', longest match wins, Allow wins ties. Supports * and $.
export function parseRobots(text) {
  const groups = []; let cur = null; let lastWasAgent = false;
  const sitemaps = []; let crawlDelay = null;
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase(); const v = line.slice(i + 1).trim();
    if (k === 'user-agent') { if (!lastWasAgent) { cur = { agents: [], rules: [], delay: null }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasAgent = true; continue; }
    lastWasAgent = false;
    if (k === 'sitemap') { sitemaps.push(v); continue; }
    if (!cur) continue;
    if (k === 'allow' || k === 'disallow') { if (v || k === 'allow') cur.rules.push({ allow: k === 'allow', path: v }); }
    else if (k === 'crawl-delay') cur.delay = Number(v) || null;
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && BOT_TOKEN.includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules);
  crawlDelay = chosen.map((g) => g.delay).find((d) => d) || null;
  const toRe = (p) => {
    let s = '';
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === '*') s += '.*';
      else if (c === '$' && i === p.length - 1) s += '$';
      else s += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + s);
  };
  const compiled = rules.filter((r) => r.path).map((r) => ({ ...r, re: toRe(r.path), len: r.path.length }));
  return {
    sitemaps, crawlDelay, ruleCount: compiled.length,
    allowed(url) {
      const u = new URL(url); const path = u.pathname + u.search;
      let best = null;
      for (const r of compiled) if (r.re.test(path) && (!best || r.len > best.len || (r.len === best.len && r.allow))) best = r;
      return !best || best.allow;
    },
  };
}

export function sameSite(a, b) {
  const h = (x) => new URL(x).hostname.replace(/^www\./, '');
  try { return h(a) === h(b); } catch { return false; }
}

export function htmlToText(html) {
  return (html || '')
    .replace(/<(script|style|noscript|template|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&ndash;|&mdash;/g, '-').replace(/&euro;/g, '€').replace(/&pound;/g, '£')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

// Runs `fn` over `items` with at most `n` in flight.
export async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
