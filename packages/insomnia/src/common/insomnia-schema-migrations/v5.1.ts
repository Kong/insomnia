/**
 * Overview:
 * This migration is for Insomnia schema version 5.1.
 * In this version, the `id` fields were removed from objects inside `headers`, `parameters`, `body.params`, and `cookies` arrays.
 * Additionally, timestamp fields (`creation`, `lastAccessed`) are removed from cookies.
 * Empty script objects (with only empty `preRequest` and `afterResponse` strings) are removed.
 * Empty entries (those without name or value) are filtered out.
 * If all entries are filtered out, the entire array is removed.
 * This file provides a migration function that, given a YAML string, parses it, removes all scoped `id` fields
 * and cookie timestamps, filters out empty entries, and removes empty arrays and objects.
 *
 * Usage:
 * - Used during data import to upgrade data from previous versions to the 5.1 schema.
 * - Ensures compatibility and consistency when loading or migrating older Insomnia data files.
 */

/**
 * Recursively traverses an object and cleans headers/parameters/params/cookies arrays by:
 * - Removing `id` fields from objects inside `headers`, `parameters`, `body.params`, or `cookies` arrays
 * - Removing timestamp fields (`creation`, `lastAccessed`) from `cookies` arrays
 * - Removing empty script objects (with only empty `preRequest` and `afterResponse` strings)
 * - Filtering out empty entries (those without name or value)
 * - Removing empty arrays if all entries were filtered out
 *
 * @param obj - The object to clean
 * @returns Cleaned object with scoped `id`s and cookie timestamps removed, empty entries filtered out, and empty arrays and objects removed
 */
export function cleanHeadersAndParameters(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => cleanHeadersAndParameters(item));
  }

  if (obj && typeof obj === 'object') {
    const cleaned: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if ((key === 'headers' || key === 'parameters' || key === 'params') && Array.isArray(value)) {
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
      } else if (key === 'cookies' && Array.isArray(value)) {
        const filteredAndCleaned = value
          .filter(entry => entry && typeof entry === 'object' && (entry.key || entry.value))
          .map(entry => {
            const { creation, lastAccessed, ...rest } = entry; // remove `id` and timestamp fields
            return cleanHeadersAndParameters(rest);
          });

        // Only add the key if there are remaining entries
        if (filteredAndCleaned.length > 0) {
          cleaned[key] = filteredAndCleaned;
        }
        continue;
      } else if (key === 'scripts' && value && typeof value === 'object') {
        // Clean scripts object by removing empty strings
        const cleanedScripts: any = {};
        let hasAnyContent = false;

        for (const [scriptKey, scriptValue] of Object.entries(value)) {
          if (scriptKey === 'preRequest' || scriptKey === 'afterResponse') {
            // Only keep non-empty script values
            if (scriptValue && scriptValue !== '') {
              cleanedScripts[scriptKey] = scriptValue;
              hasAnyContent = true;
            }
          } else {
            // Keep other properties as-is
            cleanedScripts[scriptKey] = cleanHeadersAndParameters(scriptValue);
            hasAnyContent = true;
          }
        }

        // Only add scripts object if it has any content
        if (hasAnyContent) {
          cleaned[key] = cleanedScripts;
        }
        // If no content, skip the scripts object entirely
        continue;
      } else {
        cleaned[key] = cleanHeadersAndParameters(value);
      }
    }

    return cleaned;
  }

  return obj;
}
