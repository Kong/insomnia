import fs from 'node:fs';
import path from 'node:path';

import { parse, stringify } from 'yaml';

/**
 * Compares exported YAML content with expected fixture.
 * Handles dynamic fields by replacing them with placeholders.
 * @param actualContent - The actual exported content
 * @param expectedFixturePath - Path to the expected fixture file (relative to fixtures directory)
 * @returns Comparison result with differences if any
 */
export function compareWithFixture(
  actualContent: string,
  expectedFixturePath: string
): {
  matches: boolean;
  differences?: string;
  normalizedActual?: string;
  normalizedExpected?: string;
} {
  // Read expected fixture (path is relative to fixtures directory)
  const fixturePath = path.resolve(__dirname, '../../fixtures', expectedFixturePath);
  if (!fs.existsSync(fixturePath)) {
    return {
      matches: false,
      differences: `Fixture file not found: ${expectedFixturePath}`,
    };
  }

  const expectedContent = fs.readFileSync(fixturePath, 'utf8');

  try {
    const actualParsed = parse(actualContent);
    const expectedParsed = parse(expectedContent);

    // Normalize content by replacing dynamic fields with {{dynamic}}
    const normalizeForComparison = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(normalizeForComparison);
      }
      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          // Replace dynamic fields with placeholder
          if (['id', '_id', 'created', 'modified', 'metaSortKey', 'sortKey'].includes(key)) {
            result[key] = '{{dynamic}}';
          } else if (key === 'meta' && value && typeof value === 'object') {
            // Handle meta object specially
            result[key] = normalizeForComparison(value);
          } else {
            result[key] = normalizeForComparison(value);
          }
        }
        return result;
      }
      return obj;
    };

    const normalizedActual = normalizeForComparison(actualParsed);
    const normalizedExpected = normalizeForComparison(expectedParsed);

    // Convert back to YAML for string comparison
    const normalizedActualYaml = stringify(normalizedActual);
    const normalizedExpectedYaml = stringify(normalizedExpected);

    const matches = normalizedActualYaml === normalizedExpectedYaml;

    return {
      matches,
      differences: matches ? undefined : getDifferences(normalizedActualYaml, normalizedExpectedYaml),
      normalizedActual: normalizedActualYaml,
      normalizedExpected: normalizedExpectedYaml,
    };
  } catch (error) {
    return {
      matches: false,
      differences: `Error parsing YAML: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Gets detailed differences between two YAML strings.
 * @param actual - Actual YAML content
 * @param expected - Expected YAML content
 * @returns String describing the differences
 */
function getDifferences(actual: string, expected: string): string {
  const actualLines = actual.split('\n');
  const expectedLines = expected.split('\n');
  const differences: string[] = [];

  const maxLines = Math.max(actualLines.length, expectedLines.length);

  for (let i = 0; i < maxLines; i++) {
    const actualLine = actualLines[i] ?? '';
    const expectedLine = expectedLines[i] ?? '';

    if (actualLine !== expectedLine) {
      differences.push(`Line ${i + 1}:`, `  Expected: ${expectedLine}`, `  Actual:   ${actualLine}`);
    }
  }

  return differences.join('\n');
}
