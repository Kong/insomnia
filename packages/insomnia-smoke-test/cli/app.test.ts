import execa from 'execa';
import fs from 'fs';
import { getBinPathSync } from 'get-bin-path';
import path from 'path';
import { flatten } from 'ramda';
import { compact } from 'ramda-adjunct';

const binariesDirectory = '../insomnia-inso/binaries';
const npmPackageBinPath = getBinPathSync({ cwd: '../insomnia-inso' });
const binaries = fs.readdirSync(binariesDirectory).map(binary => path.join(binariesDirectory, binary));

type NestedArray<T> = (T | T[])[];

describe('should find binaries', () => {
  it('should find the npm package bin', () => {
    expect(npmPackageBinPath).not.toBeUndefined();
  });

  it('should find at least one single app binary', () => {
    expect(binaries.length).toBeGreaterThanOrEqual(1);
  });
});

const srcInsoNedb = ['--src', 'fixtures/inso-nedb'];

describe.each(compact([npmPackageBinPath, ...binaries]))('inso with %s', binPath => {
  const inso = (...args: NestedArray<string>) => execa.sync(binPath, flatten(args));

  describe('run test', () => {
    it('should not fail running tests', () => {
      const { failed } = inso(
        'run',
        'test',
        srcInsoNedb,
        ['--env', 'Dev'],
        'Echo Test Suite',
      );

      expect(failed).toBe(false);
    });
  });

  describe('generate config', () => {
    it('should not fail generating config', () => {
      const { failed } = inso(
        'generate',
        'config',
        srcInsoNedb,
        'Smoke Test API server 1.0.0',
      );

      expect(failed).toBe(false);
    });
  });

  describe('lint spec', () => {
    it('should not fail linting spec', () => {
      const { failed } = inso(
        'lint',
        'spec',
        srcInsoNedb,
        'Smoke Test API server 1.0.0',
      );

      expect(failed).toBe(false);
    });
  });

  describe('export spec', () => {
    it('should not fail linting spec', () => {
      const { failed } = inso(
        'export',
        'spec',
        srcInsoNedb,
        'Smoke Test API server 1.0.0',
      );

      expect(failed).toBe(false);
    });
  });
});
