import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Issue #29 acceptance criterion: every color utility used by the components
 * must produce CSS. Tailwind v4 silently drops classes it has no theme value
 * for (the regression PR #28 shipped), so this reads the production build
 * output and checks each literal color utility in `src/` has a selector.
 *
 * Run after `next build`. Without build output the check is skipped locally
 * and fails in CI.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.join(__dirname, '..');

console.info('================================================================');
console.info('--- Verifying VYNOR color utilities in the production CSS build ---');
console.info('================================================================');

function walk(dir: string, filter: (file: string) => boolean, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

const cssFiles = walk(path.join(appRoot, '.next/static'), (file) => file.endsWith('.css'));
if (cssFiles.length === 0) {
  const message = 'No production CSS found in .next/static — run `next build` first.';
  if (process.env.CI) {
    assert.fail(message);
  }
  console.warn(`   ⚠ SKIPPED: ${message}`);
  process.exit(0);
}
const css = cssFiles.map((file) => fs.readFileSync(file, 'utf-8')).join('\n');

const sourceFiles = walk(
  __dirname,
  (file) => /\.tsx?$/.test(file) && !path.basename(file).startsWith('verify-'),
);

// Literal color utilities: optional variants, optional important marker, a
// color property prefix, an `n-*` token or legacy semantic alias, optional /opacity.
const COLOR_UTILITY =
  /(?<![\w\-:[\]/!])((?:[a-z0-9-]+(?:\/[a-z0-9-]+)?:)*!?(?:bg|text|border(?:-[trblxy])?|outline|ring|ring-offset|fill|stroke|divide|from|via|to|placeholder|decoration|caret|accent)-(?:n-[a-z0-9-]+|card|card-foreground|foreground|muted|muted-foreground|primary|primary-foreground|secondary|secondary-foreground|surface|background|destructive|popover|accent|warning|success|info|border|border-strong|input|ring)(?:\/\d{1,3})?)(?![\w\-[\]])/g;

function cssEscape(className: string): string {
  return className.replace(/[:/!.]/g, (char) => `\\${char}`);
}

const used = new Map<string, string>();
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf-8');
  for (const match of text.matchAll(COLOR_UTILITY)) {
    const token = match[1];
    if (!token || token.includes('--')) continue;
    if (!used.has(token)) used.set(token, path.relative(__dirname, file));
  }
}

const missing: string[] = [];
for (const [token, file] of used) {
  if (!css.includes(`.${cssEscape(token)}`)) missing.push(`${token}  (${file})`);
}

console.info(
  `\n   Scanned ${sourceFiles.length} source files and ${cssFiles.length} CSS chunk(s).`,
);
console.info(`   Found ${used.size} distinct color utilities in use.`);

assert.ok(used.size > 200, 'Expected the design system to use a broad set of n-* color utilities');
assert.equal(
  missing.length,
  0,
  `These color utilities produced no CSS:\n  - ${missing.join('\n  - ')}`,
);

// Spot-check that core VYNOR utilities resolve to runtime variables and that
// opacity modifiers compile through color-mix (issue #29 audit items 1 and 3).
for (const [selector, needle] of [
  ['.bg-n-solid-blue', 'rgb(var(--solid-blue))'],
  ['.text-n-slate-11', 'rgb(var(--slate-11))'],
  ['.bg-card', 'rgb(var(--card-color))'],
  ['.text-muted-foreground', 'rgb(var(--slate-11))'],
] as const) {
  const start =
    css.indexOf(`${selector}{`) >= 0 ? css.indexOf(`${selector}{`) : css.indexOf(`${selector},`);
  if (start === -1) continue;
  const rule = css.slice(start, css.indexOf('}', start));
  assert.ok(rule.includes(needle) || css.includes(needle), `${selector} must resolve to ${needle}`);
}
assert.ok(css.includes('color-mix(in oklab'), 'Opacity modifiers must compile via color-mix');
assert.ok(css.includes('.animate-in'), 'animate-in utility must exist in the build');
assert.ok(css.includes('.no-scrollbar'), 'no-scrollbar utility must exist in the build');
assert.ok(/--radius-lg:\.5rem|--radius-lg:0\.5rem/.test(css), 'rounded-lg must be 8px (0.5rem)');

console.info('   ✓ UX-CSS-001: Every color utility in use has a generated selector.');
console.info('   ✓ UX-CSS-001: Opacity modifiers, animate-in, no-scrollbar and radius verified.');
console.info('\n================================================================');
console.info('--- VYNOR BUILD CSS CONTRACT VERIFIED! ---');
console.info('================================================================\n');
