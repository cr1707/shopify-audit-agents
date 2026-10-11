#!/usr/bin/env node
// Compares two audits of the same store and writes CHANGES.md in the newer one: fixed, still open, new.
// Usage: node compare.mjs <older-audit-dir> <newer-audit-dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [oldDir, newDir] = process.argv.slice(2).map((d) => resolve(d));
if (!oldDir || !newDir) { console.error('Usage: node compare.mjs <older-audit-dir> <newer-audit-dir>'); process.exit(2); }
const load = (d) => JSON.parse(readFileSync(join(d, 'findings.json'), 'utf8'));
const A = load(oldDir), B = load(newDir);
const live = (F) => (F.findings || []).filter((f) => f.verification?.status !== 'rejected');
const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2));
const path = (f) => { try { return new URL(f.where?.[0]?.url).pathname; } catch { return ''; } };
const sim = (a, b) => { if (a.area !== b.area) return 0; const x = words(a.title), y = words(b.title); const inter = [...x].filter((w) => y.has(w)).length; return inter / Math.max(1, new Set([...x, ...y]).size) + (path(a) === path(b) ? 0.2 : 0); };
const oldF = live(A), newF = live(B); const used = new Set(); const pairs = [];
for (const o of oldF) { let best = null, bs = 0; for (const n of newF) { if (used.has(n.id)) continue; const s = sim(o, n); if (s > bs) { bs = s; best = n; } } if (best && bs >= 0.45) { used.add(best.id); pairs.push([o, best]); } }
const fixed = oldF.filter((o) => !pairs.some(([p]) => p === o));
const open = pairs; const added = newF.filter((n) => !used.has(n.id));
const L = [`# Changes since ${(A.collectedAt || '').slice(0, 10)}`, '', `Store: ${B.store}. Older audit: ${oldDir}. Newer audit: ${newDir}.`, '',
  `**${fixed.length} fixed or no longer seen · ${open.length} still open · ${added.length} new.** Matching is by area, page and title wording; check anything surprising by hand.`, '',
  '## Fixed or no longer seen', '', ...fixed.map((f) => `- ${f.title} (${f.severity}, ${f.area})`), '',
  '## Still open', '', ...open.map(([o, n]) => `- ${n.title} (${n.severity}${o.severity !== n.severity ? `, was ${o.severity}` : ''}, ${n.area})`), '',
  '## New', '', ...added.map((f) => `- ${f.title} (${f.severity}, ${f.area})`), ''];
writeFileSync(join(newDir, 'CHANGES.md'), L.join('\n'));
console.log(`CHANGES.md: ${fixed.length} fixed, ${open.length} still open, ${added.length} new`);
