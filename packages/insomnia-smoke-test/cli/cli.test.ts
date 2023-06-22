import { describe, expect, it } from '@jest/globals';
import execa from 'execa';
import path from 'path';

const binPath = path.resolve('../insomnia-inso/binaries/inso');

describe('inso basic features', () => {
  describe('run test', () => {
    it('should not fail running tests', async () => {
      const { failed } = await execa(binPath, [
        'run',
        'test',
        '--src',
        'fixtures/inso-nedb',
        '--env',
        'Dev',
        'Echo Test Suite',
        '--verbose',
      ]);

      expect(failed).toBe(false);
    }, 20 * 1000);
  });

  describe('generate config', () => {
    it('should not fail generating config', async () => {
      const { failed } = await execa(binPath, [
        'generate',
        'config',
        '--src',
        'fixtures/inso-nedb',
        'Smoke Test API server 1.0.0',
      ]);

      expect(failed).toBe(false);
    });
  });

  describe('lint spec', () => {
    it('should not fail linting spec', async () => {
      const { failed } = await execa(binPath, [
        'lint',
        'spec',
        '--src',
        'fixtures/inso-nedb',
        'Smoke Test API server 1.0.0',
      ]);

      expect(failed).toBe(false);
    });
  });

  describe('export spec', () => {
    it('should not fail linting spec', async () => {
      const { failed } = await execa(binPath, [
        'export',
        'spec',
        '--src',
        'fixtures/inso-nedb',
        'Smoke Test API server 1.0.0',
      ]);

      expect(failed).toBe(false);
    });
  });
});
