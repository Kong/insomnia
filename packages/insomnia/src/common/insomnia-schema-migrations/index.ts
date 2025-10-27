import { parse, stringify } from 'yaml';

import type { InsomniaFile } from '~/common/import-v5-parser';
import { INSOMNIA_SCHEMA_VERSION } from '~/common/insomnia-schema-migrations/schema-version';
import { cleanHeadersAndParameters } from '~/common/insomnia-schema-migrations/v5.1';

interface Migration<T> {
  version: string;
  up: (data: T) => T;
}

/**
 * Compares two semantic version strings (e.g., "5.0" vs "5.1").
 * Returns 1 if newVersion > oldVersion, -1 if newVersion < oldVersion, 0 if equal.
 */
function compareVersions(oldVersion: string, newVersion: string): number {
  const oldParts = oldVersion.split('.').map(Number);
  const newParts = newVersion.split('.').map(Number);
  for (let i = 0; i < Math.max(oldParts.length, newParts.length); i++) {
    const oldNum = oldParts[i] ?? 0;
    const newNum = newParts[i] ?? 0;
    if (oldNum > newNum) return 1;
    if (oldNum < newNum) return -1;
  }
  return 0;
}

/**
 * Extracts the schema version from parsed Insomnia data.
 * Uses the new schema_version field if available, otherwise defaults to 5.0.
 */
function getVersionFromParsed(parsed: InsomniaFile): string {
  // If schema_version field exists, use it (new approach)
  if (parsed?.schema_version && typeof parsed.schema_version === 'string') {
    return parsed.schema_version;
  }

  // No schema_version field means it's v5.0 (original version)
  return '5.0';
}

// Migration registry - sorted by version for efficient processing
const migrations: Migration<any>[] = [
  {
    version: '5.1',
    up: cleanHeadersAndParameters,
  },
  // ...add more migrations as needed
];

/**
 * Enhanced version of migrateToLatestYaml that also normalizes property order.
 * This combines data migration with property order normalization to prevent
 * false positives from property reordering in diff detection.
 *
 * @param yamlContent - The YAML content to migrate
 * @param referenceContent - Optional reference content to normalize property order against
 * @returns Migrated and normalized YAML content
 */
export function migrateToLatestYaml(yamlContent: string, referenceContent?: string): string {
  try {
    const parsed = parse(yamlContent);
    const version = getVersionFromParsed(parsed);

    // Early exit: if already at latest version, return original content
    if (version === INSOMNIA_SCHEMA_VERSION) {
      return yamlContent;
    }

    // Migrate the data
    const migrated = migrateToLatest(parsed, version);

    // If reference content is provided, normalize property order
    if (referenceContent) {
      try {
        const referenceParsed = parse(referenceContent);
        const normalized = normalizeInsomniaFile(migrated, referenceParsed);

        return stringify(normalized);
      } catch (refError) {
        console.warn('Property order normalization failed, returning migrated content:', refError);
        return stringify(migrated);
      }
    }

    return stringify(migrated);
  } catch (error) {
    // If migration fails, return the original content
    console.warn('Schema migration failed, returning original content:', error);
    return yamlContent;
  }
}

/**
 * Migrates data from a given version to the latest version using all necessary migrations.
 * Optimized to only apply migrations that are actually needed.
 */
function migrateToLatest<T>(data: InsomniaFile, fromVersion: string): T {
  let current = data;

  // Apply only the migrations that are needed
  for (const migration of migrations) {
    if (compareVersions(migration.version, fromVersion) > 0) {
      current = migration.up(current);
    }
  }

  // Only add schema_version if it doesn't exist and we actually performed migrations
  // Check if any migrations were actually applied by comparing the result with the original
  const hasChanges = JSON.stringify(current) !== JSON.stringify(data);
  if (!current.schema_version && hasChanges) {
    current.schema_version = INSOMNIA_SCHEMA_VERSION;
  }

  return current as T;
}

/**
 * Normalizes the property order of an object to match a reference object structure.
 * This ensures consistent property ordering across migrated files.
 *
 * @param obj - The object to normalize
 * @param reference - The reference object to match property order against
 * @returns Object with property order normalized to match reference
 */
export function normalizePropertyOrder<T>(obj: any, reference: any): T {
  if (Array.isArray(obj) && Array.isArray(reference)) {
    // Create a map of reference items by their IDs for faster lookup
    const referenceMap = new Map();
    const referenceOrder: string[] = [];

    reference.forEach(refItem => {
      if (refItem?.meta?.id) {
        referenceMap.set(refItem.meta.id, refItem);
        referenceOrder.push(refItem.meta.id);
      }
    });

    // Sort obj items to match reference order
    const sorted = [];
    const unmatched = [];

    // First, add items that match reference order
    for (const refId of referenceOrder) {
      const matchingItem = obj.find(item => item?.meta?.id === refId);
      if (matchingItem) {
        const refItem = referenceMap.get(refId);
        sorted.push(normalizePropertyOrder(matchingItem, refItem));
      }
    }

    // Then add any unmatched items
    for (const item of obj) {
      if (!item?.meta?.id || !referenceMap.has(item.meta.id)) {
        unmatched.push(item);
      }
    }

    return [...sorted, ...unmatched] as T;
  }

  if (obj && typeof obj === 'object' && reference && typeof reference === 'object') {
    const normalized: Record<string, any> = {};

    // First, add properties in the same order as the reference
    for (const key of Object.keys(reference)) {
      if (key in obj) {
        normalized[key] = normalizePropertyOrder(obj[key], reference[key]);
      }
    }

    // Then, add any remaining properties from obj that weren't in reference
    for (const key of Object.keys(obj)) {
      if (!(key in reference)) {
        normalized[key] = obj[key]; // Don't recurse with undefined reference
      }
    }

    return normalized as T;
  }

  return obj;
}

/**
 * Enhanced version of cleanHeadersAndParameters that also normalizes property order.
 * This ensures both data cleaning and consistent property ordering.
 *
 * @param obj - The object to clean and normalize
 * @param reference - Optional reference object for property order normalization
 * @returns Cleaned and normalized object
 */
function normalizeInsomniaFile<T>(obj: any, reference?: any): T {
  // If reference is provided, normalize property order
  if (reference) {
    return normalizePropertyOrder(obj, reference);
  }

  return obj as T;
}
