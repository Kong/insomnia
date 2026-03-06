import path from 'node:path';

import { diffLines } from 'diff';
import { parse } from 'yaml';

import { normalizeScripts } from '~/common/insomnia-schema-migrations/v5.1';

/**
 * Defines the configuration for intelligent YAML diffing.
 *
 * - `ignoreKeys`: keys to ignore *globally* (regardless of where they appear)
 * - `scopedIgnore`: keys to ignore only when they appear under specific parent objects
 *
 * Example:
 *   scopedIgnore: {
 *     parameters: ["id"],   // ignore `id` under `parameters`
 *     headers: ["id"],      // ignore `id` under `headers`
 *     body: ["mimeType"],   // ignore `mimeType` under `body`
 *     meta: ["modified", "created"], // ignore these keys under `meta`
 *     params: ["id"],       // ignore `id` under `params` (body.params)
 *     cookies: ["creation", "lastAccessed"], // ignore these keys under `cookies`
 *   }
 */
interface IntelligentDiffConfig {
  ignoreKeys: string[];
  scopedIgnore?: Record<string, string[]>;
}

/**
 * - Does not ignore any key globally.
 * - Ignores specific keys only when they appear under specific parents.
 */
const DEFAULT_CONFIG: IntelligentDiffConfig = {
  ignoreKeys: ['schema_version'],
  scopedIgnore: {
    parameters: ['id'],
    headers: ['id'],
    body: ['mimeType'],
    meta: ['modified', 'created'],
    metadata: ['id'],
    params: ['id'],
    cookies: ['creation', 'lastAccessed'],
  },
};

/**
 * Recursively traverses the object and removes keys that should be ignored,
 * based on the given configuration.
 *
 * - If a key appears in `ignoreKeys`, it is always removed.
 * - If a key appears in `scopedIgnore[parentKey]`, it is removed only when the parent matches.
 *
 * @param obj - The object to clean
 * @param config - The intelligent diff configuration
 * @returns A new object with ignored keys removed
 */
function cleanObject<T>(obj: T, config: IntelligentDiffConfig, parentKey?: string): T {
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item, config, parentKey)) as T;
  }

  if (obj && typeof obj === 'object') {
    const cleaned: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      // 1. Global ignores
      if (config.ignoreKeys.includes(key)) continue;

      // 2. Scoped ignores
      const scopedKeys = parentKey ? config.scopedIgnore?.[parentKey] : undefined;
      if (scopedKeys && scopedKeys.includes(key)) continue;

      // 3. Special handling for script objects - normalize empty strings
      if (key === 'scripts' && value && typeof value === 'object') {
        // WARNING: This uses shared logic with migration system (v5.1.ts)
        //    Changes to normalizeScripts() will affect BOTH migration AND diff detection
        //    Be extremely careful when modifying this function as it impacts:
        //    - Data migration (permanent changes to user files)
        //    - Diff detection (comparison logic for commit prompts)
        //    - User experience (false positives/negatives in change detection)
        const normalized = normalizeScripts(value);

        if (normalized) {
          cleaned[key] = normalized;
        }
        // If no content, skip the scripts object entirely
        continue;
      }

      // 4. Recurse
      cleaned[key] = cleanObject(value, config, key);
    }

    return cleaned as T;
  }

  return obj;
}

/**
 * Recursively sorts the keys of an object (for deterministic JSON comparison).
 * Arrays are preserved in order, but their elements are also sorted recursively.
 */
function sortObject<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(sortObject) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const sortedEntries = Object.keys(obj)
      .sort()
      .map(key => [key, sortObject((obj as Record<string, unknown>)[key])]);

    return Object.fromEntries(sortedEntries) as T;
  }

  return obj;
}

// Treat undefined, null, and missing key as equivalent
function emptyKeyReplacer(_key: string, value: any) {
  if (value === null || value === '') {
    return;
  }
  return value;
}

/**
 * Performs original deep equality check by comparing canonical (sorted) JSON strings.
 * Works best for JSON-compatible data (objects, arrays, primitives).
 */
