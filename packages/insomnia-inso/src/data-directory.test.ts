import { getAppDataDir } from './data-directory';
import path from 'path';
import os from 'os';

jest.mock('os', () => ({
  ...jest.requireActual<typeof os>('os'),
  homedir: (): string => 'homedir',
}));

const setPlatform = (platform: NodeJS.Platform) => {
  Object.defineProperty(process, 'platform', {
    value: platform,
  });
};

describe('getAppDataDir()', () => {
  const OLD_ENV = process.env;
  const OLD_PLATFORM = process.platform;

  beforeEach(() => {
    process.env = { ...OLD_ENV }; // make a copy

    setPlatform(OLD_PLATFORM);
  });

  afterAll(() => {
    process.env = OLD_ENV; // restore old env

    setPlatform(OLD_PLATFORM);
  });

  it('should return the correct directory on macOS', () => {
    setPlatform('darwin');

    expect(getAppDataDir('testApp')).toBe(
      path.join('homedir', 'Library', 'Application Support', 'testApp'),
    );
  });

  it('should return the correct directory on Windows with APPDATA not set', () => {
    setPlatform('win32');

    process.env.APPDATA = undefined;
    expect(getAppDataDir('testApp')).toBe(path.join('homedir', 'AppData', 'Roaming', 'testApp'));
  });

  it('should return the correct directory on Windows with APPDATA set', () => {
    setPlatform('win32');

    process.env.APPDATA = 'test';
    expect(getAppDataDir('testApp')).toBe(path.join('test', 'testApp'));
  });

  it('should return the correct directory on Linux with XDG_DATA_HOME not set', () => {
    setPlatform('linux');

    process.env.XDG_DATA_HOME = undefined;
    expect(getAppDataDir('testApp')).toBe(path.join('homedir', '.config', 'testApp'));
  });

  it('should return the correct directory on Linux with XDG_DATA_HOME set', () => {
    setPlatform('linux');

    process.env.XDG_DATA_HOME = 'test';
    expect(getAppDataDir('testApp')).toBe(path.join('test', 'testApp'));
  });

  it('should return nothing on other platforms', () => {
    // @ts-expect-error this is an intentionally bad value
    setPlatform('testPlatform');

    expect(getAppDataDir('testApp')).toBe('');
  });
});
