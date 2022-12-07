import { describe, expect, it } from '@jest/globals';
import execa from 'execa';
import fs from 'fs';
import { getBinPathSync } from 'get-bin-path';
import path from 'path';

const binariesDirectory = '../insomnia-inso/binaries';
const npmPackageBinPath = getBinPathSync({ cwd: '../insomnia-inso' });
const binaries = fs.readdirSync(binariesDirectory).map(binary => path.join(binariesDirectory, binary));

describe('should find binaries', () => {
  it('should find the npm package bin', () => {
    expect(npmPackageBinPath).not.toBeUndefined();
  });

  it('should find at least one single app binary', () => {
    expect(binaries.length).toBeGreaterThanOrEqual(1);
  });
});

describe.each([npmPackageBinPath, ...binaries].filter(x => x))('inso with %s', binPath => {
  const inso = (args: string) => execa.sync(binPath, [args]);

  describe('run cli smoke test', () => {
    it('should not fail running tests', () => {
      const { failed } = inso('run test --src fixtures/inso-nedb --env "Dev Echo Test Suite" --verbose');
      expect(failed).toBe(false);
    });
  });

  describe('generate config', () => {
    it('should not fail generating config', () => {
      const { failed } = inso('generate config --src fixtures/inso-nedb "Smoke Test API server 1.0.0"');
      expect(failed).toBe(false);
    });
  });

  describe('lint spec', () => {
    it('should not fail linting spec', () => {
      const { failed } = inso('lint spec --src fixtures/inso-nedb "Smoke Test API server 1.0.0"');
      expect(failed).toBe(false);
    });
  });

  describe('export spec', () => {
    it('should not fail exporting spec', () => {
      const { failed } = inso('export spec --src fixtures/inso-nedb "Smoke Test API server 1.0.0"');
      expect(failed).toBe(false);
    });
  });
});
