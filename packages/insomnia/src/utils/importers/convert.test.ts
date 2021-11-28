import { describe, expect, it } from '@jest/globals';
import { fail } from 'assert';

import { convert } from './convert';

describe('Import errors', () => {
  it('fail to find importer', async () => {
    try {
      await convert('foo');
      fail('Should have thrown error');
    } catch (err) {
      expect(err.message).toBe('No importers found for file');
    }
  });
});

describe('Import OpenApi', () => {
  it('should find importer', async () => {
    const imported = await convert('openapi: 3.0.0\n' +
        'info:\n' +
        '  title: Sample API\n' +
        '  description: Optional multiline or single-line description in [CommonMark](http://commonmark.org/help/) or HTML.\n' +
        '  version: 0.1.9\n' +
        'servers:\n' +
        '  - url: http://api.example.com/v1\n' +
        '    description: Optional server description, e.g. Main (production) server\n' +
        '  - url: http://staging-api.example.com/v1\n' +
        '    description: Optional server description, e.g. Internal staging server for testing\n' +
        'paths:\n' +
        '  /users:\n' +
        '    get:\n' +
        '      summary: Returns a list of users.\n' +
        '      description: Optional extended description in CommonMark or HTML.\n' +
        '      responses:\n' +
        '        \'200\':    # status code\n' +
        '          description: A JSON array of user names\n' +
        '          content:\n' +
        '            application/json:\n' +
        '              schema:\n' +
        '                type: array\n' +
        '                items:\n' +
        '                  type: string');
    expect(imported.data.resources).toHaveLength(5);
    expect(imported.data.resources.filter(resource => resource._type == 'environment')).toHaveLength(3);
    const envs = imported.data.resources.filter(resource => resource._type == 'environment');
    expect(envs[0]).toHaveProperty('data', { base_url: '{{ scheme }}://{{ host }}{{ base_path }}' });
    expect(envs[1]).toHaveProperty('data', { scheme: 'http', base_path: '/v1', host: 'api.example.com' });
    expect(envs[2]).toHaveProperty('data', { scheme: 'http', base_path: '/v1', host: 'staging-api.example.com' });
  });
  it('should find importer', async () => {
    const imported = await convert('openapi: 3.0.0\n' +
        'info:\n' +
        '  title: Sample API\n' +
        '  description: Optional multiline or single-line description in [CommonMark](http://commonmark.org/help/) or HTML.\n' +
        '  version: 0.1.9\n' +
        'servers:\n' +
        '  - url: http://api.example.com/v1\n' +
        '    description: Optional server description, e.g. Main (production) server\n' +
        'paths:\n' +
        '  /users:\n' +
        '    get:\n' +
        '      summary: Returns a list of users.\n' +
        '      description: Optional extended description in CommonMark or HTML.\n' +
        '      responses:\n' +
        '        \'200\':    # status code\n' +
        '          description: A JSON array of user names\n' +
        '          content:\n' +
        '            application/json:\n' +
        '              schema:\n' +
        '                type: array\n' +
        '                items:\n' +
        '                  type: string');
    expect(imported.data.resources.length).toBe(4);
    expect(imported.data.resources.filter(resource => resource._type == 'environment')).toHaveLength(2);
  });
  it('should find importer', async () => {
    const imported = await convert('openapi: 3.0.0\n' +
        'info:\n' +
        '  title: Sample API\n' +
        '  description: Optional multiline or single-line description in [CommonMark](http://commonmark.org/help/) or HTML.\n' +
        '  version: 0.1.9\n' +
        'servers:\n' +
        '  - description: Optional server description, e.g. Internal staging server for testing\n' +
        'paths:\n' +
        '  /users:\n' +
        '    get:\n' +
        '      summary: Returns a list of users.\n' +
        '      description: Optional extended description in CommonMark or HTML.\n' +
        '      responses:\n' +
        '        \'200\':    # status code\n' +
        '          description: A JSON array of user names\n' +
        '          content:\n' +
        '            application/json:\n' +
        '              schema:\n' +
        '                type: array\n' +
        '                items:\n' +
        '                  type: string');
    expect(imported.data.resources.length).toBe(4);
    expect(imported.data.resources.filter(resource => resource._type == 'environment')).toHaveLength(2);
    const envs = imported.data.resources.filter(resource => resource._type == 'environment');
    expect(envs[0]).toHaveProperty('data', { base_url: '{{ scheme }}://{{ host }}{{ base_path }}' });
    expect(envs[1]).toHaveProperty('data', { scheme: 'http', base_path: '', host: 'example.com' });
  });
});
