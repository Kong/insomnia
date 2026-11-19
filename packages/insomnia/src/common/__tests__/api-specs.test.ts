import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { parseApiSpec } from '../api-specs';

describe('parseApiSpec()', () => {
  it('parses YAML and JSON OpenAPI specs', () => {
    const objSpec = {
      openapi: '3.0.0',
      info: {
        title: 'My API',
      },
    };
    const yamlSpec = YAML.stringify(objSpec);
    const jsonSpec = JSON.stringify(objSpec);
    const expected = {
      format: 'openapi',
      formatVersion: '3.0.0',
      contents: objSpec,
    };
    expect(parseApiSpec(yamlSpec)).toEqual({ ...expected, rawContents: yamlSpec });
    expect(parseApiSpec(jsonSpec)).toEqual({ ...expected, rawContents: jsonSpec });
  });

  it('parses OpenAPI 3.2 specs and keeps 3.2-only fields untouched', () => {
    const objSpec = {
      openapi: '3.2.0',
      $self: 'https://example.com/openapi.yaml',
      info: { title: 'My API', version: '1.0.0' },
      paths: {
        '/pets': {
          query: { responses: { 200: { description: 'ok' } } },
          additionalOperations: { PURGE: { responses: { 204: { description: 'purged' } } } },
        },
      },
    };
    const yamlSpec = YAML.stringify(objSpec);

    expect(parseApiSpec(yamlSpec)).toEqual({
      format: 'openapi',
      formatVersion: '3.2.0',
      contents: objSpec,
      rawContents: yamlSpec,
    });
  });

  it('parses YAML and JSON Swagger specs', () => {
    const objSpec = {
      swagger: '2.0.0',
      info: {
        title: 'My API',
      },
    };
    const expected = {
      format: 'swagger',
      formatVersion: '2.0.0',
      contents: objSpec,
    };
    const yamlSpec = YAML.stringify(objSpec);
    const jsonSpec = JSON.stringify(objSpec);
    expect(parseApiSpec(yamlSpec)).toEqual({ ...expected, rawContents: yamlSpec });
    expect(parseApiSpec(jsonSpec)).toEqual({ ...expected, rawContents: jsonSpec });
  });

  it('parses YAML and JSON Unknown specs', () => {
    const objSpec = {
      funnyBusiness: '2.0.0',
      info: {
        title: 'My API',
      },
    };
    const expected = {
      format: null,
      formatVersion: null,
      contents: objSpec,
    };
    const yamlSpec = YAML.stringify(objSpec);
    const jsonSpec = JSON.stringify(objSpec);
    expect(parseApiSpec(yamlSpec)).toEqual({ ...expected, rawContents: yamlSpec });
    expect(parseApiSpec(jsonSpec)).toEqual({ ...expected, rawContents: jsonSpec });
  });

  it('returns the default result if empty document', () => {
    const expected = {
      format: null,
      formatVersion: null,
      contents: null,
      rawContents: '',
    };
    expect(parseApiSpec('')).toEqual(expected);
  });

  it('Fails on malformed JSON/YAML', () => {
    const rawSpec = ['openapi: 3.0.0', 'info: {{{'].join('\n');
    expect(() => parseApiSpec(rawSpec)).toThrowError('Failed to parse API spec');
  });
});
