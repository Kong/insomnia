import * as globalPackage from '../../package.json';
import { globalBeforeEach } from '../__jest__/before-each';

describe('package.json', () => {
  beforeEach(globalBeforeEach);

  it('all packed dependencies should exist', () => {
    for (const name of globalPackage.externalDependencies) {
      const version = globalPackage.dependencies[name];
      expect(version).toBeDefined();
    }
  });

  it('should be an external in webpack otherwise errors will happen', () => {
    // If this is built by Webpack it fails on multipart/form-data
    expect(globalPackage.externalDependencies).toContain('httpsnippet');
  });

  it('should NOT be an external in webpack otherwise errors happen', () => {
    // PDFJS breaks if not part of Webpack build
    expect(globalPackage.externalDependencies).not.toContain('pdfjs-dist');
  });
});
