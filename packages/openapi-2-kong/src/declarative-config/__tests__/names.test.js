// @flow
import { generateRouteName } from '../services';

const api: OpenApi3Spec = {
  openapi: '3.0',
  info: { version: '1.0', title: 'Nebulo 9' },
  servers: [{ url: 'https://example.com/api' }],
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
  it(`api.paths[path][method]['x-kong-name'] is highest priority`, () => {
    compare('method_smash', {
      'x-kong-name': 'pathItem-smash',
      post: {
        'x-kong-name': 'method-smash',
        operationId: 'operationId-smash',
      },
    });
  });

  it('api.paths[path][method].operationId is second priority (and not slugified)', () => {
    compare('operationId-smash', {
      'x-kong-name': 'pathItem-smash',
      post: {
        operationId: 'operationId-smash',
      },
    });
  });

  it(`api.paths[path]['x-kong-name'] is third priority`, () => {
    compare('Nebulo_9-pathItem_smash-post', {
      'x-kong-name': 'pathItem-smash',
      post: {},
    });
  });

  it('purely generated is fourth priority', () => {
    compare('Nebulo_9-planet_smasher-post', {
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
