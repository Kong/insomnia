import { describe, expect, it } from '@jest/globals';

import { exportSpecification } from './export-specification';

describe('exportSpecification()', () => {
  const withKongTags = `openapi: 3.0.1
info:
  description: Description
  version: 1.0.0
  title: API
servers:
  - url: https://api.insomnia.rest
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
      description: test
      responses:
        "200":
          description: OK`;
  it('should not remove all x-kong annotations from spec if skipAnnotations false', async () => {
    const result = await exportSpecification({ specContent: withKongTags, skipAnnotations: false });
    expect(result).toBe(withKongTags);
  });

  it('should remove all x-kong annotations from spec if skipAnnotations true', async () => {
    const result = await exportSpecification({ specContent: withKongTags, skipAnnotations: true });
    expect(result).toBe(`openapi: 3.0.1
info:
  description: Description
  version: 1.0.0
  title: API
servers:
  - url: https://api.insomnia.rest
paths:
  /path:
    get:
      description: test
      responses:
        "200":
          description: OK
`);
  });

});
