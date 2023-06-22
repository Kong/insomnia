import YAML from 'yaml';

export interface ParsedApiSpec {
  contents: Record<string, any> | null;
  rawContents: string;
  format: 'openapi' | 'swagger' | null;
  formatVersion: string | null;
}

export function parseApiSpec(
  rawDocument: string,
) {
  const result: ParsedApiSpec = {
    contents: null,
    rawContents: rawDocument,
    format: null,
    formatVersion: null,
  };

  // NOTE: JSON is valid YAML so we only need to parse YAML
  try {
    result.contents = YAML.parse(rawDocument);
  } catch (err) {
    throw new Error('Failed to parse API spec');
  }

  if (result.contents) {
    if (result.contents.openapi) {
      // Check if it's OpenAPI
      result.format = 'openapi';
      result.formatVersion = result.contents.openapi;
    } else if (result.contents.swagger) {
      // Check if it's Swagger
      result.format = 'swagger';
      result.formatVersion = result.contents.swagger;
    } else {
      // Not sure what format it is
    }
  }

  return result;
}

export function resolveComponentSchemaRefs(
  spec: ParsedApiSpec,
  methodInfo: Record<string, any>,
) {
  const schemas = spec.contents?.components?.schemas;
  if (!schemas) {
    return;
  }

  const resolveRefs = (obj: Record<string, any>): Record<string, any> => {
    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(resolveRefs);
    }

    if (obj.$ref) {
      const ref = obj.$ref.replace('#/components/schemas/', '');
      return resolveRefs(schemas[ref]);
    }

    const resolved: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveRefs(value);
    }

    return resolved;
  };

  const resolved = resolveRefs(methodInfo);

  return resolved;
}
