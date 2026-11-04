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

// Tailwind classes for a soft "pill" button: a light tint of the method colour behind coloured text.
const METHOD_PILL_CLASSES: Record<string, string> = {
  [METHOD_GET]: 'bg-[color-mix(in_srgb,var(--color-surprise)_18%,transparent)] text-(--color-surprise)',
  [METHOD_POST]: 'bg-[color-mix(in_srgb,var(--color-success)_16%,transparent)] text-(--color-success)',
  [METHOD_PUT]: 'bg-[color-mix(in_srgb,var(--color-warning)_16%,transparent)] text-(--color-warning)',
  [METHOD_PATCH]: 'bg-[color-mix(in_srgb,var(--color-notice)_16%,transparent)] text-(--color-notice)',
  [METHOD_DELETE]: 'bg-[color-mix(in_srgb,var(--color-danger)_16%,transparent)] text-(--color-danger)',
  [METHOD_OPTIONS]: 'bg-[color-mix(in_srgb,var(--color-info)_16%,transparent)] text-(--color-info)',
  [METHOD_HEAD]: 'bg-[color-mix(in_srgb,var(--color-info)_16%,transparent)] text-(--color-info)',
  [METHOD_QUERY]: 'bg-[color-mix(in_srgb,var(--color-surprise)_18%,transparent)] text-(--color-surprise)',
};

// Custom/unknown methods (e.g. LINK) stay neutral.
const NEUTRAL_PILL_CLASSES = 'bg-(--hl-sm) text-(--color-font)';

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

/**
 * Classes for a soft method pill/button. Custom/unknown methods stay neutral.
 */
export const getMethodPillClasses = (method: string): string => {
  return METHOD_PILL_CLASSES[method] || NEUTRAL_PILL_CLASSES;
};

/**
 * Classes for the method name rendered as coloured text (used for dropdown
 * menu items).
 */
export const getMethodTextClasses = (method: string): string => {
  return METHOD_TEXT_CLASSES[method] || NEUTRAL_TEXT_CLASSES;
};
