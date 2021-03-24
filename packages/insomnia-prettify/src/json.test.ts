import fs from 'fs';
import path from 'path';
import { prettify } from './json';

describe('prettify()', () => {
  const basePath = path.join(__dirname, './fixtures');
  const files = fs.readdirSync(basePath);
  for (const file of files) {
    if (!file.match(/-input\.json$/)) {
      continue;
    }

    const slug = file.replace(/-input\.json$/, '');
    const name = slug.replace(/-/g, ' ');

    it(`handles ${name}`, () => {
      const input = fs.readFileSync(path.join(basePath, `${slug}-input.json`), 'utf8').trim();
      const output = fs.readFileSync(path.join(basePath, `${slug}-output.json`), 'utf8').trim();
      const result = prettify(input, '  ');
      expect(result).toBe(output);
    });
  }
});
