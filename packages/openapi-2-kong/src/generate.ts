import fs from 'fs';
import path from 'path';
import { generateDeclarativeConfigFromSpec } from './declarative-config';
import { generateKongForKubernetesConfigFromSpec } from './kubernetes';
import SwaggerParser from 'swagger-parser';
import { OpenApi3Spec } from './types/openapi3';
import { ConversionResultType, ConversionResult, DeclarativeConfigResult, KongForKubernetesResult } from './types/outputs';
import YAML from 'yaml';

const defaultTags = ['OAS3_import'];

export async function generate(
  specPath: string,
  type: 'kong-declarative-config',
  tags?: string[],
): Promise<DeclarativeConfigResult>
export async function generate(
  specPath: string,
  type: 'kong-for-kubernetes',
  tags?: string[],
): Promise<KongForKubernetesResult>
export async function generate(
  specPath: string,
  type: ConversionResultType,
  tags: string[] = [],
) {
  return new Promise<ConversionResult>((resolve, reject) => {
    fs.readFile(path.resolve(specPath), 'utf8', (err, contents) => {
      if (err != null) {
        reject(err);
        return;
      }

      const fileSlug = path.basename(specPath);
      const allTags = [`OAS3file_${fileSlug}`, ...tags];
      // @ts-expect-error -- To avoid this error (inherent to overloads), we must simply change the call signature to accept a single object with properties for each parameter.
      resolve(generateFromString(contents, type, allTags));
    });
  });
}

export async function generateFromString(
  specStr: string,
  type: 'kong-declarative-config',
  tags?: string[],
): Promise<DeclarativeConfigResult>
export async function generateFromString(
  specStr: string,
  type: 'kong-for-kubernetes',
  tags?: string[],
): Promise<KongForKubernetesResult>
export async function generateFromString(
  specStr: string,
  type: ConversionResultType,
  tags: string[] = [],
) {
  const api = await parseSpec(specStr);
  // @ts-expect-error -- To avoid this error (inherent to overloads), we must simply change the call signature to accept a single object with properties for each parameter.
  return generateFromSpec(api, type, tags);
}

export function generateFromSpec(
  api: OpenApi3Spec,
  type: 'kong-declarative-config',
  tags?: string[],
): DeclarativeConfigResult
export function generateFromSpec(
  api: OpenApi3Spec,
  type: 'kong-for-kubernetes',
  tags?: string[],
): KongForKubernetesResult
export function generateFromSpec(
  api: OpenApi3Spec,
  type: ConversionResultType,
  tags: string[] = [],
) {
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

export async function parseSpec(spec: string | Record<string, any>) {
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

  // @ts-expect-error -- TSCONVERSION
  return SwaggerParser.dereference(api) as Promise<OpenApi3Spec>;
}
