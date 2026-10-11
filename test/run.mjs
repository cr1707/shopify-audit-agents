// Regression test: runs the collector against the fixture store and checks that every planted problem is captured,
// that robots.txt is respected and that no form was posted. Then renders a report from a sample findings file.
// Usage: node test/run.mjs
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from './fixture/server.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const server = await start(0);
const base = `http://127.0.0.1:${server.address().port}`;
const out = mkdtempSync(join(tmpdir(), 'saa-test-'));
console.log('fixture', base, '→', out);

const code = await new Promise((r) => {
  const p = spawn(process.execPath, [join(ROOT, 'scripts/collect.mjs'), base, '--out', out, '--no-psi', '--gap', '50', '--products', '2', '--pages', '6'], { stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('exit', r);
});
const snap = join(out, 'snapshot');
const j = (f) => JSON.parse(readFileSync(join(snap, f), 'utf8'));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`); };

check('collector exits 0', code === 0, `exit ${code}`);
const click = j('clicktest/results.json');
const alpha = click.filter((r) => r.page === 'products-alpha');
const verdicts = alpha.flatMap((r) => (r.tests || []).map((t) => `${r.viewport}:${t.verdict}`));
check('click test: second button on Alpha adds the wrong product (MISMATCH)', verdicts.some((v) => v.endsWith('MISMATCH')), verdicts.join(', '));
check('click test: main button on Alpha adds Alpha (MATCH)', verdicts.some((v) => v.endsWith('MATCH') && !v.endsWith('MISMATCH')));
const betaV = click.filter((r) => r.page === 'products-beta').flatMap((r) => (r.tests || []).map((t) => t.verdict));
check('disabled builder button reported as DISABLED, not clicked', betaV.some((v) => v.startsWith('DISABLED')) && !betaV.includes('NOTHING ADDED'), betaV.join(', '));
const homePhone = j('pages/home/phone.json');
check('pop-up captured with its close button', (homePhone.overlays || []).some((o) => /10% off/.test(o.text) && o.buttons.includes('No thanks')), JSON.stringify((homePhone.overlays || []).map((o) => o.text.slice(0, 30))));
check('phone page wider than the screen detected', homePhone.layout.horizontalOverflowPx > 100, `${homePhone.layout.horizontalOverflowPx}px`);
const homeDesk = j('pages/home/desktop.json');
check('JavaScript error captured', (homeDesk.console || []).some((c) => /undefinedFunctionCall/.test(c.text)));
check('image without alt text counted', homeDesk.images.missingAlt >= 1);
check('axe-core accessibility scan ran', Array.isArray(homeDesk.a11y));
const links = j('links.json');
check('dead internal link found', (links.broken || []).some((l) => /\/pages\/missing/.test(l.url)));
check('robots.txt respected (disallowed page never fetched)', !(links.broken || []).some((l) => /\/secret/.test(l.url)) && !existsSync(join(snap, 'pages', 'secret-area')));
const consent = j('consent/results.json');
check('cookie banner and its Decline button found', consent.banner?.found && /Decline/.test(consent.banner.decline?.text || ''));
const cat = j('shop/catalogue-stats.json');
check('fake discount (compare-at below price) found', cat.compareAtNotHigher?.some((x) => x.handle === 'alpha'));
check('missing SKU counted', cat.missingSku === 1);
check('policy page captured as text', existsSync(join(snap, 'text', 'policies-refund-policy.txt')) || existsSync(join(snap, 'pages', 'policies-refund-policy', 'text.txt')));
check('no form was posted to the store', !server.formPosts, `posts: ${server.formPosts || 0}`);
check('INDEX.md written', existsSync(join(snap, 'INDEX.md')));

// Report rendering from the sample findings
mkdirSync(join(out, 'findings'), { recursive: true });
writeFileSync(join(out, 'findings.json'), readFileSync(join(ROOT, 'test', 'sample-findings.json'), 'utf8').replaceAll('{{STORE}}', base));
const rcode = await new Promise((r) => { const p = spawn(process.execPath, [join(ROOT, 'scripts/report.mjs'), out], { stdio: ['ignore', 'inherit', 'inherit'] }); p.on('exit', r); });
const html = existsSync(join(out, 'report.html')) ? readFileSync(join(out, 'report.html'), 'utf8') : '';
check('report renders', rcode === 0 && html.includes('Fix these first') && existsSync(join(out, 'FIX-WITH-CLAUDE.md')) && existsSync(join(out, 'MANUAL-CHECKS.md')));
const v = await new Promise((r) => { const p = spawn(process.execPath, [join(ROOT, 'scripts/validate.mjs'), join(ROOT, 'test', 'sample-area.json'), '--snapshot', snap], { stdio: ['ignore', 'inherit', 'inherit'] }); p.on('exit', r); });
check('sample area file passes validation', v === 0);

server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed · output in ${out}`);
process.exit(failed ? 1 : 0);
