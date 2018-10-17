import * as globalPackage from '../../package.json';
import { globalBeforeEach } from '../__jest__/before-each';

describe('package.json', () => {
  beforeEach(globalBeforeEach);
  it('all packed dependencies should exist', () => {
    for (const name of globalPackage.packedDependencies) {
      const version = globalPackage.dependencies[name];
      expect(version).toBeDefined();
    }
  });

  it('sticks graphql dependencies', () => {
    /*
     * This test is here to make sure no one updates these. If you want to update
     * them, make sure that they both require the same version of graphql and to
     * also de-dup so there is only one version of graphql installed. If not, it
     * causes problems with instanceof not matching the correct class. Also, if
     * these are updated, be sure to test graphql linting and autocomplete.
     */
    expect(globalPackage.dependencies['graphql']).toBe('^0.13.2');
    expect(globalPackage.dependencies['codemirror-graphql']).toBe('^0.6.12');
  });

  it('packages must be included in webpack build or else errors happen', () => {
    // If this is built by Webpack it fails on multipart/form-data
    expect(globalPackage.packedDependencies.includes('httpsnippet')).toBe(false);
  });

  it('packages must NOT be included in webpack build or else errors happen', () => {
    // PDFJS breaks if not part of Webpack build
    expect(globalPackage.packedDependencies.includes('pdfjs-dist')).toBe(true);
  });
});
