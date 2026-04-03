/**
 * Tests for NeDB Client functionality
 *
 * This test suite covers all the functions we added comments to in ne-db-client.ts,
 * ensuring the file system client works correctly with Git operations.
 */

import path from 'node:path';

import { createBuilder } from '@develohpanda/fluent-builder';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import YAML from 'yaml';

import { services } from '~/insomnia-data';

import { database as db } from '../../../common/database';
import * as models from '../../../models';
import { workspaceModelSchema } from '../../../models/__schemas__/model-schemas';
import { GIT_CLONE_DIR, GIT_INSOMNIA_DIR, GIT_INSOMNIA_DIR_NAME } from '../git-vcs';
import { NeDBClient } from '../ne-db-client';
import { assertAsyncError } from './util';

const workspaceBuilder = createBuilder(workspaceModelSchema);

// @vitest-environment jsdom
describe('NeDBClient', () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    workspaceBuilder.reset();
    vi.useFakeTimers();
    await db.init({ inMemoryOnly: true }, true);

    // Create test project
    await services.project.create({
      _id: 'proj_test',
      name: 'Test Project',
    });

    // Create test workspace
    await services.workspace.create({
      _id: 'wrk_test',
      name: 'Test Workspace',
      parentId: 'proj_test',
      scope: 'collection',
    });

    // Create test requests
    await models.request.create({
      _id: 'req_test_1',
      name: 'Test Request 1',
      parentId: 'wrk_test',
      url: 'https://api.example.com/test1',
      method: 'GET',
      metaSortKey: 0,
    });

    await models.request.create({
      _id: 'req_test_2',
      name: 'Test Request 2',
      parentId: 'wrk_test',
      url: 'https://api.example.com/test2',
      method: 'POST',
      metaSortKey: 1,
    });

    // Create private request (should not be accessible)
    await models.request.create({
      _id: 'req_private',
      name: 'Private Request',
      parentId: 'wrk_test',
      isPrivate: true,
      url: 'https://api.example.com/private',
      method: 'GET',
      metaSortKey: 2,
    });

    // Create environment
    await services.environment.create({
      _id: 'env_test',
      name: 'Test Environment',
      parentId: 'wrk_test',
      data: {
        api_url: 'https://api.example.com',
        api_key: 'test-key',
      },
    });
  });

  describe('readFile()', () => {
    it('should read workspace file correctly', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const workspacePath = path.join(GIT_INSOMNIA_DIR, models.workspace.type, 'wrk_test.yml');

      const result = (await neDbClient.readFile(workspacePath, 'utf8')).toString();
      const parsed = YAML.parse(result);

      expect(parsed).toMatchObject({
        _id: 'wrk_test',
        name: 'Test Workspace',
        type: 'Workspace',
        parentId: null, // Should be reset to null for Git operations
      });
    });

    it('should read request file correctly', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const requestPath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_test_1.yml');

      const result = (await neDbClient.readFile(requestPath, 'utf8')).toString();
      const parsed = YAML.parse(result);

      expect(parsed).toMatchObject({
        _id: 'req_test_1',
        name: 'Test Request 1',
        type: 'Request',
        url: 'https://api.example.com/test1',
        method: 'GET',
        parentId: 'wrk_test',
      });
    });

    it('should read environment file correctly', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const envPath = path.join(GIT_INSOMNIA_DIR, models.environment.type, 'env_test.yml');

      const result = (await neDbClient.readFile(envPath, 'utf8')).toString();
      const parsed = YAML.parse(result);

      expect(parsed).toMatchObject({
        _id: 'env_test',
        name: 'Test Environment',
        type: 'Environment',
        parentId: 'wrk_test',
        data: {
          api_url: 'https://api.example.com',
          api_key: 'test-key',
        },
      });
    });

    it('should return Buffer when no encoding specified', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const requestPath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_test_1.yml');

      const result = await neDbClient.readFile(requestPath);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString('utf8')).toContain('req_test_1');
    });

    it('should handle string encoding option', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const requestPath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_test_1.yml');

      const result = await neDbClient.readFile(requestPath, 'utf8');

      expect(typeof result).toBe('string');
      expect(result).toContain('req_test_1');
    });

    it('should handle object encoding option', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const requestPath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_test_1.yml');

      const result = await neDbClient.readFile(requestPath, { encoding: 'utf8' });

      expect(typeof result).toBe('string');
      expect(result).toContain('req_test_1');
    });

    it('should throw error for non-existent file', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const nonExistentPath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'non_existent.yml');

      await assertAsyncError(neDbClient.readFile(nonExistentPath));
    });

    it('should throw error for private documents', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const privatePath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_private.yml');

      await assertAsyncError(neDbClient.readFile(privatePath));
    });

    it('should throw error for invalid file paths', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      // Test with invalid path structure
      await assertAsyncError(neDbClient.readFile('invalid/path'));
      await assertAsyncError(neDbClient.readFile('.insomnia/invalid'));
      await assertAsyncError(neDbClient.readFile('.insomnia/Request/'));
    });
  });

  describe('writeFile()', () => {
    it('should write valid request data to database', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const updateSpy = vi.spyOn(db, 'update');

      const requestData = {
        _id: 'req_new',
        type: models.request.type,
        name: 'New Request',
        parentId: 'wrk_test',
        url: 'https://api.example.com/new',
        method: 'PUT',
      };

      const filePath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_new.yml');

      await neDbClient.writeFile(filePath, YAML.stringify(requestData));

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith(requestData);

      updateSpy.mockRestore();
    });

    it('should write valid environment data to database', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const updateSpy = vi.spyOn(db, 'update');

      const envData = {
        _id: 'env_new',
        type: models.environment.type,
        name: 'New Environment',
        parentId: 'wrk_test',
        data: { new_var: 'new_value' },
      };

      const filePath = path.join(GIT_INSOMNIA_DIR, models.environment.type, 'env_new.yml');

      await neDbClient.writeFile(filePath, YAML.stringify(envData));

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith(envData);

      updateSpy.mockRestore();
    });

    it('should handle workspace parentId correction', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const updateSpy = vi.spyOn(db, 'update');

      const workspaceData = {
        _id: 'wrk_new',
        type: models.workspace.type,
        name: 'New Workspace',
        parentId: null, // This should be corrected to proj_test
        scope: 'collection',
      };

      const filePath = path.join(GIT_INSOMNIA_DIR, models.workspace.type, 'wrk_new.yml');

      await neDbClient.writeFile(filePath, YAML.stringify(workspaceData));

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 'wrk_new',
          parentId: 'proj_test', // Should be corrected
        }),
      );

      updateSpy.mockRestore();
    });

    it('should ignore files outside GIT_INSOMNIA_DIR', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const updateSpy = vi.spyOn(db, 'update');

      const requestData = {
        _id: 'req_external',
        type: models.request.type,
        name: 'External Request',
        parentId: 'wrk_test',
      };

      const filePath = path.join('external', models.request.type, 'req_external.yml');

      await neDbClient.writeFile(filePath, YAML.stringify(requestData));

      expect(updateSpy).not.toHaveBeenCalled();

      updateSpy.mockRestore();
    });

    it('should skip files with conflict markers', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const updateSpy = vi.spyOn(db, 'update');

      const conflictedData = `
_id: req_conflict
type: Request
name: Conflicted Request
parentId: wrk_test
=======
_id: req_conflict
type: Request
name: Conflicted Request Modified
parentId: wrk_test
`;

      const filePath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_conflict.yml');

      await neDbClient.writeFile(filePath, conflictedData);

      expect(updateSpy).not.toHaveBeenCalled();

      updateSpy.mockRestore();
    });

    it('should throw error for ID mismatch', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      const requestData = {
        _id: 'req_mismatch',
        type: models.request.type,
        name: 'Mismatch Request',
        parentId: 'wrk_test',
      };

      const filePath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'different_id.yml');

      await expect(neDbClient.writeFile(filePath, YAML.stringify(requestData))).rejects.toThrow(
        'Doc _id does not match file path',
      );
    });

    it('should throw error for type mismatch', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      const requestData = {
        _id: 'req_type_mismatch',
        type: models.request.type,
        name: 'Type Mismatch Request',
        parentId: 'wrk_test',
      };

      const filePath = path.join(GIT_INSOMNIA_DIR, models.environment.type, 'req_type_mismatch.yml');

      await expect(neDbClient.writeFile(filePath, YAML.stringify(requestData))).rejects.toThrow(
        'Doc type does not match file path',
      );
    });

    it('should handle malformed YAML gracefully', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      const malformedYaml = `
_id: req_malformed
type: Request
name: Malformed Request
invalid: [unclosed array
`;

      const filePath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_malformed.yml');

      await expect(neDbClient.writeFile(filePath, malformedYaml)).rejects.toThrow();
    });
  });

  describe('readdir()', () => {
    it('should list root directory correctly', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      const result = await neDbClient.readdir(GIT_CLONE_DIR);

      expect(result).toEqual([GIT_INSOMNIA_DIR_NAME]);
    });

    it('should list .insomnia directory with all model types', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      const result = await neDbClient.readdir(GIT_INSOMNIA_DIR);

      expect(result).toContain(models.workspace.type);
      expect(result).toContain(models.request.type);
      expect(result).toContain(models.environment.type);
      expect(result).toContain(models.apiSpec.type);
      expect(result).toContain(models.grpcRequest.type);
      expect(result).toContain(models.webSocketRequest.type);
      expect(result).toContain(models.socketIORequest.type);
    });

    it('should list request files correctly', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const requestDir = path.join(GIT_INSOMNIA_DIR, models.request.type);

      const result = await neDbClient.readdir(requestDir);

      expect(result).toContain('req_test_1.yml');
      expect(result).toContain('req_test_2.yml');
      expect(result).not.toContain('req_private.yml'); // Private files should be excluded
    });

    it('should list workspace files correctly', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const workspaceDir = path.join(GIT_INSOMNIA_DIR, models.workspace.type);

      const result = await neDbClient.readdir(workspaceDir);

      expect(result).toContain('wrk_test.yml');
    });

    it('should list environment files correctly', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const envDir = path.join(GIT_INSOMNIA_DIR, models.environment.type);

      const result = await neDbClient.readdir(envDir);

      expect(result).toContain('env_test.yml');
    });

    it('should handle empty directories', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const emptyDir = path.join(GIT_INSOMNIA_DIR, models.mockServer.type);

      const result = await neDbClient.readdir(emptyDir);

      expect(result).toEqual([]);
    });
  });

  describe('stat()', () => {
    it('should stat directories correctly', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      const rootStat = await neDbClient.stat(GIT_CLONE_DIR);
      expect(rootStat.type).toBe('dir');

      const insomniaStat = await neDbClient.stat(GIT_INSOMNIA_DIR);
      expect(insomniaStat.type).toBe('dir');

      const requestDirStat = await neDbClient.stat(path.join(GIT_INSOMNIA_DIR, models.request.type));
      expect(requestDirStat.type).toBe('dir');
    });

    it('should stat files correctly', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      const workspaceFileStat = await neDbClient.stat(
        path.join(GIT_INSOMNIA_DIR, models.workspace.type, 'wrk_test.yml'),
      );
      expect(workspaceFileStat.type).toBe('file');
      expect(workspaceFileStat.size).toBeGreaterThan(0);

      const requestFileStat = await neDbClient.stat(path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_test_1.yml'));
      expect(requestFileStat.type).toBe('file');
      expect(requestFileStat.size).toBeGreaterThan(0);
    });

    it('should throw error for non-existent files', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      await assertAsyncError(neDbClient.stat(path.join(GIT_INSOMNIA_DIR, models.request.type, 'non_existent.yml')));
    });
  });

  describe('unlink()', () => {
    it('should remove existing documents', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const unsafeRemoveSpy = vi.spyOn(db, 'unsafeRemove');

      const filePath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_test_1.yml');

      await neDbClient.unlink(filePath);

      expect(unsafeRemoveSpy).toHaveBeenCalledTimes(1);

      unsafeRemoveSpy.mockRestore();
    });

    it('should handle non-existent files gracefully', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const unsafeRemoveSpy = vi.spyOn(db, 'unsafeRemove');

      const filePath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'non_existent.yml');

      await neDbClient.unlink(filePath);

      expect(unsafeRemoveSpy).not.toHaveBeenCalled();

      unsafeRemoveSpy.mockRestore();
    });

    it('should throw error for invalid file paths', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      await expect(neDbClient.unlink('invalid/path')).rejects.toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle mkdir() operation', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      await expect(neDbClient.mkdir()).rejects.toThrow('NeDBClient is not writable');
    });

    it('should handle rmdir() operation', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      // Should not throw error
      await expect(neDbClient.rmdir()).resolves.toBeUndefined();
    });

    it('should handle symlink() operation', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      await expect(neDbClient.symlink()).rejects.toThrow('NeDBClient symlink not supported');
    });

    it('should handle readlink() operation', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const requestPath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_test_1.yml');

      const result = await neDbClient.readlink(requestPath);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle lstat() operation', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const requestPath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_test_1.yml');

      const result = await neDbClient.lstat(requestPath);

      expect(result.type).toBe('file');
    });

    it('should create proper error messages', () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');
      const error = neDbClient._errMissing('/test/path');

      expect(error.message).toContain('ENOENT');
      expect(error.message).toContain('/test/path');
      expect(error.errno).toBe(-2);
      expect(error.code).toBe('ENOENT');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete read-write cycle', async () => {
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      // Create new request data
      const newRequest = {
        _id: 'req_integration',
        type: models.request.type,
        name: 'Integration Test Request',
        parentId: 'wrk_test',
        url: 'https://api.example.com/integration',
        method: 'PATCH',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        metaSortKey: 10,
      };

      const filePath = path.join(GIT_INSOMNIA_DIR, models.request.type, 'req_integration.yml');

      // Write the request
      await neDbClient.writeFile(filePath, YAML.stringify(newRequest));

      // Read it back
      const readResult = (await neDbClient.readFile(filePath)).toString();
      const parsed = YAML.parse(readResult);
      expect(parsed).toMatchObject(newRequest);

      // Verify it's listed in directory
      const dirResult = await neDbClient.readdir(path.join(GIT_INSOMNIA_DIR, models.request.type));
      expect(dirResult).toContain('req_integration.yml');

      // Verify stat works
      const statResult = await neDbClient.stat(filePath);
      expect(statResult.type).toBe('file');
      expect(statResult.size).toBeGreaterThan(0);
    });

    it('should handle workspace parentId correction in complete cycle', async () => {
      const updateSpy = vi.spyOn(db, 'update');
      const neDbClient = new NeDBClient('wrk_test', 'proj_test');

      // Create workspace data with null parentId (as it would come from Git)
      const workspaceData = {
        _id: 'wrk_integration',
        type: models.workspace.type,
        name: 'Integration Workspace',
        parentId: null,
        scope: 'collection',
        created: Date.now(),
        modified: Date.now(),
      };

      const filePath = path.join(GIT_INSOMNIA_DIR, models.workspace.type, 'wrk_integration.yml');

      // Write the workspace - this should correct the parentId
      await neDbClient.writeFile(filePath, YAML.stringify(workspaceData));

      // Verify that db.update was called with corrected parentId
      expect(updateSpy).toHaveBeenCalledTimes(1);
      const updateCall = updateSpy.mock.calls[0][0];
      expect(updateCall.parentId).toBe('proj_test'); // Should be corrected
      expect(updateCall._id).toBe('wrk_integration');
      expect(updateCall.name).toBe('Integration Workspace');

      // Cleanup
      updateSpy.mockRestore();
    });
  });
});
