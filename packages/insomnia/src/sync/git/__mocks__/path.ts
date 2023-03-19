import { jest } from '@jest/globals';
import pathOriginal, { PlatformPath } from 'path';

// eslint-disable-next-line filenames/match-exported
const path = jest.requireActual('path') as typeof pathOriginal;

const exportObj = { __mockPath, ...path } as any;

function __mockPath(type: string) {
  const mock = type === 'win32' ? path.win32 : path.posix;

  Object.keys(mock).forEach(k => {
    exportObj[k] = mock[k as keyof PlatformPath];
  });
}

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = exportObj;
