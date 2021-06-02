import fs from 'fs';
import path from 'path';
import SwaggerParser from 'swagger-parser';
import { OpenApi3Spec } from './types/openapi3';
import { ConversionResultType, ConversionResult } from './types/outputs';
import YAML from 'yaml';
import { generateDeclarativeConfigFromSpec } from './declarative-config/generate';
import { generateKongForKubernetesConfigFromSpec } from './kubernetes/generate';

const defaultTags = ['OAS3_import'];

export const conversionTypes: ConversionResultType[] = [
  'kong-declarative-config',
  'kong-for-kubernetes',
];

export const parseSpec = (spec: string | Record<string, any>) => {
  let api: OpenApi3Spec;

  if (typeof spec === 'string') {
    try {
      api = JSON.parse(spec);
    } catch (err) {
      api = YAML.parse(spec);
    }
  } else {
    api = JSON.parse(JSON.stringify(spec));
  }

  // Ensure it has some required properties to make parsing a bit less strict
  if (!api.info) {
    api.info = {};
  }

  if (api.openapi === '3.0') {
    api.openapi = '3.0.0';
  }

  // @ts-expect-error until we make our OpenAPI type extend from the canonical one (i.e. from `openapi-types`, we'll need to shim this here)
  return SwaggerParser.dereference(api) as Promise<OpenApi3Spec>;
};

export const generateFromSpec = (
  api: OpenApi3Spec,
  type: ConversionResultType,
  tags: string[] = [],
) => {
  const allTags = [...defaultTags, ...tags];

  switch (type) {
    case 'kong-declarative-config':
      return generateDeclarativeConfigFromSpec(api, allTags);

    case 'kong-for-kubernetes':
      return generateKongForKubernetesConfigFromSpec(api);

    default:
      throw new Error(`Unsupported output type "${type}"`);
  }
};

export const generateFromString = async (
  specStr: string,
  type: ConversionResultType,
  tags: string[] = [],
) => {
  const api = await parseSpec(specStr);
  return generateFromSpec(api, type, tags);
};

export const generate = (
  filePath: string,
  type: ConversionResultType,
  tags: string[] = [],
) => new Promise<ConversionResult>((resolve, reject) => {
  fs.readFile(path.resolve(filePath), 'utf8', (err, contents) => {
    if (err != null) {
      reject(err);
      return;
    }

    const fileSlug = path.basename(filePath);
    const allTags = [`OAS3file_${fileSlug}`, ...tags];
    resolve(generateFromString(contents, type, allTags));
  });
});
