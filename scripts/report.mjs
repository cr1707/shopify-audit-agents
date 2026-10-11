#!/usr/bin/env node
// Renders AUDIT_DIR/findings.json into report.html (single file, evidence embedded), report.md,
// FIX-WITH-CLAUDE.md and MANUAL-CHECKS.md, and computes the area scores.
//
// Usage: node report.mjs <audit-dir> [--no-embed]
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';

const DIR = resolve(process.argv[2] || '.');
const EMBED = !process.argv.includes('--no-embed');
const F = JSON.parse(readFileSync(join(DIR, 'findings.json'), 'utf8'));
const SNAP = join(DIR, 'snapshot');
const META = existsSync(join(SNAP, 'meta.json')) ? JSON.parse(readFileSync(join(SNAP, 'meta.json'), 'utf8')) : {};

const AREAS = {
  qa: 'Bugs and broken things', ux: 'UX and conversion', design: 'Design and accessibility', copy: 'Copy and messaging',
  products: 'Products, offer and pricing', tech: 'Tech, speed and SEO', growth: 'Tracking, ads and privacy', trust: 'Trust, care and retention',
};
const SEV = ['critical', 'high', 'medium', 'low'];
const PENALTY = { critical: 25, high: 12, medium: 5, low: 2 };
const SEVW = { critical: 8, high: 5, medium: 3, low: 1 };
const EFFW = { S: 1.5, M: 1, L: 0.6 };
const TOOL = {
  developer: 'Claude Code in your theme folder', designer: 'Claude Code in your theme folder', copywriter: 'Claude (any chat)',
  merchandiser: 'Claude with the Shopify connector', operations: 'Claude with the Shopify connector', email: 'Claude with the Klaviyo connector, or your email agency',
  marketing: 'Claude (any chat) or your ads tools', support: 'Claude (any chat) and your help desk', founder: 'A decision for you; Claude can draft options',
};

// ---------------------------------------------------------------- data
const findings = (F.findings || []).filter((f) => f.verification?.status !== 'rejected');
for (const f of findings) {
  f.area = f.area || f.id.split('-')[0];
  f._prio = SEVW[f.severity] * (f.confidence === 'verified' ? 1 : 0.6) * (EFFW[f.effort] || 1);
}
findings.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || b._prio - a._prio);
findings.forEach((f, i) => { f.rank = i + 1; });

