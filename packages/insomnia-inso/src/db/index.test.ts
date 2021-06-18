import { emptyDb, loadDb } from './index';
import _gitAdapter from './adapters/git-adapter';
import _neDbAdapter from './adapters/ne-db-adapter';
import { globalBeforeAll, globalBeforeEach } from '../jest/before';
import { logger } from '../logger';
import path from 'path';

jest.mock('./adapters/git-adapter');
jest.mock('./adapters/ne-db-adapter');

const gitAdapter = _gitAdapter as jest.MockedFunction<typeof _gitAdapter>;
const neDbAdapter = _neDbAdapter as jest.MockedFunction<typeof _neDbAdapter>;

describe('loadDb()', () => {
  beforeAll(() => {
    globalBeforeAll();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    globalBeforeEach();
  });

  it('should default to current directory if working dir not defined', async () => {
    gitAdapter.mockResolvedValue(emptyDb());
    await loadDb({
      workingDir: undefined,
    });
    expect(logger.__getLogs().debug).toEqual([
      `Data store configured from git repository at \`${path.resolve('.')}\``,
    ]);
    expect(gitAdapter).toHaveBeenCalledWith('.', undefined);
    expect(neDbAdapter).not.toHaveBeenCalled();
  });

  it('should load git data from working directory', async () => {
    gitAdapter.mockResolvedValue(emptyDb());
    await loadDb({
      workingDir: 'dir',
      filterTypes: ['Environment'],
    });
    expect(logger.__getLogs().debug).toEqual([
      `Data store configured from git repository at \`${path.resolve('dir')}\``,
    ]);
    expect(gitAdapter).toHaveBeenCalledWith('dir', ['Environment']);
    expect(neDbAdapter).not.toHaveBeenCalled();
  });

  it('should load nedb from appDataDir', async () => {
    gitAdapter.mockResolvedValue(emptyDb());
    neDbAdapter.mockResolvedValue(emptyDb());
    await loadDb({
      appDataDir: 'dir',
      filterTypes: ['Environment'],
    });
    expect(logger.__getLogs().debug).toEqual([
      `Data store configured from app data directory at \`${path.resolve('dir')}\``,
    ]);
    expect(gitAdapter).not.toHaveBeenCalled();
    expect(neDbAdapter).toHaveBeenCalledWith('dir', ['Environment']);
  });

  it('should not load from git if appDataDir is defined', async () => {
    neDbAdapter.mockResolvedValue(emptyDb());
    await loadDb({
      appDataDir: 'dir',
    });
    expect(logger.__getLogs().debug).toEqual([
      `Data store configured from app data directory at \`${path.resolve('dir')}\``,
    ]);
    expect(gitAdapter).not.toHaveBeenCalled();
    expect(neDbAdapter).toHaveBeenCalled();
  });

  it('should load from neDb if not loaded from git', async () => {
    gitAdapter.mockResolvedValue(null);
    neDbAdapter.mockResolvedValue(emptyDb());
    await loadDb(); // Cannot assert the full path because it is application data

    expect(logger.__getLogs().debug).toEqual([
      expect.stringContaining('Data store configured from app data directory at'),
    ]);
    expect(gitAdapter).toHaveBeenCalled();
    expect(neDbAdapter).toHaveBeenCalled();
  });

  it('should warn and return empty db if nothing loaded from git or nedb', async () => {
    gitAdapter.mockResolvedValue(null);
    neDbAdapter.mockResolvedValue(null);
    const db = await loadDb();
    expect(logger.__getLogs().warn).toEqual([
      'No git or app data store found, re-run `inso` with `--verbose` to see tracing information',
    ]);
    expect(db).toEqual(emptyDb());
  });
});
