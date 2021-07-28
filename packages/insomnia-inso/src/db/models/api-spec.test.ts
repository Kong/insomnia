import enquirer from 'enquirer';

import type { Database } from '../index';
import { emptyDb } from '../index';
import { loadApiSpec, promptApiSpec } from './api-spec';
import type { ApiSpec } from './types';
import { generateIdIsh } from './util';

jest.mock('enquirer');

describe('apiSpec', () => {
  let db: Database = emptyDb();

  const spec: Partial<ApiSpec> = {
    _id: 'spc_1234567890',
    fileName: 'fileName',
  } as ApiSpec;

  beforeEach(() => {
    db = emptyDb();
    const dummySpec: Partial<ApiSpec> = {
      _id: 'spc_dummy',
      fileName: 'dummy spec',
    } as ApiSpec;
    db.ApiSpec.push(spec);
    db.ApiSpec.push(dummySpec);
    jest.clearAllMocks();
  });

  describe('promptApiSpec()', () => {
    it('should return null if ci', () => {
      expect(promptApiSpec(db, true)).resolves.toBeNull();
    });

    it('should return null if db.ApiSpec is empty', () => {
      db.ApiSpec = [];
      expect(promptApiSpec(db, false)).resolves.toBeNull();
    });

    it('should return null if prompt result does not contain closing [ - id]', async () => {
      enquirer.__mockPromptRun('malformed result');

      expect(promptApiSpec(db, false)).resolves.toBeNull();
    });

    it('should load apiSpec after prompt result', async () => {
      enquirer.__mockPromptRun('fileName - spc_123456');

      const result = await promptApiSpec(db, false);
      expect(result).toBe(spec);
    });

    it('should match snapshot of autocomplete config', async () => {
      await promptApiSpec(db, false);
      expect(enquirer.__constructorMock.mock.calls[0][0]).toMatchSnapshot();
    });
  });

  describe('loadApiSpec()', () => {
    it('should return null if spec not found', () => {
      expect(loadApiSpec(db, 'not-found')).toBeNull();
    });

    it.each([generateIdIsh(spec), spec._id, spec.fileName])(
      'should return spec with identifier: %o',
      (identifier) => {
        expect(loadApiSpec(db, identifier)).toBe(spec);
      },
    );

    it('should throw error if multiple specs matched', () => {
      db.ApiSpec.push({ ...spec });
      expect(() => loadApiSpec(db, spec._id)).toThrowError();
    });
  });
});
