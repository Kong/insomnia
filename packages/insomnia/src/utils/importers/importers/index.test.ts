import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { convert } from '../convert';

const fixturesPath = path.join(__dirname, './fixtures');
const fixtures = fs.readdirSync(fixturesPath);
describe('Fixtures', () => {
  afterEach(() => {
    vi.restoreAllMocks(); // Resets all mocks
  });
  describe.each(fixtures)('Import %s', name => {
    const dir = path.join(fixturesPath, `./${name}`);
    const inputs = fs
      .readdirSync(dir)
      .filter(name => name.match(/^(.+)-?input\.[^.]+$/));

    for (const input of inputs) {
      const prefix = input.replace(/-input\.[^.]+/, '');

      if (prefix.startsWith('skip')) {
        continue;
      }

      it(input, async () => {
        vi.spyOn(Date, 'now').mockImplementation(() => 1622117984000);

        expect.assertions(3);

        expect(typeof input).toBe('string');
        const inputContents = fs.readFileSync(path.join(dir, input), 'utf8');
        expect(typeof inputContents).toBe('string');

        const results = await convert(inputContents);
        results.data.__export_date = '';
        expect(results.data).toMatchSnapshot();

        const ids = new Set();
        for (const resource of results.data.resources) {
          if (ids.has(resource?._id)) {
            const json = JSON.stringify(resource, null, '\t');
            throw new Error(`Export contained multiple duplicate IDs: ${json}`);
          }
          ids.add(resource?._id);
        }
      });
    }
  });
});
