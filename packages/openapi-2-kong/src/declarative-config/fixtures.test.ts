import { describe, expect, it } from '@jest/globals';
import { promises, readdirSync } from 'fs';
import path from 'path';

import { generate } from '../generate';
import { DCService, DeclarativeConfig } from '../types/declarative-config';
import { DeclarativeConfigResult } from '../types/outputs';
const { readFile } = promises;

/** Make matching friendlier */
const sortRoutes = (service: DCService) => service.routes.sort((a, b) => {
  let aCompare = a.paths[0];
  let bCompare = b.paths[0];

  if (aCompare === bCompare) {
    aCompare = a.methods[0];
    bCompare = b.methods[0];
  }

  if (aCompare > bCompare) {
    return 1;
  }
  return -1;
});

describe('declarative-config fixtures', () => {
  const root = path.join(__dirname, 'fixtures');
  readdirSync(root)
    .filter(name => !name.includes('.expected'))
    .forEach(fileBase => {
      it(`converts ${fileBase}`, async () => {
        const inputPath = path.join(root, fileBase);
        const result = await generate(inputPath, 'kong-declarative-config') as DeclarativeConfigResult;
        expect(result.documents.length).toBe(1);
        const document = result.documents[0];

        const expectedBase = `${path.parse(fileBase).name}.expected.json`;
        const expectedPath = path.join(root, expectedBase);
        const expected = await readFile(expectedPath, 'utf8');
        const parsedExpected: DeclarativeConfig = JSON.parse(expected);

        document.services.forEach(sortRoutes);
        parsedExpected.services.forEach(sortRoutes);

        expect(document).toEqual(parsedExpected);
      });
    });
});
