import fs from 'fs';
import path from 'path';
import { generate } from '../index';

describe('fixtures', () => {
  const root = path.join(__dirname, '../__fixtures__/');

  const fileBases = fs.readdirSync(root).filter(name => !name.includes('.expected'));

  for (const fileBase of fileBases) {
    const inputPath = path.join(root, fileBase);
    const expectedBase = `${path.parse(fileBase).name}.expected.json`;
    const expectedPath = path.join(root, expectedBase);

    const expected = fs.readFileSync(expectedPath, 'utf8');

    it(`converts ${fileBase}`, async () => {
      const result = await generate(inputPath, 'kong-declarative-config');
      expect(result.documents.length).toBe(1);

      const document = result.documents[0];
      const expectedObj = JSON.parse(expected);

      // Make matching friendlier
      for (const service of expectedObj.services || []) {
        service.routes = _sortRoutes(service.routes);
      }

      for (const service of document.services || []) {
        service.routes = _sortRoutes(service.routes);
      }

      expect(document).toEqual(expectedObj);
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
