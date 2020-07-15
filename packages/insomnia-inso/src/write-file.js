// @flow
import path from 'path';
import mkdirp from 'mkdirp';
import fs from 'fs';

type Result = {
  outputPath: string,
  error?: Error,
};

export async function writeFileWithCliOptions(
  output: string,
  contents: string,
  workingDir?: string,
): Promise<Result> {
  const outputPath = path.join(workingDir || '.', output);
  try {
    await mkdirp.sync(path.dirname(outputPath));
    await fs.promises.writeFile(outputPath, contents);
  } catch (e) {
    return { outputPath, error: e };
  }
  return { outputPath };
}
