import fs from 'fs';
import path from 'path';
import { generate } from '../index';

describe('fixtures', () => {
  const root = path.join(__dirname, '../__fixtures__/');

  for (const name of fs.readdirSync(root)) {
    if (name.includes('.expected')) {
      continue;
    }

    const inputPath = path.join(root, name);
    const expectedPath = inputPath + '.expected';

    const expected = fs.readFileSync(expectedPath, 'utf8');

    it(`converts ${name}`, async () => {
      const result = await generate(inputPath);
      const expectedObj = JSON.parse(expected);

      // Make matching friendlier
      for (const service of expectedObj.services || []) {
        service.routes = _sortRoutes(service.routes);
      }

      for (const service of result.services || []) {
        service.routes = _sortRoutes(service.routes);
      }

      expect(result).toEqual(expectedObj);
    });
  }
});

function _sortRoutes(routes) {
  return routes.sort((a, b) => {
    let aCompare = a.paths[0];
    let bCompare = b.paths[0];

    if (aCompare === bCompare) {
      aCompare = a.methods[0];
      bCompare = b.methods[0];
    }

    if (aCompare > bCompare) {
      return 1;
    } else {
      return -1;
    }
  });
}
