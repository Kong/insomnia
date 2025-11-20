import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { generate } from './generate';

const fixturesPath = path.join(__dirname, 'fixtures');
const fixtures = readdirSync(fixturesPath);

describe('fixtures', () => {
  for (const input of fixtures) {
    if (/\.output\.js$/.test(input)) {
      continue;
    }

    const prefix = input.replace(/\.input\.json$/, '');
    const output = `${prefix}.output.js`;

    if (prefix.startsWith('skip')) {
      continue;
    }

    it(`Generate ${input}`, async () => {
      expect(typeof input).toBe('string');
      expect(typeof output).toBe('string');
      const inputContents = readFileSync(path.join(fixturesPath, input), 'utf8');
      const outputContents = readFileSync(path.join(fixturesPath, output), 'utf8');
      expect(typeof inputContents).toBe('string');
      expect(typeof outputContents).toBe('string');
      const expected = generate(JSON.parse(inputContents));
      expect(expected.trim()).toBe(outputContents.trim());
    });
  }
});
