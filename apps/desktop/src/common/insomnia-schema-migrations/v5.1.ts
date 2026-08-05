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
 * Normalizes script objects by removing empty strings and preserving non-empty content.
 * This is used for both migration and diff detection to ensure consistent behavior.
 *
 * CRITICAL WARNING: This function is shared between migration and diff detection!
 *    Any changes to this function will affect BOTH systems:
 *    - Data migration (permanent changes to user files)
 *    - Diff detection (comparison logic for commit prompts)
 *    - User experience (false positives/negatives in change detection)
 *
 * @param scripts - The scripts object to normalize
 * @returns Normalized scripts object or undefined if no content
 */
export function normalizeScripts(scripts: any): any {
  if (!scripts || typeof scripts !== 'object') {
    return scripts;
  }

  const normalized: any = {};
  let hasAnyContent = false;

  for (const [scriptKey, scriptValue] of Object.entries(scripts)) {
    if (scriptKey === 'preRequest' || scriptKey === 'afterResponse') {
      // Only keep non-empty script values
      if (scriptValue && scriptValue !== '') {
        normalized[scriptKey] = scriptValue;
        hasAnyContent = true;
      }
    } else {
      // Keep other properties as-is
      normalized[scriptKey] = scriptValue;
      hasAnyContent = true;
    }
  }

  return hasAnyContent ? normalized : undefined;
}

/**
 * Recursively traverses an object and cleans headers/parameters/params/cookies arrays by:
 * - Removing `id` fields from objects inside `headers`, `parameters`, `body.params`, or `cookies` arrays
 * - Removing timestamp fields (`creation`, `lastAccessed`) from `cookies` arrays
 * - Removing empty script objects (with only empty `preRequest` and `afterResponse` strings)
 * - Filtering out empty entries (those without name or value)
 * - Removing empty arrays if all entries were filtered out
 * - Skipping `spec.contents` fields which contain OpenAPI specs that should not be migrated
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
      // Skip the contents field of spec objects - these contain OpenAPI specs
      // which should not be migrated (they have their own schema)
      if (key === 'contents' && value && typeof value === 'object') {
        cleaned[key] = value;
        continue;
      }

      if (
        (key === 'headers' || key === 'parameters' || key === 'params' || key === 'metadata') &&
        Array.isArray(value)
      ) {
        const filteredAndCleaned = value
          .filter(entry => {
            if (!entry || typeof entry !== 'object') return false;

            // Keep file upload entries (they're valid even with empty name/value)
            if (entry.type === 'file' && entry.fileName) {
              return true;
            }

            // Keep OpenAPI $ref entries (schema references)
            if (entry.$ref || entry['$ref']) {
              return true;
            }

            // Keep entries with OpenAPI-specific properties
            if (entry.schema || entry.in || entry.required !== undefined) {
              return true;
            }

            // Keep regular entries with name or value
            return entry.name || entry.value;
          })
          .map(entry => {
            // Handle $ref entries: preserve the reference structure but remove the id field
            // This keeps OpenAPI component references intact while cleaning up Insomnia-added ids
            if (entry.$ref || entry['$ref']) {
              const { id, ...rest } = entry;

              return rest;
            }

            const { id, ...rest } = entry; // remove `id` only here

            if (key === 'headers' && !('name' in rest && 'value' in rest)) {
              // Ensure headers have name and value fields
              // Refer INS-1822, legacy app might have headers without name or value and that kind of request will be parsed as GRPC request
              rest.name = rest.name || '';
              rest.value = rest.value || '';
            }

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
            const { creation, lastAccessed, ...rest } = entry;
            return cleanHeadersAndParameters(rest);
          });

        // Only add the key if there are remaining entries
        if (filteredAndCleaned.length > 0) {
          cleaned[key] = filteredAndCleaned;
        }
        continue;
      } else if (key === 'scripts' && value && typeof value === 'object') {
        // Clean scripts object by removing empty strings
        const normalized = normalizeScripts(value);

        if (normalized) {
          cleaned[key] = normalized;
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
