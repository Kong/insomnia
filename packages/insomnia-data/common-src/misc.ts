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
