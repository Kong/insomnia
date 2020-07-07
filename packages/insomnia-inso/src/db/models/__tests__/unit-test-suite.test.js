// @flow
import type { Database } from '../../index';
import { emptyDb } from '../../index';
import type { ApiSpec, UnitTestSuite, Workspace } from '../types';
import enquirer from 'enquirer';
import { generateIdIsh } from '../util';
import { loadTestSuites, promptTestSuites } from '../unit-test-suite';

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
