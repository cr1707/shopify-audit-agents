#!/usr/bin/env node
// Checks agent output against reference/finding.schema.json (hand-rolled, no dependencies).
//   node validate.mjs <file.json> [--snapshot DIR]   validate one file; also checks that evidence files exist
//   node validate.mjs --merge <audit-dir>            merge findings/areas/*.json into findings/candidates.json
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const AREAS = ['qa', 'ux', 'design', 'copy', 'products', 'tech', 'growth', 'trust'];
const SEV = ['critical', 'high', 'medium', 'low'];
const EFF = ['S', 'M', 'L'];
const CONF = ['verified', 'to-test'];
const OWNERS = ['developer', 'designer', 'copywriter', 'merchandiser', 'marketing', 'email', 'support', 'operations', 'founder'];
const REQ = ['id', 'title', 'severity', 'effort', 'confidence', 'owner', 'where', 'see_it', 'evidence', 'why_it_matters', 'fix', 'claude_prompt', 'verify_fix'];

export function validate(doc, snapshot) {
  const errs = []; const warn = [];
  if (!doc || typeof doc !== 'object') return { errs: ['not a JSON object'], warn };
  if (!AREAS.includes(doc.area)) errs.push(`area must be one of ${AREAS.join(', ')}`);
  for (const k of ['agent', 'summary']) if (typeof doc[k] !== 'string' || !doc[k]) errs.push(`missing ${k}`);
  if (!Array.isArray(doc.findings)) { errs.push('findings must be an array'); return { errs, warn }; }
  const ids = new Set();
  doc.findings.forEach((f, i) => {
    const at = `findings[${i}]${f?.id ? ' (' + f.id + ')' : ''}`;
    for (const k of REQ) if (f[k] === undefined || f[k] === null || f[k] === '') errs.push(`${at}: missing ${k}`);
    if (f.id && !/^[a-z0-9-]+$/.test(f.id)) errs.push(`${at}: id must be lowercase letters, digits and dashes`);
    if (ids.has(f.id)) errs.push(`${at}: duplicate id`); ids.add(f.id);
    if (f.severity && !SEV.includes(f.severity)) errs.push(`${at}: severity must be ${SEV.join('|')}`);
    if (f.effort && !EFF.includes(f.effort)) errs.push(`${at}: effort must be ${EFF.join('|')}`);
    if (f.confidence && !CONF.includes(f.confidence)) errs.push(`${at}: confidence must be ${CONF.join('|')}`);
    if (f.owner && !OWNERS.includes(f.owner)) errs.push(`${at}: owner must be one of ${OWNERS.join(', ')}`);
    if (f.confidence === 'to-test' && !f.manual_check) errs.push(`${at}: to-test findings need manual_check`);
    if (f.title && f.title.length > 160) warn.push(`${at}: title longer than 160 characters`);
    if (!Array.isArray(f.where) || !f.where.length || f.where.some((w) => !w.url)) errs.push(`${at}: where needs at least one {url}`);
    if (!Array.isArray(f.see_it) || !f.see_it.length) errs.push(`${at}: see_it needs steps`);
    if (!Array.isArray(f.evidence) || !f.evidence.length) errs.push(`${at}: evidence needs at least one item`);
    if (f.fix && typeof f.fix !== 'object') errs.push(`${at}: fix must be an object with summary`);
    if (f.fix && typeof f.fix === 'object' && !f.fix.summary) errs.push(`${at}: fix.summary missing`);
    if (/\b\d{1,3}\s?% (more|higher|lift|increase|uplift)|increase (sales|conversion) by \d/i.test(`${f.why_it_matters} ${f.fix?.summary}`)) warn.push(`${at}: contains a predicted uplift number; the method forbids invented numbers`);
    if (/\b(illegal|unlawful|violat\w+|non-?compliant|breach(es)? (of )?(the )?(law|gdpr|regulation))/i.test(`${f.title} ${f.why_it_matters}`)) warn.push(`${at}: sounds like a legal claim; describe the behaviour instead`);
    if (snapshot && Array.isArray(f.evidence)) for (const e of f.evidence) if (e.file && !existsSync(join(snapshot, e.file)) && !existsSync(resolve(dirname(snapshot), e.file))) warn.push(`${at}: evidence file not found: ${e.file}`);
  });
  return { errs, warn };
}

const a = process.argv.slice(2);
if (a[0] === '--merge') {
  const dir = resolve(a[1] || '.'); const areasDir = join(dir, 'findings', 'areas');
  const files = existsSync(areasDir) ? readdirSync(areasDir).filter((f) => f.endsWith('.json')) : [];
  const merged = { areas: {}, findings: [], handoffs: [] };
  for (const f of files) {
    let doc; try { doc = JSON.parse(readFileSync(join(areasDir, f), 'utf8')); } catch (e) { console.error(`${f}: invalid JSON (${e.message})`); continue; }
    const { errs, warn } = validate(doc, join(dir, 'snapshot'));
    errs.forEach((e) => console.error(`${f}: ERROR ${e}`)); warn.forEach((w) => console.error(`${f}: warn ${w}`));
    merged.areas[doc.area] = { summary: doc.summary, strengths: doc.strengths || [], agent: doc.agent };
    for (const x of doc.findings || []) merged.findings.push({ ...x, area: doc.area });
    for (const h of doc.handoffs || []) merged.handoffs.push({ from: doc.area, ...h });
  }
  const seen = new Set(); for (const x of merged.findings) { let id = x.id; let n = 2; while (seen.has(id)) id = `${x.id}-${n++}`; x.id = id; seen.add(id); }
  writeFileSync(join(dir, 'findings', 'candidates.json'), JSON.stringify(merged, null, 1));
  console.log(`merged ${files.length} area files, ${merged.findings.length} findings → findings/candidates.json`);
} else if (a[0]) {
  const file = resolve(a[0]); const si = a.indexOf('--snapshot');
  let doc; try { doc = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.error(`invalid JSON: ${e.message}`); process.exit(1); }
  const snap = si > 0 ? resolve(a[si + 1]) : (() => { let d = dirname(file); for (let i = 0; i < 4; i++) { if (existsSync(join(d, 'snapshot'))) return join(d, 'snapshot'); d = dirname(d); } return null; })();
  const { errs, warn } = validate(doc, snap);
  warn.forEach((w) => console.error('warn', w));
  if (errs.length) { errs.forEach((e) => console.error('ERROR', e)); process.exit(1); }
  console.log(`ok: ${doc.findings.length} findings, ${warn.length} warnings`);
} else {
  console.error('Usage: node validate.mjs <file.json> [--snapshot DIR] | --merge <audit-dir>'); process.exit(2);
}
