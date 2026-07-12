import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';

import { app } from 'electron';

export const writeResponseBodyToFile = async (options: {
  sourcePath: string;
  destinationPath: string;
  bodyCompression?: 'zip' | null;
}) => {
  // Validate sourcePath is within the expected responses directory to prevent a
  // compromised renderer from using this handler to read arbitrary files on disk.
  const userdataDirectory = process.env.INSOMNIA_DATA_PATH || app.getPath('userData');
  const allowedResponsesDir = path.join(userdataDirectory, 'responses');
  const resolvedSource = path.resolve(options.sourcePath);
  if (!resolvedSource.startsWith(allowedResponsesDir + path.sep) || !resolvedSource.endsWith('.response')) {
    throw new Error(
      'writeResponseBodyToFile: sourcePath is outside the allowed responses directory or does not end in .response',
    );
  }

  try {
    const dir = path.dirname(options.destinationPath);
    await fs.promises.mkdir(dir, { recursive: true });

    await (options.bodyCompression === 'zip'
      ? pipeline(
          fs.createReadStream(options.sourcePath),
          zlib.createGunzip(),
          fs.createWriteStream(options.destinationPath),
        )
      : fs.promises.copyFile(options.sourcePath, options.destinationPath));

    return options.destinationPath;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }

    throw new Error(String(err));
  }
};
