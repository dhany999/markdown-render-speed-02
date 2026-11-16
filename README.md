# markdown-render-speed-02 — a fast marked-compatible renderer

`parse.js` is a dependency-free ES module. Its `parse(markdown)` returns
the same HTML that marked 18.1.3 produces with its default options
(GFM on, soft breaks preserved, pedantic off, synchronous). `main.ts`
is the thin driver: it reads `/input/cases.json`, renders each case
separately through `parse`, and writes the results to `/output/html.json`.

## Design

Everything is hand-written scanning code — no libraries, and no
regular expressions on the hot paths:

- **Blocks**: a line-based parser covering ATX and setext headings,
  fenced and indented code, raw HTML blocks, block quotes (including
  lazy continuation), lists (per-item content offsets, tight/loose
  decided from child line spans), GFM tables, and link reference
  definitions.
- **Inline**: one tokenizing pass (code spans, backslash escapes,
  entities, raw HTML, links and images with reference lookup, GFM
  autolinks), then the CommonMark delimiter-stack pass for emphasis,
  strong emphasis, and strikethrough.
- **Speed**: charCode/indexOf scanning, merged text runs, regex
  fast paths inside the escapers, and gates so autolink scans only
  start at word boundaries.

Each `parse()` call is independent: nothing is cached between calls,
no shared mutable state, no network, no clock or environment reads,
so the output is deterministic.
