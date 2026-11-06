import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { lintSpecification } from './lint-specification';

describe('lint specification', () => {
  const specContent = `openapi: '3.0.2'
info:
  title: Sample Spec
  version: '1.2'
  description: A sample API specification
  contact:
    email: support@insomnia.rest
servers:
  - url: https://200.insomnia.rest
tags:
  - name: Folder
paths:
  /global:
    get:
      description: Global
      operationId: get_global
      tags:
        - Folder
      responses:
        '200':
          description: OK
  /override:
    get:
      description: Override
      operationId: get_override
      tags:
        - Folder
      responses:
        '200':
          description: OK`;

  it('should return true for linting passed', async () => {
    const result = await lintSpecification({ specContent });
    expect(result.isValid).toBe(true);
  });

  // TODO: fix;
  it.skip('should lint specification with custom ruleset', async () => {
    const rulesetFileName = path.join(process.cwd(), 'src/commands/fixtures/with-ruleset/.spectral.yaml');
    const result = await lintSpecification({
      specContent: `openapi: 3.0.1
info:
  description: Description
  version: 1.0.0
  title: API
servers:
  - url: 'https://api.insomnia.rest'
paths:
  /path:
    x-kong-plugin-oidc:
      name: oidc
      enabled: true
      config:
        key_names: [api_key, apikey]
        key_in_body: false
        hide_credentials: true
    get:
      description: 'test'
      responses:
        '200':
          description: OK
`,
      rulesetFileName,
    });
    expect(result.isValid).toBe(true);
  });

  it('should return false for linting failed', async () => {
    const badSpec = `openapi: '3.0.2'                                                                            
info:
  title: Global Security
  version: '1.2'
servers:
  - url: https://api.server.test/v1
tags:
  - name: Folder

  paths:
  /global:
    get:
      tags:
        - Folder
      responses:
        '200':
          description: OK
  /override:
    get:
      security:
        - Key-Query: []
      responses:
        '200':
          description: OK`;
    const result = await lintSpecification({ specContent: badSpec });
    expect(result.isValid).toBe(false);
  });

  // Exercises type arrays with null, const, examples arrays, $ref siblings, contentMediaType, mutualTLS,
  // webhooks and license identifier.
  it('should lint a valid OpenAPI 3.1 spec without any results', async () => {
    const specContent = fs.readFileSync(path.join(__dirname, 'fixtures/openapi-3.1-valid.yaml'), 'utf8');
    const result = await lintSpecification({ specContent });
    expect(result.results).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  // Exercises $self, query, additionalOperations, in: querystring, itemSchema, example dataValue, tag parent/kind,
  // xml.nodeType, discriminator.defaultMapping, oauth2MetadataUrl, device flow and deprecated schemes.
  it('should lint a valid OpenAPI 3.2 spec without any results', async () => {
    const specContent = fs.readFileSync(path.join(__dirname, 'fixtures/openapi-3.2-valid.yaml'), 'utf8');
    const result = await lintSpecification({ specContent });
    expect(result.results).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it('should still report structural errors on an OpenAPI 3.2 spec', async () => {
    const specContent = fs
      .readFileSync(path.join(__dirname, 'fixtures/openapi-3.2-valid.yaml'), 'utf8')
      .replace('  version: 1.0.0\n', '')
      .replace('    query:\n', '    query:\n      notAnOperationField: true\n');
    const result = await lintSpecification({ specContent });
    expect(result.isValid).toBe(false);
    expect(result.results?.map(r => r.path.join('.'))).toEqual(['info', 'paths./pets.query']);
  });

  // The example rules are limited to 3.0 / 3.1 because they don't support 3.2 `dataValue`
  it('should still validate media examples on an OpenAPI 3.1 spec', async () => {
    const specContent = `openapi: 3.1.0
info:
  title: Pets
  version: 1.0.0
paths:
  /pets:
    get:
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: string
              examples:
                invalid:
                  value: 42
`;
    const result = await lintSpecification({ specContent });
    expect(result.results?.map(r => r.code)).toContain('oas3-valid-media-example');
  });
});
