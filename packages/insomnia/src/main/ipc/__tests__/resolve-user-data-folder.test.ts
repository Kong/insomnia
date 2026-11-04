import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveUserDataFolder } from '../path-guard';

// Backs the `readOrCreateDataDir` IPC handler in main.ts, whose `folder` argument is renderer-supplied.
describe('resolveUserDataFolder', () => {
  const userDataDir = path.join('/tmp', 'insomnia-user-data');
  const outsideMessage = 'readOrCreateDataDir: folder is outside the allowed userData directory';

  it('resolves a folder inside userData', () => {
    expect(resolveUserDataFolder(userDataDir, 'plugins')).toBe(path.join(userDataDir, 'plugins'));
  });

  it('rejects a ../ escape', () => {
    expect(() => resolveUserDataFolder(userDataDir, '../escaped')).toThrow(outsideMessage);
  });

  it('rejects an absolute path outside userData', () => {
    expect(() => resolveUserDataFolder(userDataDir, '/etc')).toThrow(outsideMessage);
  });

  it('rejects a sibling directory sharing the userData prefix', () => {
    expect(() => resolveUserDataFolder(userDataDir, path.join('..', 'insomnia-user-data-evil'))).toThrow(
      outsideMessage,
    );
  });
});
