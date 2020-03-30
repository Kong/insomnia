import YAML from 'yaml';
import { globalBeforeEach } from '../../__jest__/before-each';
import { parseApiSpec } from '../api-specs';

describe('parseApiSpec()', () => {
  beforeEach(globalBeforeEach);

  it('parses YAML and JSON OpenAPI specs', () => {
    const objSpec = {
      openapi: '3.0.0',
      info: { title: 'My API' },
    };

    const expected = {
      format: 'openapi',
      formatVersion: '3.0.0',
      document: objSpec,
    };

    const yamlSpec = YAML.stringify(objSpec);
    const jsonSpec = JSON.stringify(objSpec);

    expect(parseApiSpec(yamlSpec)).toEqual(expected);
    expect(parseApiSpec(jsonSpec)).toEqual(expected);
  });

  it('parses YAML and JSON Swagger specs', () => {
    const objSpec = {
      swagger: '2.0.0',
      info: { title: 'My API' },
    };

    const expected = {
      format: 'swagger',
      formatVersion: '2.0.0',
      document: objSpec,
    };

    const yamlSpec = YAML.stringify(objSpec);
    const jsonSpec = JSON.stringify(objSpec);

    expect(parseApiSpec(yamlSpec)).toEqual(expected);
    expect(parseApiSpec(jsonSpec)).toEqual(expected);
  });

  it('parses YAML and JSON Unknown specs', () => {
    const objSpec = {
      funnyBusiness: '2.0.0',
      info: { title: 'My API' },
    };

    const expected = {
      format: null,
      formatVersion: null,
      document: objSpec,
    };

    const yamlSpec = YAML.stringify(objSpec);
    const jsonSpec = JSON.stringify(objSpec);

    expect(parseApiSpec(yamlSpec)).toEqual(expected);
    expect(parseApiSpec(jsonSpec)).toEqual(expected);
  });

  it('Fails on malformed JSON/YAML', () => {
    const rawSpec = [
      'openapi: 3.0.0',
      'info: {{{',
    ].join('\n');

    expect(() => parseApiSpec(rawSpec)).toThrowError('Failed to parse API spec');
  });
});
