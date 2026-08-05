import path from 'node:path';

import type { AllTypes } from 'insomnia-data';
import { models } from 'insomnia-data';

import { GIT_CLONE_DIR } from './git-vcs';

// The win32 separator is a single backslash (\), but we have to escape both the JS string and RegExp.
const pathSep = path.sep === path.win32.sep ? '\\\\' : '/';

const _cloneDirRegExp = new RegExp(`^${GIT_CLONE_DIR}${pathSep}`);

interface GitPathSegments {
  root: string | null;
  type: AllTypes | null;
  id: string | null;
}

const parseGitPath = (filePath: string): GitPathSegments => {
  filePath = path.normalize(filePath);
  // FilePath will start with the clone directory. We want to remove the clone dir, so that the
  // segments can be extracted correctly.
  filePath = filePath.replace(_cloneDirRegExp, '');
  // Ignore empty and current directory '.' segments
  const [root, type, idRaw] = filePath.split(path.sep).filter(s => s !== '' && s !== '.');
  const id = typeof idRaw === 'string' ? idRaw.replace(/\.(json|yml)$/, '') : idRaw;
  return {
    root: root || null,
    type: models.isValidType(type) ? type : null,
    id: id || null,
  };
};

export default parseGitPath;
