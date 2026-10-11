# Contributing

Thanks for helping. The project has two halves:

- **The collector** (`scripts/`): plain Node 22, no npm dependencies, drives a local Chrome over the DevTools
  Protocol. It must stay read-only and polite. Every new check needs a planted case in `test/fixture/server.mjs`
  and an assertion in `test/run.mjs`. Run `npm test` before opening a pull request.
- **The agents** (`agents/`, `skills/audit/SKILL.md`, `reference/METHOD.md`): plain Markdown. Improve a checklist,
  add a false positive you have seen in the wild, or sharpen the method. Keep the rules in `METHOD.md` and the
  area-specific know-how in the specialist files.

## Ground rules

1. **Evidence or it did not happen.** No check may produce a finding without a file or a reproducible step behind it.
2. **Read-only.** Nothing that submits forms, starts checkout, logs in or contacts a store. Adding to cart as a
   shopper is the only state change allowed.
3. **Respect robots.txt** and keep the request rate low. Never call endpoints a store's robots.txt disallows.
4. **No legal verdicts** in prompts or templates. Describe behaviour.
5. **No real client data** in examples, tests or issues. Use the fixture store or Shopify's public theme demo stores.

## Adding a specialist

1. Create `agents/<area>-<topic>.md` following an existing specialist (frontmatter, inputs, where to look, checks,
   do-not-report, output).
2. Add it to the table in its lead file (`agents/lead-<area>.md`) so the lead starts it in deep mode.
3. If it needs new data, add it to the collector and to `snapshot/INDEX.md` (built in `collect.mjs`).
4. Run `claude plugin validate --strict .` and `npm test`.
