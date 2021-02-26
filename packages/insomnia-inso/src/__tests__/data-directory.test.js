// @flow
import { getAppDataDir } from '../data-directory';
import path from 'path';

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: (): string => 'homedir',
}));

describe('getAppDataDir()', () => {
  const OLD_ENV = process.env;
  const OLD_PLATFORM = process.platform;

  beforeEach(() => {
    process.env = { ...OLD_ENV }; // make a copy
    _setPlatform(OLD_PLATFORM);
  });

  afterAll(() => {
    process.env = OLD_ENV; // restore old env
    _setPlatform(OLD_PLATFORM);
  });

  it('should return the correct directory on macOS', () => {
    _setPlatform('darwin');
    expect(getAppDataDir('testApp')).toBe(
      path.join('homedir', 'Library', 'Application Support', 'testApp'),
    );
  });

  it('should return the correct directory on Windows with APPDATA not set', () => {
    _setPlatform('win32');
    process.env.APPDATA = undefined;
    expect(getAppDataDir('testApp')).toBe(path.join('homedir', 'AppData', 'Roaming', 'testApp'));
  });

  it('should return the correct directory on Windows with APPDATA set', () => {
    _setPlatform('win32');
    process.env.APPDATA = 'test';
    expect(getAppDataDir('testApp')).toBe(path.join('test', 'testApp'));
  });

  it('should return the correct directory on Linux with XDG_DATA_HOME not set', () => {
    _setPlatform('linux');
    process.env.XDG_DATA_HOME = undefined;
    expect(getAppDataDir('testApp')).toBe(path.join('homedir', '.config', 'testApp'));
  });

  it('should return the correct directory on Linux with XDG_DATA_HOME set', () => {
    _setPlatform('linux');
    process.env.XDG_DATA_HOME = 'test';
    expect(getAppDataDir('testApp')).toBe(path.join('test', 'testApp'));
  });

  it('should return nothing on other platforms', () => {
    _setPlatform('testPlatform');
    expect(getAppDataDir('testApp')).toBe('');
  });
});

function _setPlatform(platform: string) {
  Object.defineProperty(process, 'platform', {
    value: platform,
  });
}
