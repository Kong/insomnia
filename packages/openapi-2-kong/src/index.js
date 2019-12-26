// @flow
import fs from 'fs';
import path from 'path';
import { parseSpec } from './common';
import { generateServices } from './services';
import { generateUpstreams } from './upstreams';

export async function generate(specPath: string, tags: Array<string> = []): Promise<Object> {
  return new Promise((resolve, reject) => {
    fs.readFile(path.resolve(specPath), 'utf8', (err, contents) => {
      if (err != null) {
        reject(err);
        return;
      }

      const fileSlug = path.basename(specPath);
      const allTags = [`OAS3file_${fileSlug}`, ...tags];
      resolve(generateFromString(contents, allTags));
    });
  });
}

export async function generateFromString(
  specStr: string,
  tags: Array<string> = [],
): Promise<DeclarativeConfig> {
  const api: OpenApi3Spec = await parseSpec(specStr);
  return generateFromSpec(api, ['OAS3_import', ...tags]);
}

export function generateFromSpec(
  api: OpenApi3Spec,
  tags: Array<string> = [],
): DeclarativeConfig {
  let result = null;
  try {
     result = {
      _format_version: '1.1',
      services: generateServices(api, tags),
      upstreams: generateUpstreams(api, tags),
    };
  } catch (err) {
    throw new Error('Failed to generate spec: ' + err.message);
  }

  // This remover any circular references or weirdness that might result
  // from the JS objects used.
  // SEE: https://github.com/Kong/studio/issues/93
  return JSON.parse(JSON.stringify(result));
}