const scores = {};
for (const a of Object.keys(AREAS)) {
  const fs = findings.filter((f) => f.area === a);
  const pen = fs.reduce((s, f) => s + PENALTY[f.severity] * (f.confidence === 'verified' ? 1 : 0.5), 0);
  const score = Math.max(0, Math.round(100 - pen));
  scores[a] = { score, label: score >= 85 ? 'Strong' : score >= 70 ? 'Good' : score >= 50 ? 'Needs work' : 'Weak', count: fs.length,
    bySev: Object.fromEntries(SEV.map((s) => [s, fs.filter((f) => f.severity === s).length])), covered: !!F.areas?.[a] || fs.length > 0 };
}
const covered = Object.keys(AREAS).filter((a) => scores[a].covered);
const overall = covered.length ? Math.round(covered.reduce((s, a) => s + scores[a].score, 0) / covered.length) : null;
const areaOrder = covered.slice().sort((a, b) => scores[a].score - scores[b].score);
const counts = { total: findings.length, verified: findings.filter((f) => f.confidence === 'verified').length, ...Object.fromEntries(SEV.map((s) => [s, findings.filter((f) => f.severity === s).length])) };
const manual = findings.filter((f) => f.confidence === 'to-test' || f.manual_check);
const store = F.store || META.store || '';
const host = store.replace(/^https?:\/\//, '').replace(/\/$/, '');
const date = (F.collectedAt || META.collectedAt || new Date().toISOString()).slice(0, 10);
mkdirSync(join(DIR, 'findings'), { recursive: true });
writeFileSync(join(DIR, 'findings', 'scores.json'), JSON.stringify({ overall, areas: scores, counts }, null, 1));

// ---------------------------------------------------------------- html helpers
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const link = (u) => /^https?:\/\//.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, ''))}</a>` : esc(u);
const linkify = (s) => esc(s).replace(/https?:\/\/[^\s<"')]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
const IMG = {}; let imgBytes = 0; const MAX_TOTAL = 24e6;
function imgRef(file) {
  const p = [join(SNAP, file), join(DIR, file), join(DIR, 'findings', file)].find((x) => existsSync(x));
  if (!p || !/\.(jpe?g|png|webp)$/i.test(file)) return null;
  const key = 'i' + Object.keys(IMG).length;
  const size = statSync(p).size;
  if (EMBED && size < 2.5e6 && imgBytes + size < MAX_TOTAL) {
    const ext = extname(p).slice(1).toLowerCase().replace('jpg', 'jpeg');
    if (!Object.values(IMG).some((v) => v.path === p)) { IMG[key] = { path: p, data: `data:image/${ext};base64,${readFileSync(p).toString('base64')}` }; imgBytes += size; return key; }
    return Object.entries(IMG).find(([, v]) => v.path === p)[0];
  }
  IMG[key] = { path: p, data: p.startsWith(SNAP) ? 'snapshot/' + p.slice(SNAP.length + 1) : p.slice(DIR.length + 1) };
  return key;
}
const chip = (cls, text) => `<span class="chip ${cls}">${esc(text)}</span>`;

function card(f) {
  const ev = (f.evidence || []).map((e) => {
    const k = e.file ? imgRef(e.file) : null;
    const label = [e.file, e.url].filter(Boolean).map((x) => /^https?:/.test(x) ? link(x) : `<code>${esc(x)}</code>`).join(' ');
    return `<li>${k ? `<button class="thumb" data-img="${k}" aria-label="Open screenshot"><img data-img="${k}" alt="Evidence screenshot" loading="lazy"></button>` : ''}
      <div>${e.quote ? `<q>${esc(e.quote)}</q>` : ''}${e.note ? `<span class="note">${linkify(e.note)}</span>` : ''}<span class="src">${label}</span></div></li>`;
  }).join('');
  const where = (f.where || []).map((w) => `${link(w.url)}${w.viewport && w.viewport !== 'any' ? ` <span class="vp">${esc(w.viewport)}</span>` : ''}`).join('<br>');
  return `<article class="finding" id="${esc(f.id)}" data-area="${f.area}" data-sev="${f.severity}" data-conf="${f.confidence}" data-owner="${esc(f.owner)}">
  <header>
    <div class="chips"><span class="rank">#${f.rank}</span>${chip('sev ' + f.severity, f.severity)}${chip(f.confidence === 'verified' ? 'ok' : 'test', f.confidence === 'verified' ? 'Verified' : 'To test')}${chip('plain', 'Effort ' + f.effort)}${chip('plain', esc(f.owner))}${f.intentional_possible ? chip('maybe', 'Possibly on purpose') : ''}</div>
    <h3>${esc(f.title)}</h3>
    <p class="where">${where}</p>
  </header>
  <div class="cols">
    <section>
      <h4>See it yourself</h4>
      <ol class="steps">${(f.see_it || []).map((s) => `<li>${linkify(s)}</li>`).join('')}</ol>
      <h4>Evidence</h4>
      <ul class="evidence">${ev}</ul>
    </section>
    <section>
      <h4>Why it matters</h4>
      <p>${linkify(f.why_it_matters)}</p>
      <h4>What to do</h4>
      <p>${linkify(f.fix?.summary)}</p>
      ${f.fix?.steps?.length ? `<ol class="steps">${f.fix.steps.map((s) => `<li>${linkify(s)}</li>`).join('')}</ol>` : ''}
      ${f.fix?.where_to_change ? `<p class="small"><b>Where:</b> ${esc(f.fix.where_to_change)}</p>` : ''}
      <details class="prompt"><summary>Fix with Claude <span class="small">· ${esc(TOOL[f.owner] || 'Claude')}</span></summary>
        <pre>${esc(f.claude_prompt)}</pre><button class="copy" type="button">Copy prompt</button></details>
      <h4>How to check it is fixed</h4>
      <p>${linkify(f.verify_fix)}</p>
      ${f.manual_check ? `<div class="manual"><b>Manual check:</b> ${linkify(f.manual_check)}</div>` : ''}
    </section>
  </div>
</article>`;
}

const bar = (s) => `<span class="bar"><i style="width:${s}%" class="${s >= 85 ? 'g' : s >= 70 ? 'y' : s >= 50 ? 'o' : 'r'}"></i></span>`;
const byId = Object.fromEntries(findings.map((f) => [f.id, f]));
const top = (F.summary?.top || []).map((id) => byId[id]).filter(Boolean);
const topList = (top.length ? top : findings.slice(0, 5));

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Store audit · ${esc(host)}</title>
<style>
:root{--ink:#0b0b0c;--ink2:#2e2f33;--mute:#6b6d73;--faint:#9a9ca3;--line:#e6e6e8;--bg:#fff;--soft:#f6f6f7;--acc:#2448f5;
--crit:#c0262d;--high:#d9631e;--med:#a77a06;--low:#5b6b7a;--ok:#1f8a4c;--test:#9a6700}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--acc);text-decoration:none;word-break:break-word}a:hover{text-decoration:underline}
code{font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--soft);padding:1px 5px;border-radius:3px;word-break:break-all}
.wrap{max-width:1180px;margin:0 auto;padding:0 24px}
.top{border-bottom:1px solid var(--line);padding:18px 0;font:500 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.top .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
h1{font-size:40px;line-height:1.08;letter-spacing:-.025em;margin:44px 0 14px;max-width:900px}h1.long{font-size:30px;line-height:1.18;max-width:980px}
h2{font-size:26px;letter-spacing:-.02em;margin:0 0 6px}
h3{font-size:19px;line-height:1.3;letter-spacing:-.01em;margin:8px 0 4px}
h4{font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);margin:18px 0 8px}
.lede{font-size:17px;color:var(--ink2);max-width:820px;margin:0 0 26px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));border:1px solid var(--line);margin:0 0 48px}
.stats div{padding:16px 18px;border-right:1px solid var(--line)}.stats div:last-child{border-right:0}
.stats b{display:block;font-size:28px;letter-spacing:-.02em}.stats span{color:var(--mute);font-size:13px}
section.block{padding:40px 0;border-top:1px solid var(--line)}
.sub{color:var(--mute);margin:0 0 22px;max-width:760px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:10px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
td.n{font-weight:700;width:36px}
.score{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0;border-top:1px solid var(--line);border-left:1px solid var(--line)}
.score a{display:block;color:inherit;padding:16px 18px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.score a:hover{background:var(--soft);text-decoration:none}
.score .t{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.score b{font-size:15px}.score em{font-style:normal;font-size:24px;font-weight:700;letter-spacing:-.02em}
.score small{color:var(--mute);display:block;margin-top:6px}
.bar{display:block;height:5px;background:var(--soft);margin-top:10px}.bar i{display:block;height:5px}.bar .g{background:var(--ok)}.bar .y{background:#7aa53a}.bar .o{background:var(--high)}.bar .r{background:var(--crit)}
ul.strengths{margin:0;padding-left:18px;columns:2;column-gap:40px}ul.strengths li{margin:0 0 8px;break-inside:avoid}
.filters{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.96);backdrop-filter:blur(6px);border-bottom:1px solid var(--line);padding:10px 0}
.filters .wrap{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.filters select,.filters input{font:inherit;font-size:13px;padding:6px 8px;border:1px solid var(--line);background:#fff;border-radius:4px}
.filters input{flex:1;min-width:160px}.filters .cnt{color:var(--mute);font-size:13px;margin-left:auto}
.area-h{margin:56px 0 8px;display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.area-h .sc{font:600 13px/1 ui-monospace,Menlo,monospace;color:var(--mute)}
.finding{border:1px solid var(--line);margin:18px 0;padding:22px 24px;break-inside:avoid-page}
.finding header{border-bottom:1px solid var(--line);padding-bottom:12px}
.chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.rank{font-weight:700;margin-right:4px}
.chip{font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.04em;text-transform:uppercase;padding:5px 7px;border:1px solid var(--line);border-radius:3px;color:var(--ink2)}
.chip.sev{color:#fff;border-color:transparent}.chip.critical{background:var(--crit)}.chip.high{background:var(--high)}.chip.medium{background:var(--med)}.chip.low{background:var(--low)}
.chip.ok{color:var(--ok);border-color:#bfe0cc}.chip.test{color:var(--test);border-color:#ecd9a6}.chip.maybe{color:#5a43c7;border-color:#d8d0f5}
.where{margin:4px 0 0;font-size:13px;color:var(--mute)}.vp{font:11px ui-monospace,Menlo,monospace;color:var(--faint);text-transform:uppercase}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:32px}
.cols>section>p{margin:0 0 6px}.small{font-size:13px;color:var(--mute)}
ol.steps{margin:0;padding-left:20px}ol.steps li{margin:0 0 5px}
ul.evidence{list-style:none;margin:0;padding:0}ul.evidence li{display:flex;gap:12px;margin:0 0 12px;align-items:flex-start}
.thumb{border:1px solid var(--line);padding:0;background:#fff;cursor:zoom-in;flex:0 0 auto}.thumb img{display:block;width:150px;max-height:220px;object-fit:cover;object-position:top}
q{display:block;font-style:italic;color:var(--ink2);margin-bottom:4px}.note{display:block;font-size:14px}.src{display:block;font-size:12px;color:var(--faint);margin-top:2px}
details.prompt{margin:16px 0 4px;border:1px solid var(--line);background:var(--soft)}details.prompt summary{cursor:pointer;padding:10px 12px;font-weight:600}
details.prompt pre{white-space:pre-wrap;margin:0;padding:0 12px 10px;font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink2)}
button.copy{margin:0 12px 12px;font:600 12px/1 inherit;padding:8px 10px;border:0;background:var(--ink);color:#fff;cursor:pointer;border-radius:3px}
.manual{margin-top:12px;padding:10px 12px;border-left:3px solid var(--test);background:#fdf8ea;font-size:14px}
.lim{color:var(--mute);font-size:14px}
dialog{border:0;padding:0;max-width:96vw;max-height:94vh;background:transparent}dialog::backdrop{background:rgba(0,0,0,.75)}dialog img{display:block;max-width:96vw;max-height:94vh}
footer{border-top:1px solid var(--line);margin-top:56px;padding:22px 0 40px;color:var(--mute);font-size:13px}
@media (max-width:800px){h1,h1.long{font-size:26px}.cols{grid-template-columns:1fr;gap:0}ul.strengths{columns:1}.wrap{padding:0 16px}.finding{padding:16px}.thumb img{width:110px}.stats div{border-right:0;border-bottom:1px solid var(--line)}}
@media print{.filters,button.copy,dialog{display:none!important}details.prompt{display:block}details.prompt>*{display:block}body{font-size:12px}.finding{page-break-inside:avoid}h1{margin-top:10px}a{color:var(--ink)}}
</style></head><body>
<div class="top"><div class="wrap"><span>Store audit · ${esc(host)}</span><span>${esc(date)} · ${esc(F.mode || 'quick')} mode</span></div></div>
<main class="wrap">
<h1${(F.summary?.headline || '').length > 120 ? ' class="long"' : ''}>${esc(F.summary?.headline || 'Store audit')}</h1>
<p class="lede">${esc(F.summary?.read_first || '')}</p>
<div class="stats">
  <div><b>${overall ?? '–'}</b><span>Overall score / 100</span></div>
  <div><b>${counts.total}</b><span>Findings (${counts.verified} verified)</span></div>
  <div><b>${counts.critical + counts.high}</b><span>Critical or high</span></div>
  <div><b>${(META.pages?.rendered || []).length}</b><span>Pages checked on phone + desktop</span></div>
  <div><b>${manual.length}</b><span>Manual checks</span></div>
</div>

<section class="block" id="first"><h2>Fix these first</h2><p class="sub">Ranked by business impact, then confidence, then effort.</p>
<table><thead><tr><th>#</th><th>Finding</th><th>Area</th><th>Severity</th><th>Effort</th><th>Owner</th></tr></thead><tbody>
${findings.slice(0, 12).map((f) => `<tr><td class="n">${f.rank}</td><td><a href="#${esc(f.id)}">${esc(f.title)}</a>${f.confidence !== 'verified' ? ' <span class="small">(to test)</span>' : ''}</td><td>${esc(AREAS[f.area] || f.area)}</td><td>${chip('sev ' + f.severity, f.severity)}</td><td>${esc(f.effort)}</td><td>${esc(f.owner)}</td></tr>`).join('')}
</tbody></table></section>

<section class="block" id="scores"><h2>Scorecard</h2><p class="sub">Each area starts at 100 and loses points per finding: critical 25, high 12, medium 5, low 2 (half for findings still to test).</p>
<div class="score">${Object.keys(AREAS).filter((a) => scores[a].covered).map((a) => `<a href="#area-${a}"><div class="t"><b>${esc(AREAS[a])}</b><em>${scores[a].score}</em></div>${bar(scores[a].score)}<small>${scores[a].label} · ${scores[a].count} finding${scores[a].count === 1 ? '' : 's'}${scores[a].bySev.critical ? ` · ${scores[a].bySev.critical} critical` : ''}${scores[a].bySev.high ? ` · ${scores[a].bySev.high} high` : ''}</small></a>`).join('')}</div>
</section>

${(F.summary?.strengths || []).length ? `<section class="block"><h2>What already works</h2><p class="sub">Keep these while fixing the rest.</p><ul class="strengths">${F.summary.strengths.map((s) => `<li>${linkify(s)}</li>`).join('')}</ul></section>` : ''}
</main>

<div class="filters"><div class="wrap">
  <select id="fArea"><option value="">All areas</option>${areaOrder.map((a) => `<option value="${a}">${esc(AREAS[a])}</option>`).join('')}</select>
  <select id="fSev"><option value="">All severities</option>${SEV.map((s) => `<option>${s}</option>`).join('')}</select>
  <select id="fConf"><option value="">Verified + to test</option><option value="verified">Verified only</option><option value="to-test">To test only</option></select>
  <select id="fOwner"><option value="">All owners</option>${[...new Set(findings.map((f) => f.owner))].sort().map((o) => `<option>${esc(o)}</option>`).join('')}</select>
  <input id="fText" type="search" placeholder="Search findings">
  <span class="cnt" id="fCnt"></span>
</div></div>

<main class="wrap" id="findings">
${areaOrder.map((a) => {
  const fs = findings.filter((f) => f.area === a); const info = F.areas?.[a] || {};
  return `<section class="area" id="area-${a}" data-area="${a}"><div class="area-h"><h2>${esc(AREAS[a])}</h2><span class="sc">${scores[a].score}/100 · ${scores[a].label}</span></div>
  ${info.summary ? `<p class="sub">${linkify(info.summary)}</p>` : ''}
  ${fs.length ? fs.map(card).join('\n') : '<p class="small">No findings in this area.</p>'}</section>`;
}).join('\n')}

${manual.length ? `<section class="block" id="manual"><h2>Manual checks</h2><p class="sub">Things this audit could not see from the outside. Each takes a few minutes with a test inbox, the admin or a real purchase.</p>
<table><thead><tr><th>#</th><th>Check</th><th>Related finding</th></tr></thead><tbody>${manual.map((f, i) => `<tr><td class="n">${i + 1}</td><td>${linkify(f.manual_check || f.see_it?.join(' '))}</td><td><a href="#${esc(f.id)}">${esc(f.title)}</a></td></tr>`).join('')}</tbody></table></section>` : ''}

<section class="block" id="method"><h2>How this audit was made</h2>
<p class="lim">A read-only snapshot of ${link(store)} was collected on ${esc((META.collectedAt || '').replace('T', ' ').slice(0, 16))} UTC: ${(META.pages?.rendered || []).length} pages rendered on a phone (390×844) and a desktop (1440×900) browser, ${(META.pages?.clickTested || []).length} product pages click-tested as a new visitor, ${(META.pages?.textOnly || []).length} policy and content pages read as text, public catalogue data, PageSpeed Insights and an accessibility scan. Nothing was submitted, no checkout was started and no account was used. Each finding was written by a specialist agent, reviewed by an area lead, re-checked by a verifier and ranked by an editor.</p>
<p class="lim">${esc(F.summary?.limits || 'Not covered: checkout and payment, emails after sign-up or purchase, the store admin, and what visitors in other countries see.')}</p>
<p class="lim">Pages checked: ${(META.pages?.rendered || []).map((u) => link(u)).join(', ')}</p>
</section>
</main>
<footer><div class="wrap">Generated by <a href="https://github.com/cr1707/shopify-audit-agents">shopify-audit-agents</a>. Findings marked "to test" need a human check before acting on them.</div></footer>
<dialog id="dlg"><img alt="Evidence screenshot, full size"></dialog>
<script>
const IMG=${JSON.stringify(Object.fromEntries(Object.entries(IMG).map(([k, v]) => [k, v.data])))};
document.querySelectorAll('img[data-img]').forEach(i=>{i.src=IMG[i.dataset.img]||''});
const dlg=document.getElementById('dlg');
document.querySelectorAll('.thumb').forEach(b=>b.addEventListener('click',()=>{dlg.querySelector('img').src=IMG[b.dataset.img];dlg.showModal()}));
dlg.addEventListener('click',()=>dlg.close());
document.querySelectorAll('button.copy').forEach(b=>b.addEventListener('click',async()=>{const t=b.previousElementSibling.textContent;try{await navigator.clipboard.writeText(t);b.textContent='Copied'}catch(e){const r=document.createRange();r.selectNodeContents(b.previousElementSibling);getSelection().removeAllRanges();getSelection().addRange(r);b.textContent='Press Cmd/Ctrl+C'}setTimeout(()=>b.textContent='Copy prompt',1600)}));
const f={a:fArea,s:fSev,c:fConf,o:fOwner,t:fText};
function apply(){let n=0;document.querySelectorAll('.finding').forEach(e=>{const ok=(!f.a.value||e.dataset.area===f.a.value)&&(!f.s.value||e.dataset.sev===f.s.value)&&(!f.c.value||e.dataset.conf===f.c.value)&&(!f.o.value||e.dataset.owner===f.o.value)&&(!f.t.value||e.textContent.toLowerCase().includes(f.t.value.toLowerCase()));e.hidden=!ok;if(ok)n++});
document.querySelectorAll('section.area').forEach(s=>{s.hidden=![...s.querySelectorAll('.finding')].some(e=>!e.hidden)&&!!(f.a.value||f.s.value||f.c.value||f.o.value||f.t.value)});fCnt.textContent=n+' shown'}
Object.values(f).forEach(e=>e.addEventListener('input',apply));apply();
window.addEventListener('beforeprint',()=>document.querySelectorAll('details').forEach(d=>d.open=true));
</script>
</body></html>`;
writeFileSync(join(DIR, 'report.html'), html);

// ---------------------------------------------------------------- markdown report
const md = [];
const m = (s = '') => md.push(s);
m(`# Store audit: ${host}`); m(); m(`${date} · ${F.mode || 'quick'} mode · overall ${overall ?? '–'}/100 · ${counts.total} findings (${counts.verified} verified)`); m();
m(`**${F.summary?.headline || ''}**`); m(); if (F.summary?.read_first) { m(F.summary.read_first); m(); }
m('## Fix these first'); m(); m('| # | Finding | Area | Severity | Effort | Owner |'); m('|---|---|---|---|---|---|');
for (const f of findings.slice(0, 12)) m(`| ${f.rank} | ${f.title.replace(/\|/g, '/')}${f.confidence !== 'verified' ? ' (to test)' : ''} | ${AREAS[f.area]} | ${f.severity} | ${f.effort} | ${f.owner} |`);
m(); m('## Scorecard'); m(); m('| Area | Score | Findings |'); m('|---|---|---|');
for (const a of Object.keys(AREAS).filter((x) => scores[x].covered)) m(`| ${AREAS[a]} | ${scores[a].score} (${scores[a].label}) | ${scores[a].count} |`);
if (F.summary?.strengths?.length) { m(); m('## What already works'); m(); for (const s of F.summary.strengths) m(`- ${s}`); }
for (const a of areaOrder) {
  m(); m(`## ${AREAS[a]} (${scores[a].score}/100)`); m(); if (F.areas?.[a]?.summary) { m(F.areas[a].summary); m(); }
  for (const f of findings.filter((x) => x.area === a)) {
    m(`### #${f.rank} ${f.title}`); m(); m(`${f.severity} · ${f.confidence} · effort ${f.effort} · owner ${f.owner}${f.intentional_possible ? ' · possibly on purpose' : ''}`); m();
    m(`**Where:** ${(f.where || []).map((w) => `${w.url}${w.viewport && w.viewport !== 'any' ? ` (${w.viewport})` : ''}`).join(', ')}`); m();
    m('**See it yourself**'); m(); f.see_it.forEach((s, i) => m(`${i + 1}. ${s}`)); m();
    m('**Evidence**'); m(); for (const e of f.evidence) m(`- ${[e.quote ? `"${e.quote}"` : '', e.note, e.file ? `\`${e.file}\`` : '', e.url].filter(Boolean).join(' · ')}`); m();
    m(`**Why it matters:** ${f.why_it_matters}`); m(); m(`**What to do:** ${f.fix?.summary}`); if (f.fix?.steps?.length) { m(); f.fix.steps.forEach((s, i) => m(`${i + 1}. ${s}`)); }
    if (f.fix?.where_to_change) { m(); m(`Where: ${f.fix.where_to_change}`); }
    m(); m(`**Check it is fixed:** ${f.verify_fix}`); if (f.manual_check) { m(); m(`**Manual check:** ${f.manual_check}`); } m();
  }
}
m('## How this audit was made'); m(); m(`Read-only snapshot of ${store} collected ${META.collectedAt || ''}. Pages: ${(META.pages?.rendered || []).join(', ')}.`); m(); m(F.summary?.limits || '');
writeFileSync(join(DIR, 'report.md'), md.join('\n') + '\n');

// ---------------------------------------------------------------- fix-with-Claude
const fx = [];
const x = (s = '') => fx.push(s);
x(`# Fix with Claude: ${host}`); x();
x(`One prompt per finding, in fix-first order. You are the e-commerce manager: paste a prompt into Claude, review what it proposes, and approve each change.`); x();
x('## Before you start'); x();
x('- **Theme changes** (owner: developer, designer): duplicate your live theme first (Online Store > Themes > ... > Duplicate). Pull it with the Shopify CLI (`shopify theme pull --store <your-store>.myshopify.com --theme <duplicate id>`), open Claude Code in that folder and paste the prompt. Push to the unpublished copy (`shopify theme push --unpublished` or `--theme <id>`), preview, then publish.');
x('- **Catalogue, collections and discounts** (owner: merchandiser, operations): use Claude with the Shopify connector. Ask it to show what it will change and confirm before every write.');
x('- **Emails** (owner: email): Claude with the Klaviyo connector, or forward the prompt to whoever runs your email.');
x('- **Copy, decisions and briefs** (owner: copywriter, founder, marketing, support): any Claude chat. Claude drafts, you decide.');
x('- Never let any tool edit checkout settings or payment providers from these prompts.'); x();
for (const f of findings) {
  x(`## #${f.rank} ${f.title}`); x();
  x(`${f.severity} · effort ${f.effort} · owner ${f.owner} · use: ${TOOL[f.owner] || 'Claude'}${f.confidence !== 'verified' ? ' · **to test first**' : ''}`); x();
  x('```text'); x(f.claude_prompt); x('```'); x();
  x(`Check: ${f.verify_fix}`); x();
}
writeFileSync(join(DIR, 'FIX-WITH-CLAUDE.md'), fx.join('\n') + '\n');

// ---------------------------------------------------------------- manual checks
const mc = [];
const c = (s = '') => mc.push(s);
c(`# Manual checks: ${host}`); c(); c('Things an outside audit cannot see. Tick them off with a test inbox, a real phone and, where needed, a small test order.'); c();
c('## From this audit'); c();
manual.forEach((f) => c(`- [ ] **#${f.rank} ${f.title}**: ${f.manual_check || f.see_it.join(' ')}`));
c(); c('## Always worth checking'); c();
for (const s of [
  'Place one real order on a phone with a new email address: checkout steps, shipping options and costs, payment methods, order confirmation email.',
  'Sign up to the newsletter with a test inbox: is the welcome email received, and does any promised code work?',
  'Add to cart with a test email, leave at checkout, and note which reminder emails arrive in 24 and 72 hours.',
  'Apply every public discount code you can find together in one cart: does the total match what you intend?',
  'Open the store from another country (VPN) where you sell: cookie banner, currency, shipping and prices.',
  'Open the store admin: apps installed vs apps detected in this report; remove anything unused.',
]) c(`- [ ] ${s}`);
writeFileSync(join(DIR, 'MANUAL-CHECKS.md'), mc.join('\n') + '\n');

console.log(`report.html (${(html.length / 1e6).toFixed(1)} MB, ${Object.keys(IMG).length} images), report.md, FIX-WITH-CLAUDE.md, MANUAL-CHECKS.md → ${DIR}`);
console.log(`overall ${overall}/100 · ${counts.total} findings · ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low · ${manual.length} manual checks`);
