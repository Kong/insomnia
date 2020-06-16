// @flow
import { generate } from '../index';
import fs from 'fs';
import path from 'path';

const fixturesPath = path.join(__dirname, '../__fixtures__');
const fixtures = fs.readdirSync(fixturesPath);

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

      const inputContents = fs.readFileSync(path.join(fixturesPath, input), 'utf8');
      const outputContents = fs.readFileSync(path.join(fixturesPath, output), 'utf8');

      expect(typeof inputContents).toBe('string');
      expect(typeof outputContents).toBe('string');

      const expected = generate(JSON.parse(inputContents));
      expect(expected.trim()).toBe(outputContents.trim());
    });
  }
});
