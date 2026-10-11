#!/usr/bin/env node
// One read-only browser check on a live page, for specialists and the verifier to confirm a finding.
// Checkout, account, login, contact and newsletter requests are blocked. Prints JSON to stdout.
//
// node probe.mjs <url> [--phone|--desktop] [--wait 3000] [--shot file.jpg] [--full]
//                [--text] [--eval "<js expression>"] [--click "<visible text or css selector>"] [--after 3000]
import { Browser, SAFETY_RULES, sleep } from './lib/cdp.mjs';
import { OVERLAY_WATCH, OVERLAYS_NOW } from './lib/extract.mjs';

const a = process.argv.slice(2);
const opt = (n, d) => { const i = a.indexOf('--' + n); return i < 0 ? d : a[i + 1]; };
const has = (n) => a.includes('--' + n);
const url = a.find((x, i) => /^https?:\/\//.test(x) && !['--eval', '--click', '--shot'].includes(a[i - 1]));
if (!url) { console.error('Usage: node probe.mjs <url> [--phone|--desktop] [--wait ms] [--shot file.jpg] [--full] [--text] [--eval js] [--click text|selector] [--after ms]'); process.exit(2); }

const b = await Browser.launch();
const out = { url, viewport: has('phone') ? 'phone' : 'desktop', at: new Date().toISOString() };
// Live checks use the same "reduce motion" setting as the collector (set in cdp.mjs) so results match the snapshot.
try {
  const page = await b.newPage(out.viewport);
  page.blockRules = SAFETY_RULES;
  await page.addInitScript(OVERLAY_WATCH);
  const nav = await page.goto(url, { settle: Number(opt('wait', 2500)) });
  out.loaded = nav.ok; out.finalUrl = await page.eval('location.href'); out.title = await page.eval('document.title');
  if (has('click')) {
    const target = opt('click');
    out.click = await page.eval(`(() => {
      const t = ${JSON.stringify(target)}; const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      let el = null; try { el = document.querySelector(t); } catch (e) {}
      if (!el) { const c = [...document.querySelectorAll('a,button,[role=button],summary,label,input[type=button],input[type=submit]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && norm(e.innerText || e.value || e.getAttribute('aria-label')).includes(norm(t)); }); el = c[0]; }
      if (!el) return 'not found';
      if (el.closest('form') && !/\\/cart/.test(el.closest('form').getAttribute('action') || '') && (el.type === 'submit')) return 'refused: would submit a form';
      el.scrollIntoView({ block: 'center' }); el.click(); return 'clicked: ' + norm(el.innerText || el.value).slice(0, 60);
    })()`);
    await sleep(Number(opt('after', 3000))); await page.idle({ quiet: 600, max: 5000 });
    out.urlAfterClick = await page.eval('location.href');
  }
  if (has('eval')) out.eval = await page.eval(opt('eval'), { awaitPromise: true });
  if (has('text')) out.text = (await page.eval('document.body.innerText'))?.replace(/\n\s*\n+/g, '\n').slice(0, 20000);
  out.overlays = await page.eval(OVERLAYS_NOW);
  if (has('shot')) {
    const saved = await page.screenshot(opt('shot'), { fullPage: has('full'), scale: has('full') ? 0.6 : 1 });
    // Record the path from the audit folder down (findings/probes/x.jpg), never the machine's absolute path.
    out.screenshot = saved && (saved.match(/(?:^|\/)(findings\/.+|snapshot\/.+)$/)?.[1] || saved.split('/').pop());
  }
  out.console = page.console.slice(0, 20);
  out.blockedBySafety = page.blocked;
  await page.close();
} catch (e) { out.error = String(e); }
await b.close();
console.log(JSON.stringify(out, null, 1));
