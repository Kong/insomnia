import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { generate } from './generate';

const fixturesPath = nodePath.join(__dirname, 'fixtures');
const fixtures = readdirSync(fixturesPath);

describe('fixtures', () => {
  for (const input of fixtures) {
    if (input.match(/\.output\.js$/)) {
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
      const inputContents = readFileSync(nodePath.join(fixturesPath, input), 'utf8');
      const outputContents = readFileSync(nodePath.join(fixturesPath, output), 'utf8');
      expect(typeof inputContents).toBe('string');
      expect(typeof outputContents).toBe('string');
      const expected = generate(JSON.parse(inputContents));
      expect(expected.trim()).toBe(outputContents.trim());
    });
  }
});
