/**
 * Exports the Digvation Design System tokens (the semantic CSS variables shipped by
 * `@digvation/ui/styles.css`) as a Tokens Studio JSON file, which the Tokens Studio for Figma
 * plugin turns into Figma variables, effect styles, and text styles.
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

// Tokens Studio's own token format: unitless numbers as strings, `value`/`type` keys.
const number = (length) => String(Number.parseFloat(rem(length)));

/** Converts `x y blur [spread] color` layers into Tokens Studio drop shadows. */
function shadow(value) {
  return value.split(',').map((layer) => {
    const parts = layer.trim().split(/\s+/);
    const color = hex(parts.pop());
    const [x, y, blur, spread = '0'] = parts.map(number);
    return { x, y, blur, spread, color, type: 'dropShadow' };
  });
}

const token = (type, value) => ({ value, type });

function modeSet(source) {
  const color = {};
  for (const [name, value] of Object.entries(source)) {
    if (name.startsWith('color-')) color[name.slice('color-'.length)] = token('color', hex(value));
  }
  const shadows = {};
  for (const size of ['sm', 'md', 'lg']) {
    shadows[size] = token('boxShadow', shadow(source[`shadow-${size}`]));
  }
  // --shadow-panel is var(--shadow-md).
  shadows.panel = token('boxShadow', shadow(source['shadow-md']));
  return { color, shadow: shadows };
}

const radiusSet = (source) => ({
  radius: Object.fromEntries(
    ['control', 'card', 'panel'].map((name) => [
      name,
      token('borderRadius', number(source[`radius-${name}`])),
    ]),
  ),
});

const spacingSteps = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
const spacingUnit = Number.parseFloat(rem(base.spacing));
const spacing = Object.fromEntries(
  spacingSteps.map((step) => [
    String(step).replace('.', '_'),
    token('spacing', String(step * spacingUnit)),
  ]),
);

const fontSizes = {};
const lineHeights = {};
for (const size of ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl']) {
  fontSizes[size] = token('fontSizes', number(base[`text-${size}`]));
  // Tailwind writes line heights as calc(<line height rem> / <font size rem>).
  const ratio = /calc\(([\d.]+)\s*\/\s*([\d.]+)\)/.exec(base[`text-${size}--line-height`]);
  lineHeights[size] = token('lineHeights', String(Math.round(Number(ratio[1]) * 16)));
}

const primaryFont = light['font-sans'].split(',')[0].replace(/['"]/g, '').trim();

// Text styles from docs/design/figma/design-system-library.md.
const textStyles = [
  ['display', '3xl', '3xl', 'bold'],
  ['heading', '2xl', '2xl', 'bold'],
  ['heading', 'xl', 'xl', 'semibold'],
  ['heading', 'lg', 'lg', 'semibold'],
  ['body', 'base', 'base', 'regular'],
  ['body', 'sm', 'sm', 'regular'],
  ['body', 'sm-medium', 'sm', 'medium'],
  ['caption', 'xs', 'xs', 'medium'],
  ['eyebrow', 'xs', 'xs', 'bold'],
];
const typography = {};
for (const [group, name, size, weight] of textStyles) {
  const eyebrow = group === 'eyebrow';
  typography[group] ??= {};
  typography[group][name] = token('typography', {
    fontFamily: '{fontFamilies.sans}',
    fontWeight: `{fontWeights.${weight}}`,
    fontSize: `{fontSizes.${size}}`,
    lineHeight: `{lineHeights.${size}}`,
    letterSpacing: eyebrow ? '14%' : '0%',
    paragraphSpacing: '0',
    textCase: eyebrow ? 'uppercase' : 'none',
    textDecoration: 'none',
  });
}

const tokens = {
  global: {
    spacing,
    borderRadius: Object.fromEntries(
      ['sm', 'md', 'lg', 'xl', '2xl'].map((size) => [
        size,
        token('borderRadius', number(base[`radius-${size}`])),
      ]),
    ),
    fontFamilies: { sans: token('fontFamilies', primaryFont) },
    fontWeights: {
      regular: token('fontWeights', 'Regular'),
      medium: token('fontWeights', 'Medium'),
      semibold: token('fontWeights', 'SemiBold'),
      bold: token('fontWeights', 'Bold'),
    },
    fontSizes,
    lineHeights,
    typography,
  },
  light: modeSet(light),
  // Dark mode only overrides part of the palette; the accents are shared with light mode.
  dark: modeSet({ ...light, ...dark }),
  'radius-soft': radiusSet(light),
  'radius-compact': radiusSet(compact),
  'radius-rounded': radiusSet(rounded),
  $themes: [],
  $metadata: {
    source: `@digvation/ui@${uiVersion} dist/styles.css`,
    note: 'Generated by tooling/design/export-figma-tokens.mjs. Do not edit by hand.',
    tokenSetOrder: ['global', 'light', 'dark', 'radius-soft', 'radius-compact', 'radius-rounded'],
  },
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(tokens, null, 2)}\n`);
console.log(`Wrote ${output.slice(root.length + 1)} from @digvation/ui@${uiVersion}.`);
