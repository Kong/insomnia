// @flow

import { emptyDb } from '../index';
import type { Database } from '../index';
import {
  generateIdIsh,
  loadEnvironment,
  loadTestSuites,
  promptEnvironment,
  promptTestSuites,
} from '../prompts';
import type { ApiSpec, Environment, UnitTestSuite, Workspace } from '../types';
import enquirer from 'enquirer';

jest.mock('enquirer');

describe('Unit Test Suite', () => {
  let db: Database = emptyDb();

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
    db = emptyDb();

    const dummySuite: $Shape<UnitTestSuite> = {
      _id: 'uts_dummy',
      name: 'dummy suite',
      parentId: 'dummy parent',
    };

    db.Workspace.push(workspace);
    db.ApiSpec.push(spec);
    db.UnitTestSuite.push(suite1);
    db.UnitTestSuite.push(suite2);
    db.UnitTestSuite.push(dummySuite);

    jest.clearAllMocks();
  });

  describe('promptTestSuites()', () => {
    it('should return empty array if ci', () => {
      expect(promptTestSuites(db, true)).resolves.toHaveLength(0);
    });

    it('should return empty array if no specs', () => {
      db.ApiSpec = [];
      expect(promptTestSuites(db, false)).resolves.toHaveLength(0);
    });

    it('should return empty array if prompt result does not contain closing [ - id]', async () => {
      enquirer.__mockPromptRun('malformed result');

      expect(promptTestSuites(db, false)).resolves.toHaveLength(0);
    });

    it('should load suite 1 after prompt result', async () => {
      enquirer.__mockPromptRun('suite one - uts_123456');

      const result = await promptTestSuites(db, false);

      expect(result).toHaveLength(1);
      expect(result).toContain(suite1);
    });

    it('should match snapshot of autocomplete config', async () => {
      await promptTestSuites(db, false);

      expect(enquirer.__constructorMock.mock.calls[0][0]).toMatchSnapshot();
    });
  });

  describe('loadTestSuites()', () => {
    it('should return empty array if no suites matched', () => {
      expect(loadTestSuites(db, 'not-found')).toHaveLength(0);
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

describe('Environment', () => {
  let db: Database = emptyDb();

  const workspace: $Shape<Workspace> = {
    _id: 'wrk_1234567890',
    name: 'workspace name',
  };

  const environment: $Shape<Environment> = {
    _id: 'env_1234567890',
    name: 'base env',
    parentId: workspace._id,
  };

  const subEnvironment: $Shape<Environment> = {
    _id: 'env_env_1234567890',
    name: 'sub env',
    parentId: environment._id,
  };

  beforeEach(() => {
    db = emptyDb();

    const dummySubEnv: $Shape<Environment> = {
      _id: 'env_env_dummy',
      name: 'dummy sub env',
      parentId: environment._id,
    };

    db.Workspace.push(workspace);
    db.Environment.push(environment);
    db.Environment.push(subEnvironment);
    db.Environment.push(dummySubEnv);

    jest.clearAllMocks();
  });

  describe('promptEnvironment()', () => {
    it('should return null if ci', () => {
      expect(promptEnvironment(db, true, workspace._id)).resolves.toBeNull();
    });

    it('should return null if no environments exist', () => {
      db.Environment = [];

      expect(promptEnvironment(db, false, workspace._id)).resolves.toBeNull();
    });

    it('should throw error if base env for workspace not found', () => {
      expect(promptEnvironment(db, false, 'workspace-not-found')).rejects.toThrowError();
    });

    it('should throw error if multiple base env for workspace found', () => {
      db.Environment.push({ ...environment });
      expect(promptEnvironment(db, false, workspace._id)).rejects.toThrowError();
    });

    it('should load sub environment after prompt result', async () => {
      enquirer.__mockPromptRun('environment - env_env_123456');

      expect(promptEnvironment(db, false, workspace._id)).resolves.toBe(subEnvironment);
    });

    it('should match snapshot of autocomplete config', async () => {
      await promptEnvironment(db, false, workspace._id);

      expect(enquirer.__constructorMock.mock.calls[0][0]).toMatchSnapshot();
    });
  });

  describe('loadEnvironment()', () => {
    it('should return null if no environments exist', () => {
      db.Environment = [];

      expect(loadEnvironment(db, workspace._id, environment._id)).toBeNull();
    });

    it('should throw error if base env for workspace not found', () => {
      expect(() => loadEnvironment(db, 'workspace-not-found', environment._id)).toThrowError();
    });

    it('should throw error if multiple base env for workspace found', () => {
      db.Environment.push({ ...environment });
      expect(() => loadEnvironment(db, workspace._id, environment._id)).toThrowError();
    });

    it.each([generateIdIsh(subEnvironment), subEnvironment._id, subEnvironment.name])(
      'should return the sub environment if matched with id: %s',
      identifier => {
        expect(loadEnvironment(db, workspace._id, subEnvironment._id)).toBe(subEnvironment);
      },
    );

    it('should return the base environment if env id not specified', () => {
      expect(loadEnvironment(db, workspace._id)).toBe(environment);
    });

    it('should return the base environment if no sub envs exist', () => {
      db.Environment = [environment];
      expect(loadEnvironment(db, workspace._id, subEnvironment._id)).toBe(environment);
    });
  });
});
