import electron from 'electron';
import { clickLink } from '../electron-helpers';

describe('clickLink', () => {
  it('should allow http links', () => {
    const url = 'http://mockbin.org';
    clickLink(url);
    expect(electron.shell.openExternal).toHaveBeenCalledWith(url);
  });

  it('should allow https links', () => {
    const url = 'https://mockbin.org';
    clickLink(url);
    expect(electron.shell.openExternal).toHaveBeenCalledWith(url);
  });

  it('should not allow smb links', () => {
    const url = 'file:///C:/windows/system32/calc.exe';
    clickLink(url);
    expect(electron.shell.openExternal).not.toHaveBeenCalledWith(url);
  });
});