import { describe, expect, it } from 'vitest';

import { ednPrettify } from './edn';

// Load fixtures as raw strings at build time so this test stays context-neutral
// (no node:fs) and is legal in the renderer execution context.
const fixtures = import.meta.glob('./fixtures/edn/*.edn', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('ednPrettify()', () => {
  for (const inputPath of Object.keys(fixtures)) {
    if (!inputPath.endsWith('-input.edn')) {
      continue;
    }

    const slug = inputPath.replace(/-input\.edn$/, '');
    const name = slug.replace('./fixtures/edn/', '').replace(/-/g, ' ');

    it(`handles ${name}`, () => {
      const input = fixtures[inputPath].trim();
      const output = fixtures[`${slug}-output.edn`].trim();
      const result = ednPrettify(input);
      expect(result).toBe(output);
    });
  }
});
