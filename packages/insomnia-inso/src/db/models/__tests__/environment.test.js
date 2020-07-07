// @flow
import type { Database } from '../../index';
import { emptyDb } from '../../index';
import type { Environment, Workspace } from '../types';
import { generateIdIsh } from '../util';
import enquirer from 'enquirer';
import { loadEnvironment, promptEnvironment } from '../environment';

jest.mock('enquirer');

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
