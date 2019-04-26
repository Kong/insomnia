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

  it('packages must be included in webpack build or else errors happen', () => {
    // If this is built by Webpack it fails on multipart/form-data
    expect(globalPackage.packedDependencies.includes('httpsnippet')).toBe(false);
  });

  it('packages must NOT be included in webpack build or else errors happen', () => {
    // PDFJS breaks if not part of Webpack build
    expect(globalPackage.packedDependencies.includes('pdfjs-dist')).toBe(true);
  });
});
