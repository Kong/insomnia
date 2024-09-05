import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { ednPrettify } from './edn';

describe('ednPrettify()', () => {
  const basePath = path.join(__dirname, './fixtures/edn');
  const files = fs.readdirSync(basePath);
  for (const file of files) {
    if (!file.match(/-input\.edn$/)) {
      continue;
    }

    const slug = file.replace(/-input\.edn$/, '');
    const name = slug.replace(/-/g, ' ');

    it(`handles ${name}`, () => {
      const input = fs.readFileSync(path.join(basePath, `${slug}-input.edn`), 'utf8').trim();
      const output = fs.readFileSync(path.join(basePath, `${slug}-output.edn`), 'utf8').trim();
      const result = ednPrettify(input);
      expect(result).toBe(output);
    });
  }
});
