// @flow

import { emptyDb, loadDb } from '../index';
import gitAdapter from '../adapters/git-adapter';
import neDbAdapter from '../adapters/ne-db-adapter';

jest.mock('../adapters/git-adapter');
jest.mock('../adapters/ne-db-adapter');

describe('loadDb()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const mock = (mockFn: any) => mockFn;

  it('should default to current directory if working dir not defined', async () => {
    mock(gitAdapter).mockResolvedValue(emptyDb());
    await loadDb({ workingDir: undefined });

    expect(gitAdapter).toHaveBeenCalledWith('.', undefined);
    expect(neDbAdapter).not.toHaveBeenCalled();
  });

  it('should load git data from working directory', async () => {
    mock(gitAdapter).mockResolvedValue(emptyDb());
    await loadDb({ workingDir: 'dir', filterTypes: ['Environment'] });

    expect(gitAdapter).toHaveBeenCalledWith('dir', ['Environment']);
    expect(neDbAdapter).not.toHaveBeenCalled();
  });

  it('should load nedb from appDataDir', async () => {
    mock(gitAdapter).mockResolvedValue(emptyDb());
    await loadDb({ appDataDir: 'dir', filterTypes: ['Environment'] });

    expect(gitAdapter).not.toHaveBeenCalled();
    expect(neDbAdapter).toHaveBeenCalledWith('dir', ['Environment']);
  });

  it('should not load from git if appDataDir is defined', async () => {
    await loadDb({ appDataDir: 'dir' });

    expect(gitAdapter).not.toHaveBeenCalled();
    expect(neDbAdapter).toHaveBeenCalled();
  });

  it('should load from neDb if not loaded from git', async () => {
    mock(gitAdapter).mockResolvedValue(null);
    await loadDb();

    expect(gitAdapter).toHaveBeenCalled();
    expect(neDbAdapter).toHaveBeenCalled();
  });
});
