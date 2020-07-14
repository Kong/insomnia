// @flow
import path from 'path';
import mkdirp from 'mkdirp';
import fs from 'fs';

export async function writeFileWithCliOptions(
  output: string,
  contents: string,
  fallbackFileName: string,
  workingDir?: string,
): Promise<string> {
  // if output ends with a filename, use it, otherwise use the fallback filename
  const fullPath = path.join(
    workingDir || '.',
    output,
    path.extname(output) ? '' : fallbackFileName,
  );
  await mkdirp.sync(path.dirname(fullPath));
  await fs.promises.writeFile(fullPath, contents);
  return fullPath;
}
