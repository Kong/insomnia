import { describe, expect, it, jest } from '@jest/globals';

import type { Database } from '../index';
import { emptyDb } from '../index';
import { loadApiSpec, promptApiSpec } from './api-spec';
import type { ApiSpec } from './types';
import { generateIdIsh } from './util';

jest.mock('enquirer');

describe('apiSpec', () => {
  let db: Database = emptyDb();

  const spec: ApiSpec = {
    _id: 'spc_1234567890',
    fileName: 'fileName',
    parentId: 'something',
    type: 'ApiSpec',
    contentType: 'json',
    contents: '{}',
  };

  beforeEach(() => {
    db = emptyDb();
    const dummySpec: ApiSpec = {
      _id: 'spc_dummy',
      fileName: 'dummy spec',
      parentId: 'something',
      type: 'ApiSpec',
      contentType: 'json',
      contents: '{}',
    };
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
  });

  describe('loadApiSpec()', () => {
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
