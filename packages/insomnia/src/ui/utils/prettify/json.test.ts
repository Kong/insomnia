import { describe, expect, it } from 'vitest';

import { jsonPrettify } from './json';

// Load fixtures as raw strings at build time so this test stays context-neutral
// (no node:fs) and is legal in the renderer execution context.
const fixtures = import.meta.glob('./fixtures/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('jsonPrettify()', () => {
  for (const inputPath of Object.keys(fixtures)) {
    if (!inputPath.endsWith('-input.json')) {
      continue;
    }

    const slug = inputPath.replace(/-input\.json$/, '');
    const name = slug.replace('./fixtures/', '').replace(/-/g, ' ');

    it(`handles ${name}`, () => {
      const input = fixtures[inputPath].trim();
      const output = fixtures[`${slug}-output.json`].trim();
      const result = jsonPrettify(input, '  ');
      expect(result).toBe(output);
    });
  }
});
