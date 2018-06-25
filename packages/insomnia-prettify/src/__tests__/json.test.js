const fs = require('fs');
const path = require('path');
const { prettify } = require('../json');

describe('prettify()', () => {
  const basePath = path.join(__dirname, '../__fixtures__');
  const files = fs.readdirSync(basePath);
  for (const file of files) {
    if (!file.match(/-input\.json$/)) {
      continue;
    }

    const slug = file.replace(/-input\.json$/, '');
    const name = slug.replace(/-/g, ' ');

    it(`handles ${name}`, () => {
      const input = fs
        .readFileSync(path.join(basePath, `${slug}-input.json`), 'utf8')
        .trim();
      const output = fs
        .readFileSync(path.join(basePath, `${slug}-output.json`), 'utf8')
        .trim();
      const result = prettify(input, '  ');
      expect(result).toBe(output);
    });
  }
});
