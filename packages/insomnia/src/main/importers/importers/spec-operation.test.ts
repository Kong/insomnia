import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { findSpecOperationForRequest } from '../../../common/spec-operation';
import { convert as openapi3Convert } from './openapi-3';
import { convert as swagger2Convert } from './swagger-2';

describe('findSpecOperationForRequest with importer output', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const cases = [
    ['openapi3', 'petstore-yml-input.yml', openapi3Convert],
    ['openapi3', 'petstore-with-tags-input.json', openapi3Convert],
    ['swagger2', 'petstore-yml-input.yml', swagger2Convert],
    ['swagger2', 'petstore-with-tags-input.json', swagger2Convert],
    ['swagger2', 'user-example-input.json', swagger2Convert],
  ] as const;

  it.each(cases)('maps every %s request from %s back to its operation', async (dir, file, convert) => {
    const raw = fs.readFileSync(path.join(fixturesDir, dir, file), 'utf8');
    const document = YAML.parse(raw);
    const resources = await convert(raw);
    if (!Array.isArray(resources)) {
      throw new TypeError(`Importer did not convert ${dir}/${file}`);
    }
    const requests = resources.filter(resource => resource._type === 'request');
    expect(requests.length).toBeGreaterThan(0);

    for (const request of requests) {
      const match = findSpecOperationForRequest(raw, { method: request.method ?? '', url: request.url ?? '' });
      expect(match, `${request.method} ${request.url}`).not.toBeNull();
      const operation = document.paths[match!.path][match!.method];
      expect(operation).toBeDefined();
      if (operation.summary) {
        expect(request.name).toBe(operation.summary);
      }
    }
  });
});
