import { describe, expect, it } from '@jest/globals';
import execa from 'execa';
import path from 'path';

const binPath = path.resolve('../insomnia-inso/binaries/inso');

describe('inso basic features', () => {
  const inso = (...args: string[]) => execa.sync(binPath, args);
  // const res = await execa(binPath, ['-h']);
  console.log(binPath);
  describe('run test', () => {
    it('should not fail running tests', () => {
      const { failed } = inso(
        'run',
        'test',
        '--src',
        'fixtures/inso-nedb',
        '--env',
        'Dev',
        'Echo Test Suite',
        '--verbose',
      );

      expect(failed).toBe(false);
    });
  });

  describe('generate config', () => {
    it('should not fail generating config', () => {
      const { failed } = inso(
        'generate',
        'config',
        '--src',
        'fixtures/inso-nedb',
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
        '--src',
        'fixtures/inso-nedb',
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
        '--src',
        'fixtures/inso-nedb',
        'Smoke Test API server 1.0.0',
      );

      expect(failed).toBe(false);
    });
  });
});
