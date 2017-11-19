import * as appPackage from '../package.json';
import * as globalPackage from '../../package.json';
import {globalBeforeEach} from '../__jest__/before-each';

describe('package.json', () => {
  beforeEach(globalBeforeEach);
  it('all app dependencies should be same in global', () => {
    for (const name of Object.keys(appPackage.dependencies)) {
      const expected = globalPackage.dependencies[name];
      const actual = appPackage.dependencies[name];
      expect(`${name}::${actual}`).toBe(`${name}::${expected}`);
    }
  });

  it('sticks graphql dependencies', () => {
    /*
     * This test is here to make sure no one updates these. If you want to update
     * them, make sure that they both require the same version of graphql and to
     * also dedup so there is only one version of graphql installed. If not, it
     * causes problems with instanceof not matching the correct class. Also, if
     * these are updated, be sure to test graphql linting and autocomplete.
     */
    expect(globalPackage.dependencies['graphql']).toBe('^0.10.5');
    expect(globalPackage.dependencies['codemirror-graphql']).toBe('^0.6.11');
  });
});
