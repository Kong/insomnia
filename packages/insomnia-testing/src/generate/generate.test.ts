import { generate } from './generate';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const fixturesPath = join(__dirname, 'fixtures');
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
      const inputContents = readFileSync(join(fixturesPath, input), 'utf8');
      const outputContents = readFileSync(join(fixturesPath, output), 'utf8');
      expect(typeof inputContents).toBe('string');
      expect(typeof outputContents).toBe('string');
      const expected = generate(JSON.parse(inputContents));
      expect(expected.trim()).toBe(outputContents.trim());
    });
  }
});
