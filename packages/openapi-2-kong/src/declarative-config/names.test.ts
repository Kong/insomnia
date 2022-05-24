import { describe, expect, it } from '@jest/globals';

import { xKongName } from '../types/kong';
import { OA3PathItem, OpenApi3Spec } from '../types/openapi3';
import { generateRouteName } from './services';

const api: OpenApi3Spec = {
  openapi: '3.0',
  info: {
    version: '1.0',
    title: 'Nebulo 9',
  },
  servers: [
    {
      url: 'https://example.com/api',
    },
  ],
  paths: {},
};

const compare = (expected: string, pathItem: OA3PathItem) => {
  const name = generateRouteName(
    {
      ...api,
      paths: {
        '/planet-smasher': {
          summary: 'smashes planets',
          ...pathItem,
        },
      },
    },
    '/planet-smasher',
    'post',
  );
  expect(name).toEqual(expected);
};

describe('names', () => {
  it("api.paths[path][method]['x-kong-name'] is highest priority", () => {
    compare('Nebulo_9-method-smash', {
      [xKongName]: 'pathItem-smash',
      post: {
        [xKongName]: 'method-smash',
        operationId: 'operationId-smash',
      },
    });
  });

  it('api.paths[path][method].operationId is second priority (and not slugified)', () => {
    compare('Nebulo_9-operationId-smash', {
      [xKongName]: 'pathItem-smash',
      post: {
        operationId: 'operationId-smash',
      },
    });
  });

  it("api.paths[path]['x-kong-name'] is third priority", () => {
    compare('Nebulo_9-pathItem-smash-post', {
      [xKongName]: 'pathItem-smash',
      post: {},
    });
  });

  it('purely generated is fourth priority', () => {
    compare('Nebulo_9-planet-smasher-post', {
      post: {},
    });
  });

  it('handles root paths', () => {
    const name = generateRouteName(
      {
        ...api,
        paths: {
          '/': {
            summary: 'smashes planets',
            get: {},
          },
        },
      },
      '/',
      'get',
    );
    expect(name).toEqual('Nebulo_9-get');
  });
});
