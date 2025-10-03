/**
 * Overview:
 * This migration is for Insomnia schema version 5.1.
 * In this version, the `id` fields were removed from objects inside `headers` and `parameters` arrays.
 * Additionally, empty headers/parameters (those without name or value) are filtered out.
 * If all headers/parameters are filtered out, the entire array is removed.
 * This file provides a migration function that, given a YAML string, parses it, removes all scoped `id` fields
 * from headers and parameters, filters out empty entries, and removes empty arrays.
 *
 * Usage:
 * - Used during data import to upgrade data from previous versions to the 5.1 schema.
 * - Ensures compatibility and consistency when loading or migrating older Insomnia data files.
 */

/**
 * Recursively traverses an object and cleans headers/parameters arrays by:
 * - Removing `id` fields from objects inside `headers` or `parameters` arrays
 * - Filtering out empty headers/parameters (those without name or value)
 * - Removing empty arrays if all entries were filtered out
 *
 * @param obj - The object to clean
 * @returns Cleaned object with scoped `id`s removed, empty entries filtered out, and empty arrays removed
 */
export function cleanHeadersAndParameters(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => cleanHeadersAndParameters(item));
  }

  if (obj && typeof obj === 'object') {
    const cleaned: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if ((key === 'headers' || key === 'parameters') && Array.isArray(value)) {
        const filteredAndCleaned = value
          .filter(entry => entry && typeof entry === 'object' && (entry.name || entry.value))
          .map(entry => {
            const { id, ...rest } = entry; // remove `id` only here
            return cleanHeadersAndParameters(rest);
          });

        // Only add the key if there are remaining entries
        if (filteredAndCleaned.length > 0) {
          cleaned[key] = filteredAndCleaned;
        }
        continue;
      } else {
        cleaned[key] = cleanHeadersAndParameters(value);
      }
    }

    return cleaned;
  }

  return obj;
}
