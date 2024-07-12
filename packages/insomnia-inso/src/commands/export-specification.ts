import { mkdir, writeFile } from 'node:fs/promises';

import path from 'path';
import YAML from 'yaml';

import { InsoError } from '../cli';

export async function writeFileWithCliOptions(
  outputPath: string,
  contents: string,
): Promise<string> {
  try {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, contents);
    return outputPath;
  } catch (error) {
    console.error(error);
    throw new InsoError(`Failed to write to "${outputPath}"`, error);
  }
}

export async function exportSpecification({ specContent, skipAnnotations }: { specContent: string; skipAnnotations: boolean }) {
  if (!skipAnnotations) {
    return specContent;
  }

  const recursiveDeleteKey = (obj: any) => {
    Object.keys(obj).forEach(key => {
      if (key.startsWith('x-kong-')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        recursiveDeleteKey(obj[key]);
      }
    });
    return obj;
  };
  return YAML.stringify(recursiveDeleteKey(YAML.parse(specContent)));
}
