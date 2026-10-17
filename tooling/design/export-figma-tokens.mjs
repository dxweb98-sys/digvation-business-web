/**
 * Exports the Digvation Design System tokens (the semantic CSS variables shipped by
 * `@digvation/ui/styles.css`) as a W3C design-token JSON file that Figma can import, either
 * through the Tokens Studio plugin or as Figma Variables.
 *
 * The design system package stays the source of truth: re-run this after upgrading
 * `@digvation/ui` instead of editing the generated file by hand.
 *
 * Usage: pnpm design:tokens
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const output = resolve(root, 'docs/design/figma/digvation-tokens.json');

// @digvation/ui is a dependency of the apps, not of the workspace root.
const requireFromBackoffice = createRequire(resolve(root, 'apps/backoffice/package.json'));
const stylesPath = requireFromBackoffice.resolve('@digvation/ui/styles.css');
const css = await readFile(stylesPath, 'utf8');
const uiVersion = JSON.parse(
  await readFile(resolve(dirname(stylesPath), '../package.json'), 'utf8'),
).version;

// Selectors are compared without whitespace or quotes so minified and formatted CSS both match.
const normalizeSelector = (selector) => selector.replace(/[\s'"]/g, '');

/** Returns the custom properties declared by the first rule with exactly this selector. */
function declarationsFor(selector) {
  for (const [, ruleSelector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (normalizeSelector(ruleSelector) !== normalizeSelector(selector)) continue;
    const properties = {};
    for (const [, name, value] of body.matchAll(/--([\w-]+):([^;]+)/g)) {
      properties[name] = value.trim();
    }
    return properties;
  }
  throw new Error(`Selector not found in @digvation/ui styles: ${selector}`);
}

const base = declarationsFor(':root,:host');
const light = declarationsFor(':root,:root[data-ds-mode=light]');
const dark = declarationsFor(':root[data-ds-mode=dark]');
const compact = declarationsFor(':root[data-theme-radius=COMPACT]');
const rounded = declarationsFor(':root[data-theme-radius=ROUNDED]');

function hex(value) {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : value;
}

function rem(value) {
  const match = /^([\d.]+)rem$/.exec(value);
  return match ? `${Number(match[1]) * 16}px` : value;
}

const px = (length) => (length === '0' ? '0px' : length);

/** Converts `x y blur [spread] color` layers into W3C shadow token values. */
function shadow(value) {
  return value.split(',').map((layer) => {
    const parts = layer.trim().split(/\s+/);
    const color = parts.pop();
    const [offsetX, offsetY, blur, spread = '0'] = parts.map(px);
    return { offsetX, offsetY, blur, spread: px(spread), color: hex(color) };
  });
}

const token = (type, value, description) => ({
  $type: type,
  $value: value,
  ...(description ? { $description: description } : {}),
});

function colorSet(source) {
  const colors = {};
  for (const [name, value] of Object.entries(source)) {
    if (!name.startsWith('color-')) continue;
    colors[name.slice('color-'.length)] = token('color', hex(value));
  }
  return colors;
}

function shadowSet(source) {
  const shadows = {};
  for (const name of ['shadow-sm', 'shadow-md', 'shadow-lg']) {
    shadows[name.slice('shadow-'.length)] = token('shadow', shadow(source[name]));
  }
  shadows.panel = token('shadow', '{shadow.md}');
  return shadows;
}

const radiusSet = (source) => ({
  control: token('dimension', source['radius-control']),
  card: token('dimension', source['radius-card']),
  panel: token('dimension', source['radius-panel']),
});

const spacingSteps = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
const spacingUnit = Number.parseFloat(rem(base.spacing));
const spacing = Object.fromEntries(
  spacingSteps.map((step) => [
    String(step).replace('.', '_'),
    token('dimension', `${step * spacingUnit}px`),
  ]),
);

const fontSize = {};
const lineHeight = {};
for (const size of ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl']) {
  const sizePx = Number.parseFloat(rem(base[`text-${size}`]));
  fontSize[size] = token('dimension', `${sizePx}px`);
  // Tailwind writes line heights as calc(<line height rem> / <font size rem>).
  const ratio = /calc\(([\d.]+)\s*\/\s*([\d.]+)\)/.exec(base[`text-${size}--line-height`]);
  lineHeight[size] = token('dimension', `${Math.round(Number(ratio[1]) * 16)}px`);
}

const primaryFont = light['font-sans'].split(',')[0].replace(/['"]/g, '').trim();

const tokens = {
  global: {
    spacing,
    radius: {
      sm: token('dimension', rem(base['radius-sm'])),
      md: token('dimension', rem(base['radius-md'])),
      lg: token('dimension', rem(base['radius-lg'])),
      xl: token('dimension', rem(base['radius-xl'])),
      '2xl': token('dimension', rem(base['radius-2xl'])),
    },
    font: {
      family: { sans: token('fontFamily', primaryFont) },
      weight: {
        regular: token('fontWeight', 400),
        medium: token('fontWeight', Number(base['font-weight-medium'])),
        semibold: token('fontWeight', Number(base['font-weight-semibold'])),
        bold: token('fontWeight', Number(base['font-weight-bold'])),
      },
      size: fontSize,
      lineHeight,
    },
  },
  'mode/light': { color: colorSet(light), shadow: shadowSet(light) },
  'mode/dark': {
    // Dark mode only overrides part of the palette; the accents are shared with light mode.
    color: { ...colorSet(light), ...colorSet(dark) },
    shadow: shadowSet(dark),
  },
  'radius/soft': { radius: radiusSet(light) },
  'radius/compact': { radius: radiusSet(compact) },
  'radius/rounded': { radius: radiusSet(rounded) },
  $themes: [],
  $metadata: {
    source: `@digvation/ui@${uiVersion} dist/styles.css`,
    note: 'Generated by tooling/design/export-figma-tokens.mjs. Do not edit by hand.',
    tokenSetOrder: [
      'global',
      'mode/light',
      'mode/dark',
      'radius/soft',
      'radius/compact',
      'radius/rounded',
    ],
  },
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(tokens, null, 2)}\n`);
console.log(`Wrote ${output.slice(root.length + 1)} from @digvation/ui@${uiVersion}.`);
