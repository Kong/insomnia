import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import path from 'path';

import { globalBeforeAll, globalBeforeEach } from '../jest/before';
import { lintSpecification } from './lint-specification';

describe('lint specification', () => {
  beforeAll(() => {
    globalBeforeAll();
  });

  beforeEach(() => {
    globalBeforeEach();
  });

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
`, rulesetFileName,
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
});
