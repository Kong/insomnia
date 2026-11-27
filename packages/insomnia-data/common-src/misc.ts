import { v4 as uuidv4 } from 'uuid';

/**
 * Generate an ID of the format "<MODEL_NAME>_<TIMESTAMP><RANDOM>"
 * @param prefix
 * @returns {string}
 */
export function generateId(prefix?: string) {
  const id = uuidv4().replace(/-/g, '');

  if (prefix) {
    return `${prefix}_${id}`;
  }
  return id;
}

/**
 * Turns arbitrary text into a filesystem-safe slug: lowercased, accents
 * stripped, runs of non-alphanumeric characters collapsed to a single `-`,
 * leading/trailing `-` trimmed, and truncated to `maxLength`.
 *
 * Returns `''` when nothing usable remains (e.g. all-emoji or all-punctuation
 * input) — callers should treat that as "no slug available".
 */
export function slugify(input: string, maxLength = 40) {
  const slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '') // strip accents (combining diacritical marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= maxLength) {
    return slug;
  }
  return slug.slice(0, maxLength).replace(/-+$/g, '');
}

const ESCAPE_REGEX_MATCH = /[-[\]/{}()*+?.\\^$|]/g;

/**
 * Escape a dynamic string for use inside of a regular expression
 * @param str - string to escape
 * @returns {string} escaped string
 */
export function escapeRegex(str: string) {
  return str.replace(ESCAPE_REGEX_MATCH, '\\$&');
}

/**
 * Spacing used when a reordered item has only one neighbour (top or bottom of a
 * list), so later insertions still find room between keys.
 */
export const META_SORT_KEY_GAP = 100;

/**
 * `metaSortKey` that sorts after `lower` and, when `next` is given, before it:
 * the midpoint of the two, or one gap past `lower`.
 *
 * Equal or inverted neighbours cannot be split (two examples created in the same
 * millisecond, or imported with the same sort key), so they fall back to the
 * gap: the moved item still changes position instead of landing on a no-op.
 */
export function getMetaSortKeyAfter(lower: number, next?: number) {
  return next == null || next <= lower ? lower + META_SORT_KEY_GAP : lower + (next - lower) / 2;
}

/** `metaSortKey` that sorts before `upper`, one gap ahead of it. */
export function getMetaSortKeyBefore(upper: number) {
  return upper - META_SORT_KEY_GAP;
}
