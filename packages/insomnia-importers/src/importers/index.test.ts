import fs from 'fs';
import path from 'path';
import { convert } from '../convert';

const fixturesPath = path.join(__dirname, './fixtures');
const fixtures = fs.readdirSync(fixturesPath);

describe('Fixtures', () => {
  describe.each(fixtures)('Import %s', (name) => {
    const dir = path.join(fixturesPath, `./${name}`);
    const inputs = fs
      .readdirSync(dir)
      .filter((name) => name.match(/^(.+)-?input\.[^.]+$/));

    for (const input of inputs) {
      const prefix = input.replace(/-input\.[^.]+/, '');
      const output = `${prefix}-output.json`;

      // TEMPORARY !!!!!!!!!!!!!!!!!!!!1
      // TEMPORARY !!!!!!!!!!!!!!!!!!!!1
      // TEMPORARY !!!!!!!!!!!!!!!!!!!!1
      // TEMPORARY !!!!!!!!!!!!!!!!!!!!1
      // TODO(TSCONVERSION)
      // openapi3
      // swagger2
      if (name !== 'openapi3') {
        continue;
      }

      if (prefix.startsWith('skip')) {
        continue;
      }

      it(input, async () => {
        expect.assertions(5);

        expect(typeof input).toBe('string');
        const inputContents = fs.readFileSync(path.join(dir, input), 'utf8');
        expect(typeof inputContents).toBe('string');

        expect(typeof output).toBe('string');
        const outputContents = fs.readFileSync(path.join(dir, output), 'utf8');
        expect(typeof outputContents).toBe('string');

        const results = await convert(inputContents);
        const expected = JSON.parse(outputContents);
        expected.__export_date = results.data.__export_date;
        expect(results.data).toEqual(expected);

        const ids = new Set();
        for (const resource of results.data.resources) {
          if (ids.has(resource._id)) {
            const json = JSON.stringify(resource, null, '\t');
            throw new Error(`Export contained multiple duplicate IDs: ${json}`);
          }
          ids.add(resource._id);
        }
      });
    }
  });
});
