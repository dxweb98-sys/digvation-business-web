/**
 * One item language for Workshop: the accepted Work Order items and the staged
 * selection in the picker share these typographic roles (name, meta, detail,
 * value) and the marker tile, and differ only in surface and controls.
 */
export const ITEM_NAME = 'text-sm font-semibold leading-snug text-(--color-text)';
export const ITEM_META = 'text-[13px] leading-snug text-(--color-text-muted)';
export const ITEM_DETAIL = 'text-[12px] leading-snug text-(--color-text-muted)/80';
export const ITEM_VALUE = 'font-semibold tabular-nums text-(--color-text)';
/** Aligns text that sits under an item marker (marker 36px + 12px gap). */
export const ITEM_INDENT = 'pl-12';

/**
 * Controlled depth. Three planes: the dialog canvas, a tonal PLANE (a
 * workspace or tray) and an OBJECT lifted from it by a micro-shadow. The
 * inset variant is a tray the objects sit in. No gradients, no large shadows.
 */
export const DEPTH_PLANE = 'bg-(--color-surface-muted)/70 ring-1 ring-black/[0.04]';
export const DEPTH_TRAY =
  'bg-(--color-surface-muted) shadow-[inset_0_1px_3px_rgba(16,24,40,0.07)] ring-1 ring-black/[0.05]';
export const DEPTH_OBJECT =
  'bg-(--color-surface) shadow-[0_1px_2px_rgba(16,24,40,0.06),0_1px_3px_rgba(16,24,40,0.1)] ring-1 ring-black/[0.04]';
