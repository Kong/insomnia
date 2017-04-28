import * as appPackage from '../package.json';
import * as globalPackage from '../../package.json';

describe('package.json', () => {
  it('all app dependencies should be same in global', () => {
    for (const name of Object.keys(appPackage.dependencies)) {
      const expected = globalPackage.dependencies[name];
      const actual = appPackage.dependencies[name];
      expect(`${name}::${actual}`).toBe(`${name}::${expected}`);
    }
  });
});
