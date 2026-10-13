# Changelog

## 0.1.0 (2026-10-13)

First public release.

- `/shopify-audit-agents:audit <url> [quick|deep]`: 8 area leads, 24 specialists in deep mode, verifiers and an
  editor, ending in `report.html`, `report.md`, `FIX-WITH-CLAUDE.md` and `MANUAL-CHECKS.md`.
- Read-only collector with no npm dependencies (Node 22 and a local Chrome): pages on phone and desktop, an
  add-to-cart click test, pop-ups, cookie-consent behaviour, links, accessibility (axe-core), PageSpeed Insights and a
  key-free local speed measurement, public catalogue data.
- Safety net in the browser: checkout, account, contact and newsletter requests are blocked; robots.txt is respected.
- `--compare <previous audit>` writes `CHANGES.md`: fixed, still open and new.
- Example audit of Shopify's Dawn demo store with its full audit trail.

Fixes found by the first real audits and included in this release:

- Disabled buttons (for example a configurator waiting for options) are reported, never clicked.
- Leads wait for their specialists before merging in deep mode.
- Pages load with reduced motion, so contrast checks and screenshots see the final state.
- Logo images in headings, card links stretched over the whole card, and product image file names no longer produce
  false findings.
- The collector states what public catalogue data never contains (barcodes, stock, alt text on some stores) and
  when it covers only part of a large catalogue.
- Likely duplicate findings across areas are flagged for the verifiers and the editor.
