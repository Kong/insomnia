import {
  METHOD_DELETE,
  METHOD_GET,
  METHOD_HEAD,
  METHOD_OPTIONS,
  METHOD_PATCH,
  METHOD_POST,
  METHOD_PUT,
  METHOD_QUERY,
} from '../../common/constants';

/**
 * Shared HTTP method → theme colour mapping.
 *
 * Each method maps to one of the existing theme colour families (surprise,
 * success, warning, notice, danger, info). Unknown/custom methods fall back to
 * a neutral highlight so any string is renderable.
 */

// Tailwind classes for a filled "pill" button: solid background + matching font.
// The themed methods use the existing theme colour families (so they recolour
// with the active theme); in the default theme they render as the design hexes:
// POST #7ECF2B, PUT #FF9A1F, PATCH #F0E137, DELETE #FF5631, OPTIONS/HEAD #46C1E6.
const METHOD_PILL_CLASSES: Record<string, string> = {
  [METHOD_POST]: 'bg-(--color-success) text-(--color-font-success)',
  [METHOD_PUT]: 'bg-(--color-warning) text-(--color-font-warning)',
  [METHOD_PATCH]: 'bg-(--color-notice) text-(--color-font-notice)',
  [METHOD_DELETE]: 'bg-(--color-danger) text-(--color-font-danger)',
  [METHOD_OPTIONS]: 'bg-(--color-info) text-(--color-font-info)',
  [METHOD_HEAD]: 'bg-(--color-info) text-(--color-font-info)',
  [METHOD_QUERY]: 'bg-(--color-surprise) text-(--color-font-surprise)',
};

// GET uses a bespoke darker purple (#6B6296), not the raw surprise theme colour,
// and — unlike every other method — is not darkened by the overlay.
const GET_PILL_CLASSES = 'bg-[#6B6296] text-white';

// Custom/unknown methods (e.g. LINK) use a neutral grey (#424242).
const NEUTRAL_PILL_CLASSES = 'bg-[#424242] text-white';

// Tailwind classes for the method name rendered as coloured text (no background).
const METHOD_TEXT_CLASSES: Record<string, string> = {
  [METHOD_GET]: 'text-(--color-surprise)',
  [METHOD_POST]: 'text-(--color-success)',
  [METHOD_PUT]: 'text-(--color-warning)',
  [METHOD_PATCH]: 'text-(--color-notice)',
  [METHOD_DELETE]: 'text-(--color-danger)',
  [METHOD_OPTIONS]: 'text-(--color-info)',
  [METHOD_HEAD]: 'text-(--color-info)',
  [METHOD_QUERY]: 'text-(--color-surprise)',
};

const NEUTRAL_TEXT_CLASSES = 'text-(--color-font)';

// A translucent black overlay (#00000066 → rgba(0,0,0,0.4)) layered on top of the
// background colour to darken it. Applied to every themed method so the palette
// reads as a cohesive set of related shades. GET and the neutral fallback are
// exempt (they already use their final bespoke colour).
const DARKEN_OVERLAY_CLASS = '[background-image:linear-gradient(rgba(0,0,0,0.4),rgba(0,0,0,0.4))]';

/**
 * Classes for a filled method pill/button (background + font colour). Themed
 * methods get the darkening overlay; GET and custom/unknown methods use their
 * bespoke colour as-is.
 */
export const getMethodPillClasses = (method: string): string => {
  if (method === METHOD_GET) {
    return GET_PILL_CLASSES;
  }
  const base = METHOD_PILL_CLASSES[method];
  if (!base) {
    return NEUTRAL_PILL_CLASSES;
  }
  return `${base} ${DARKEN_OVERLAY_CLASS}`;
};

/**
 * Classes for the method name rendered as coloured text (used for dropdown
 * menu items).
 */
export const getMethodTextClasses = (method: string): string => {
  return METHOD_TEXT_CLASSES[method] || NEUTRAL_TEXT_CLASSES;
};
