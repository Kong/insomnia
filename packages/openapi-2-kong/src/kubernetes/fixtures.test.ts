import { describe, expect, it } from '@jest/globals';
import { promises, readdirSync } from 'fs';
import path from 'path';
import YAML from 'yaml';

import { generate } from '../generate';
import { KongForKubernetesResult } from '../types/outputs';
const { readFile } = promises;

describe('kubernetes fixtures', () => {
  const root = path.join(__dirname, 'fixtures');
  readdirSync(root)
    .filter(name => !name.includes('.expected'))
    .forEach(fileBase => {
      it(`converts ${fileBase}`, async () => {
        const inputPath = path.join(root, fileBase);
        const result = await generate(inputPath, 'kong-for-kubernetes') as KongForKubernetesResult;
        expect(result.type).toBe('kong-for-kubernetes');
        expect(result.label).toBe('Kong for Kubernetes');

        const expectedBase = `${path.parse(fileBase).name}.expected.yaml`;
        const expectedPath = path.join(root, expectedBase);
        const expected = await readFile(expectedPath, 'utf8');
        const parsedExpected = YAML.parse(expected);

        expect(result).toEqual(parsedExpected);
      });
    });
});
