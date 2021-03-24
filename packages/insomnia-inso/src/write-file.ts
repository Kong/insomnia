import path from 'path';
import mkdirp from 'mkdirp';
import fs from 'fs';
import { InsoError } from './errors';
export async function writeFileWithCliOptions(
  output: string,
  contents: string,
  workingDir?: string,
): Promise<string> {
  const outputPath = path.isAbsolute(output) ? output : path.join(workingDir || '.', output);

  try {
    await mkdirp.sync(path.dirname(outputPath));
    await fs.promises.writeFile(outputPath, contents);
    return outputPath;
  } catch (e) {
    throw new InsoError(`Failed to write to "${outputPath}"`, e);
  }
}
