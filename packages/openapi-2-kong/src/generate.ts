import fs from 'fs';
import path from 'path';
import { generateDeclarativeConfigFromSpec } from './declarative-config';
import { generateKongForKubernetesConfigFromSpec } from './kubernetes';
import SwaggerParser from 'swagger-parser';
import { OpenApi3Spec } from './types/openapi3';
import { ConversionResultType, ConversionResult } from './types/outputs';
import { parse as YAMLparse } from 'yaml';

const defaultTags = ['OAS3_import'];

export async function generate(
  specPath: string,
  type: ConversionResultType,
  tags: string[] = [],
): Promise<ConversionResult> {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(specPath), 'utf8', (err, contents) => {
      if (err != null) {
        reject(err);
        return;
      }

      const fileSlug = path.basename(specPath);
      const allTags = [`OAS3file_${fileSlug}`, ...tags];
      resolve(generateFromString(contents, type, allTags));
    });
  });
}

export async function generateFromString(
  specStr: string,
  type: ConversionResultType,
  tags: string[] = [],
): Promise<ConversionResult> {
  const api: OpenApi3Spec = await parseSpec(specStr);
  return generateFromSpec(api, type, tags);
}

export function generateFromSpec(
  api: OpenApi3Spec,
  type: ConversionResultType,
  tags: string[] = [],
): ConversionResult {
  const allTags = [...defaultTags, ...tags];

  switch (type) {
    case 'kong-declarative-config':
      return generateDeclarativeConfigFromSpec(api, allTags);

    case 'kong-for-kubernetes':
      return generateKongForKubernetesConfigFromSpec(api);

    default:
      throw new Error(`Unsupported output type "${type}"`);
  }
}

export async function parseSpec(spec: string | Record<string, any>): Promise<OpenApi3Spec> {
  let api: OpenApi3Spec;

  if (typeof spec === 'string') {
    try {
      api = JSON.parse(spec);
    } catch (err) {
      api = YAMLparse(spec);
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

  // @ts-expect-error -- TSCONVERSION
  return SwaggerParser.dereference(api);
}
