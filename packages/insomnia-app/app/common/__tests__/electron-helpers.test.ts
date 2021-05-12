import electron from 'electron';
import { ESLint } from 'eslint';
import { promises } from 'fs';
import path from 'path';
import { clickLink } from '../electron-helpers';
const { readFile } = promises;

/* eslint-disable no-restricted-properties */
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

  // This is disabled because it's too slow.
  // At the time of writing it takes 9-10 seconds and adds about 5 seconds to our test suite (which, in total takes 15 seconds).
  // A 25% increase in overall run of all tests is too much to justify, but it is worth considering optimizing in the future and thus not worth removing.
  it.skip('is disallowed by eslint', async () => {
    /** The source code of this file, but with the disable turned off */
    const code = String(await readFile(__filename)).replace('eslint-disable', '');
    const cwd = path.join(__dirname, '../../../');
    const eslint = new ESLint({ cwd });

    const lineResults = await eslint.lintText(code, { filePath: __filename });

    expect(lineResults).toHaveLength(1);
    expect(lineResults[0].messages[0].ruleId).toEqual('no-restricted-properties');
  });
});
/* eslint-enable no-restricted-properties */
