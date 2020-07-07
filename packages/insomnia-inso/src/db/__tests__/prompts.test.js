// @flow

import { emptyDb } from '../index';
import type { Database } from '../index';
import { generateIdIsh, loadApiSpec, promptApiSpec } from '../prompts';
import type { ApiSpec } from '../types';
import enquirer from 'enquirer';

jest.mock('enquirer');

describe('prompts', () => {
  let db: Database = emptyDb();
  beforeEach(() => {
    db = emptyDb();
    jest.clearAllMocks();
  });

  describe('promptApiSpec()', () => {
    it('should return null if ci', () => {
      expect(promptApiSpec(db, true)).resolves.toBeNull();
    });

    it('should return null if db.ApiSpec is empty', () => {
      expect(promptApiSpec(db, false)).resolves.toBeNull();
    });

    it('should load apiSpec after prompt result', async () => {
      const spec: $Shape<ApiSpec> = {
        _id: 'spc_1234567890',
        fileName: 'fileName',
      };

      db.ApiSpec.push(spec);

      enquirer.__mockPromptRun('fileName - spc_123456');

      await promptApiSpec(db, false);

      expect(enquirer.__constructorMock.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should match snapshot of autocomplete config', async () => {
      const spec: $Shape<ApiSpec> = {
        _id: 'spc_1234567890',
        fileName: 'fileName',
      };

      db.ApiSpec.push(spec);

      await promptApiSpec(db, false);

      expect(enquirer.__constructorMock.mock.calls[0][0]).toMatchSnapshot();
    });
  });
});

describe('loaders', () => {
  let db: Database = emptyDb();
  beforeEach(() => {
    db = emptyDb();
  });

  describe('loadApiSpec()', () => {
    const spec: $Shape<ApiSpec> = {
      _id: 'spc_1234567890',
      fileName: 'fileName',
    };

    beforeEach(() => {
      db.ApiSpec.push(spec);
    });

    it('should return null if spec not found', () => {
      expect(loadApiSpec(db, 'not-found')).toBeNull();
    });

    it.each([generateIdIsh(spec), spec._id, spec.fileName])(
      'should return spec with identifier: %o',
      identifier => {
        expect(loadApiSpec(db, identifier)).toBe(spec);
      },
    );

    it('should throw error if multiple specs matched', () => {
      db.ApiSpec.push({ ...spec });

      expect(() => loadApiSpec(db, spec._id)).toThrowError();
    });
  });
});
