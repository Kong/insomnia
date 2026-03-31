import path from 'node:path';

import { isMap, isScalar, isSeq, LineCounter, parse, type ParsedNode, parseDocument } from 'yaml';

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

interface Interval {
  start: number;
  end: number;
}

/**
 * Find lines that represent "system changes" within line change intervals.
 * The meta property and its children are considered system changes.
 */
export function findSystemChangeLines(
  modifiedYaml: string,
  lineChangeIntervals: { modifiedStartLineNumber: number; modifiedEndLineNumber: number }[],
) {
  const intersectIntervals: Interval[] = [];

  try {
    const changeIntervals = lineChangeIntervals.map(({ modifiedStartLineNumber, modifiedEndLineNumber }) => ({
      start: modifiedStartLineNumber,
      end: modifiedEndLineNumber,
    }));
    const systemLineIntervals = findMetaLineIntervals(modifiedYaml);

    const EVENT_TYPE = {
      CHANGE_START: 0,
      SYSTEM_START: 1,
      SYSTEM_END: 2,
      CHANGE_END: 3,
    } as const;

    type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

    interface Event {
      eventType: EventType;
      lineNumber: number;
    }

    const events: Event[] = [];

    changeIntervals.forEach(interval => {
      events.push(
        { eventType: EVENT_TYPE.CHANGE_START, lineNumber: interval.start },
        { eventType: EVENT_TYPE.CHANGE_END, lineNumber: interval.end },
      );
    });

    systemLineIntervals.forEach(interval => {
      events.push(
        { eventType: EVENT_TYPE.SYSTEM_START, lineNumber: interval.start },
        { eventType: EVENT_TYPE.SYSTEM_END, lineNumber: interval.end },
      );
    });

    // Line sweep algorithm to find intersecting intervals between change intervals and system line intervals
    // Sort events by line number, and for same line number, the order of event types is: CHANGE_START -> SYSTEM_START -> SYSTEM_END -> CHANGE_END
    events.sort((a, b) => {
      if (a.lineNumber !== b.lineNumber) {
        return a.lineNumber - b.lineNumber;
      }
      return a.eventType - b.eventType;
    });

    // Sweep through events to find intervals where both a change and a system change are active simultaneously
    let changeCount = 0;
    let systemCount = 0;
    let overlapStart: number | null = null;

    for (const event of events) {
      const wasOverlapping = changeCount > 0 && systemCount > 0;

      switch (event.eventType) {
        case EVENT_TYPE.CHANGE_START: {
          changeCount++;
          break;
        }
        case EVENT_TYPE.SYSTEM_START: {
          systemCount++;
          break;
        }
        case EVENT_TYPE.SYSTEM_END: {
          systemCount--;
          break;
        }
        case EVENT_TYPE.CHANGE_END: {
          changeCount--;
          break;
        }
        default: {
          break;
        }
      }

      const isOverlapping = changeCount > 0 && systemCount > 0;

      if (!wasOverlapping && isOverlapping) {
        overlapStart = event.lineNumber;
      } else if (wasOverlapping && !isOverlapping) {
        intersectIntervals.push({ start: overlapStart!, end: event.lineNumber });
        overlapStart = null;
      }
    }

    // Merge consecutive/overlapping intervals
    for (let i = 1; i < intersectIntervals.length; ) {
      const prev = intersectIntervals[i - 1];
      const curr = intersectIntervals[i];
      if (curr.start <= prev.end + 1) {
        prev.end = Math.max(prev.end, curr.end);
        intersectIntervals.splice(i, 1);
      } else {
        i++;
      }
    }
  } catch (error) {
    console.error('Error finding system change lines:', error);
  }

  return intersectIntervals;
}

// Get all line numbers (1-based, inclusive) spanned by a YAML AST node
function getNodeLineInterval(node: ParsedNode | null | undefined, lineCounter: LineCounter) {
  if (!node?.range) return;
  const [start, , end] = node.range as [number, number, number];
  const startLine = lineCounter.linePos(start).line;
  const endLine = end > start ? lineCounter.linePos(end - 1).line : startLine;
  if (endLine < startLine) return;
  return { start: startLine, end: endLine };
}

// Recursively find all line numbers belonging to 'meta' keys in a YAML string
function findMetaLineIntervals(yamlString: string) {
  const lineCounter = new LineCounter();
  const doc = parseDocument(yamlString, { lineCounter });
  const retIntervals: Interval[] = [];

  function walk(node: ParsedNode | null | undefined) {
    if (isMap(node)) {
      for (const pair of node.items) {
        if (isScalar(pair.key) && pair.key.value === 'meta') {
          // Collect the 'meta' key line + all value lines
          const intervalOfKey = getNodeLineInterval(pair.key, lineCounter);
          if (intervalOfKey) {
            retIntervals.push(intervalOfKey);
          }
          const intervalOfValue = getNodeLineInterval(pair.value, lineCounter);
          if (intervalOfValue) {
            retIntervals.push(intervalOfValue);
          }
        } else {
          walk(pair.value);
        }
      }
    } else if (isSeq(node)) {
      for (const item of node.items) {
        walk(item);
      }
    }
  }

  walk(doc.contents);
  return retIntervals;
}