function deepEqual<T>(original: T, modified: T): boolean {
  return (
    JSON.stringify(sortObject(original), emptyKeyReplacer) === JSON.stringify(sortObject(modified), emptyKeyReplacer)
  );
}

/**
 * Main function to determine if two YAML files have meaningful differences.
 *
 * Steps:
 *  1. Parse YAML contents.
 *  2. Clean both objects by removing ignored keys.
 *  3. Compare the cleaned structures using deep equality.
 *  4. Return `true` if there are significant (non-cosmetic) changes.
 *
 * If YAML parsing fails, falls back to raw string comparison.
 *
 * @param originalContent - The original YAML file contents
 * @param modifiedContent - The modified YAML file contents
 * @param filePath - File path (used to detect `.yaml`)
 * @param config - Optional custom diff configuration
 * @returns `true` if meaningful differences exist, else `false`
 */
export function hasSignificantChanges(
  originalContent: string,
  modifiedContent: string,
  filePath: string,
  config: Partial<IntelligentDiffConfig> = {},
): boolean {
  // Non-YAML files → raw string comparison
  if (path.extname(filePath) !== '.yaml') {
    return originalContent !== modifiedContent;
  }

  // Merge default and user config
  const merged = { ...DEFAULT_CONFIG, ...config };

  try {
    // Parse YAML
    const original = parse(originalContent);
    const modified = parse(modifiedContent);

    // Remove ignored keys
    const cleanedOriginal = cleanObject(original, merged);
    const cleanedModified = cleanObject(modified, merged);

    // Compare cleaned structures
    return !deepEqual(cleanedOriginal, cleanedModified);
  } catch (err) {
    console.warn('Parse error:', err);
    return originalContent !== modifiedContent;
  }
}

/**
 * Find lines that represent "system changes" - lines that were modified (not added/deleted)
 * and contain the "modified" property.
 *
 * A "modification" is detected by finding adjacent removed and added chunks in the diff.
 * For each such pair, we check if any line contains "modified" and mark those lines.
 */
export function findSystemChangeLines(
  original: string,
  modified: string,
): {
  originalLines: number[];
  modifiedLines: number[];
} {
  const originalLines: number[] = [];
  const modifiedLines: number[] = [];

  try {
    const changes = diffLines(original, modified);

    let originalLineNumber = 1;
    let modifiedLineNumber = 1;

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      const lines = change.value.split('\n');
      // diffLines includes trailing newline, so remove empty last element
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }
      const lineCount = lines.length;

      if (!change.added && !change.removed) {
        // Unchanged lines - advance both line counters
        originalLineNumber += lineCount;
        modifiedLineNumber += lineCount;
      } else if (change.removed && !change.added) {
        // Check if next change is an addition (which would make this a modification)
        const nextChange = changes[i + 1];
        if (nextChange && nextChange.added && !nextChange.removed) {
          // This is a modification: removed lines followed by added lines
          const addedLines = nextChange.value.split('\n');
          if (addedLines[addedLines.length - 1] === '') {
            addedLines.pop();
          }

          // Check each line pair for "modified" property
          // For modifications, we consider lines that contain "modified:" in either version
          lines.forEach((originalLine, j) => {
            if (originalLine && /\bmodified\b/.test(originalLine)) {
              originalLines.push(originalLineNumber + j);
            }
          });

          addedLines.forEach((modifiedLine, j) => {
            if (modifiedLine && /\bmodified\b/.test(modifiedLine)) {
              modifiedLines.push(modifiedLineNumber + j);
            }
          });

          // Advance original line counter for removed lines
          originalLineNumber += lineCount;
          // Advance modified line counter for added lines
          modifiedLineNumber += addedLines.length;
          // Skip the next change since we've processed it
          i++;
        } else {
          // Pure deletion - just advance original line counter
          originalLineNumber += lineCount;
        }
      } else if (change.added && !change.removed) {
        // Pure addition - just advance modified line counter
        modifiedLineNumber += lineCount;
      }
    }
  } catch (error) {
    console.error('Error finding system change lines:', error);
  }

  return { originalLines, modifiedLines };
}
