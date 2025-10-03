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
 * Accepts a YAML string, parses it, detects the version, and migrates to the latest schema.
 * Optimized to avoid unnecessary processing when data is already at the latest version.
 */
export function migrateToLatestYaml(yamlContent: string): any {
  try {
    const parsed = parse(yamlContent);
    const version = getVersionFromParsed(parsed);

    // Early exit: if already at latest version, return original content
    if (version === INSOMNIA_SCHEMA_VERSION) {
      return yamlContent;
    }

    return migrateToLatest(parsed, version);
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
function migrateToLatest(data: any, fromVersion: string): string {
  let current = data;

  // Apply only the migrations that are needed
  for (const migration of migrations) {
    if (compareVersions(migration.version, fromVersion) > 0) {
      current = migration.up(current);
    }
  }

  return stringify(current);
}
