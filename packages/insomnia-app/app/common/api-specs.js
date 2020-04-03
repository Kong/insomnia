// @flow

import YAML from 'yaml';

export function parseApiSpec(rawDocument: string): {
  document: Object | null,
  format: 'openapi' | 'swagger' | null,
  formatVersion: string | null,
} {
  const result = {
    document: null,
    format: null,
    formatVersion: null,
  };

  // NOTE: JSON is valid YAML so we only need to parse YAML
  try {
    result.document = YAML.parse(rawDocument);
  } catch (err) {
    throw new Error(`Failed to parse API spec`);
  }

  if (result.document) {
    if (result.document.openapi) {
      // Check if it's OpenAPI
      result.format = 'openapi';
      result.formatVersion = result.document.openapi;
    } else if (result.document.swagger) {
      // Check if it's Swagger
      result.format = 'swagger';
      result.formatVersion = result.document.swagger;
    } else {
      // Not sure what format it is
    }
  }

  return result;
}
