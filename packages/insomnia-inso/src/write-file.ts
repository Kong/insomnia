import { mkdir, writeFile } from 'node:fs/promises';

import path from 'path';

import { InsoError } from './errors';

export async function writeFileWithCliOptions(
  output: string,
  contents: string,
  workingDir?: string,
): Promise<string> {
  const outputPath = path.isAbsolute(output) ? output : path.join(workingDir || process.cwd(), output);

  try {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, contents);
    return outputPath;
  } catch (error) {
    console.error(error);
    throw new InsoError(`Failed to write to "${outputPath}"`, error);
  }
}
