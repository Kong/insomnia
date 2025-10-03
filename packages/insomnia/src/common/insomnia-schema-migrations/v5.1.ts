/**
 * Overview:
 * This migration is for Insomnia schema version 5.1.
 * In this version, the `id` fields were removed from objects inside `headers` and `parameters` arrays.
 * This file provides a migration function that, given a YAML string, parses it, removes all scoped `id` fields
 * from headers and parameters, and returns the cleaned YAML string.
 *
 * Usage:
 * - Used during data import to upgrade data from previous versions to the 5.1 schema.
 * - Ensures compatibility and consistency when loading or migrating older Insomnia data files.
 */

/**
 * Recursively traverses an object and removes `id` fields
 * only from objects inside `headers` or `parameters` arrays.
 *
 * @param yamlContent - The YAML string to clean
 * @returns Cleaned YAML string with scoped `id`s removed
 */
export function removeScopedIdsFromYaml(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => removeScopedIdsFromYaml(item));
  }

  if (obj && typeof obj === 'object') {
    const cleaned: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if ((key === 'headers' || key === 'parameters') && Array.isArray(value)) {
        cleaned[key] = value.map(entry => {
          if (entry && typeof entry === 'object') {
            const { id, ...rest } = entry; // remove `id` only here
            return removeScopedIdsFromYaml(rest);
          }
          return entry;
        });
        continue;
      } else {
        cleaned[key] = removeScopedIdsFromYaml(value);
      }
    }

    return cleaned;
  }

  return obj;
}
