// @flow

import { emptyDb, loadDb } from '../index';
import gitAdapter from '../adapters/git-adapter';
import neDbAdapter from '../adapters/ne-db-adapter';
import { globalBeforeAll, globalBeforeEach } from '../../../__jest__/before';
import logger from '../../logger';
import path from 'path';

jest.mock('../adapters/git-adapter');
jest.mock('../adapters/ne-db-adapter');

describe('loadDb()', () => {
  beforeAll(() => {
    globalBeforeAll();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    globalBeforeEach();
  });

  const mock = (mockFn: any) => mockFn;

  it('should default to current directory if working dir not defined', async () => {
    mock(gitAdapter).mockResolvedValue(emptyDb());
    await loadDb({ workingDir: undefined });

    expect(logger.__getLogs().debug).toEqual([
      `Data store configured from git repository at \`${path.resolve('.')}\``,
    ]);
    expect(gitAdapter).toHaveBeenCalledWith('.', undefined);
    expect(neDbAdapter).not.toHaveBeenCalled();
  });

  it('should load git data from working directory', async () => {
    mock(gitAdapter).mockResolvedValue(emptyDb());
    await loadDb({ workingDir: 'dir', filterTypes: ['Environment'] });

    expect(logger.__getLogs().debug).toEqual([
      `Data store configured from git repository at \`${path.resolve('dir')}\``,
    ]);
    expect(gitAdapter).toHaveBeenCalledWith('dir', ['Environment']);
    expect(neDbAdapter).not.toHaveBeenCalled();
  });

  it('should load nedb from appDataDir', async () => {
    mock(gitAdapter).mockResolvedValue(emptyDb());
    mock(neDbAdapter).mockResolvedValue(emptyDb());
    await loadDb({ appDataDir: 'dir', filterTypes: ['Environment'] });

    expect(logger.__getLogs().debug).toEqual([
      `Data store configured from app data directory at \`${path.resolve('dir')}\``,
    ]);
    expect(gitAdapter).not.toHaveBeenCalled();
    expect(neDbAdapter).toHaveBeenCalledWith('dir', ['Environment']);
  });

  it('should not load from git if appDataDir is defined', async () => {
    mock(neDbAdapter).mockResolvedValue(emptyDb());

    await loadDb({ appDataDir: 'dir' });

    expect(logger.__getLogs().debug).toEqual([
      `Data store configured from app data directory at \`${path.resolve('dir')}\``,
    ]);
    expect(gitAdapter).not.toHaveBeenCalled();
    expect(neDbAdapter).toHaveBeenCalled();
  });

  it('should load from neDb if not loaded from git', async () => {
    mock(gitAdapter).mockResolvedValue(null);
    mock(neDbAdapter).mockResolvedValue(emptyDb());

    await loadDb();

    // Cannot assert the full path because it is application data
    expect(logger.__getLogs().debug).toEqual([
      expect.stringContaining(`Data store configured from app data directory at`),
    ]);
    expect(gitAdapter).toHaveBeenCalled();
    expect(neDbAdapter).toHaveBeenCalled();
  });

  it('should warn and return empty db if nothing loaded from git or nedb', async () => {
    mock(gitAdapter).mockResolvedValue(null);
    mock(neDbAdapter).mockResolvedValue(null);

    const db = await loadDb();

    expect(logger.__getLogs().warn).toEqual([
      'No git or app data store found, re-run `inso` with `--verbose` to see tracing information',
    ]);
    expect(db).toEqual(emptyDb());
  });
});
