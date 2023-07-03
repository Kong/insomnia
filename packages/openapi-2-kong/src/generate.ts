import SwaggerParser from '@apidevtools/swagger-parser';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

import { generateDeclarativeConfigFromSpec } from './declarative-config/generate';
import { generateKongForKubernetesConfigFromSpec } from './kubernetes/generate';
import { OpenApi3Spec } from './types/openapi3';
import { ConversionResult, ConversionResultType } from './types/outputs';

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
    api.info = {
      title: '',
      version: '',
    };
  }

  if (api.openapi === '3.0') {
    api.openapi = '3.0.0';
  }

  return SwaggerParser.validate(api, { dereference: { circular: 'ignore' } }) as Promise<OpenApi3Spec>;
};

export const generateFromSpec = (
  api: OpenApi3Spec,
  type: ConversionResultType,
  tags: string[] = [],
  legacy: Boolean = true
) => {
  const allTags = [...defaultTags, ...tags];

  switch (type) {
    case 'kong-declarative-config':
      return generateDeclarativeConfigFromSpec(api, allTags, legacy);

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
  legacy: Boolean = true,
) => {
  const api = await parseSpec(specStr);
  return generateFromSpec(api, type, tags, legacy);
};

export const generate = (
  filePath: string,
  type: ConversionResultType,
  tags: string[] = [],
  legacy: Boolean = true,
) => new Promise<ConversionResult>((resolve, reject) => {
  fs.readFile(path.resolve(filePath), 'utf8', (err, contents) => {
    if (err != null) {
      reject(err);
      return;
    }

    const fileSlug = path.basename(filePath);
    const allTags = [`OAS3file_${fileSlug}`, ...tags];
    resolve(generateFromString(contents, type, allTags, legacy));
  });
});
