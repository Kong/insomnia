import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';

import { jsonPrettify } from './json';

describe('jsonPrettify()', () => {
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
      const result = jsonPrettify(input, '  ');
      expect(result).toBe(output);
    });
  }
});
