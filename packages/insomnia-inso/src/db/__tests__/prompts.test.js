// @flow

import { emptyDb } from '../index';
import type { Database } from '../index';
import {
  generateIdIsh,
  loadApiSpec,
  loadTestSuites,
  loadWorkspace,
  promptApiSpec,
} from '../prompts';
import type { ApiSpec, UnitTestSuite, Workspace } from '../types';
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

  describe('loadWorkspace()', () => {
    const workspace: $Shape<Workspace> = {
      _id: 'wrk_1234567890',
      name: 'workspace name',
    };

    beforeEach(() => {
      db.Workspace.push(workspace);
    });

    it('should return null if workspace not found', () => {
      expect(loadWorkspace(db, 'not-found')).toBeNull();
    });

    it.each([generateIdIsh(workspace), workspace._id, workspace.name])(
      'should return workspace with identifier: %o',
      identifier => {
        expect(loadWorkspace(db, identifier)).toBe(workspace);
      },
    );

    it('should throw error if multiple workspace matched', () => {
      db.Workspace.push({ ...workspace });

      expect(() => loadWorkspace(db, workspace._id)).toThrowError();
    });
  });

  describe('loadTestSuites()', () => {
    const workspace: $Shape<Workspace> = {
      _id: 'wrk_1234567890',
      name: 'workspace name',
    };

    const spec: $Shape<ApiSpec> = {
      _id: 'spc_1234567890',
      fileName: 'spec name',
      parentId: workspace._id,
    };

    const suite1: $Shape<UnitTestSuite> = {
      _id: 'uts_1234567890',
      name: 'suite one',
      parentId: workspace._id,
    };

    const suite2: $Shape<UnitTestSuite> = {
      _id: 'uts_987654321',
      name: 'suite two',
      parentId: workspace._id,
    };

    beforeEach(() => {
      db.Workspace.push(workspace);
      db.ApiSpec.push(spec);
      db.UnitTestSuite.push(suite1);
      db.UnitTestSuite.push(suite2);
    });

    it.each([generateIdIsh(workspace), workspace._id, workspace.name])(
      'should load all suites that match by workspace id: %o',
      identifier => {
        const result = loadTestSuites(db, identifier);
        expect(result).toHaveLength(2);
        expect(result).toContain(suite1);
        expect(result).toContain(suite2);
      },
    );

    it.each([generateIdIsh(spec), spec._id, spec.fileName])(
      'should load all suites that match by apiSpec id: %o',
      identifier => {
        const result = loadTestSuites(db, identifier);
        expect(result).toHaveLength(2);
        expect(result).toContain(suite1);
        expect(result).toContain(suite2);
      },
    );

    it.each([generateIdIsh(suite1), suite1._id, suite1.name])(
      'should load single suite that matches by id: %o',
      identifier => {
        const result = loadTestSuites(db, identifier);
        expect(result).toHaveLength(1);
        expect(result).toContain(suite1);
      },
    );
  });
});
