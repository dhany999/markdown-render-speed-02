// main.ts — harness driver for this entry.
// It loads the test cases, renders each one on its own with parse(),
// and saves the resulting HTML strings as a JSON array.
//
// Input:  $MAKEFUN_INPUT_DIR/cases.json (defaults to /input/cases.json)
// Output: $MAKEFUN_OUTPUT_DIR/html.json (defaults to /output/html.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './parse.js';

const inDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const raw = readFileSync(join(inDir, 'cases.json'), 'utf8');
const cases = JSON.parse(raw) as { id: string; markdown: string }[];
if (!Array.isArray(cases)) throw new Error('cases.json must hold an array');

const rendered: string[] = [];
for (const item of cases) {
  if (typeof item.markdown !== 'string') {
    throw new Error('case ' + String(item.id) + ' is missing string markdown');
  }
  const out = parse(item.markdown);
  if (typeof out !== 'string') {
    throw new Error('parse() returned a non-string for case ' + String(item.id));
  }
  rendered.push(out);
}
writeFileSync(join(outDir, 'html.json'), JSON.stringify(rendered));
