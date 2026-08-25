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
