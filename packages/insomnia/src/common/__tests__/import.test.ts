import { beforeEach, describe, expect, it, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';

import { globalBeforeEach } from '../../__jest__/before-each';
import { request, requestGroup, workspace, environment } from '../../models';
import { DEFAULT_PROJECT_ID } from '../../models/project';
import * as importUtil from '../import';

describe('isApiSpecImport()', () => {
  it.each(['swagger2', 'openapi3'])(
    'should return true if spec id is %o',
    (id: string) => {
      expect(importUtil.isApiSpecImport({ id })).toBe(true);
    }
  );

  it('should return false if spec id is not valid', () => {
    const id = 'invalid-id';
    expect(importUtil.isApiSpecImport({ id })).toBe(false);
  });
});

describe('isInsomniaV4Import()', () => {
  it.each(['insomnia-4'])('should return true if spec id is %o', (id: string) => {
    expect(importUtil.isInsomniaV4Import({ id })).toBe(true);
  });

  it('should return false if spec id is not valid', () => {
    const id = 'invalid-id';
    expect(importUtil.isInsomniaV4Import({ id })).toBe(false);
  });
});

describe('importRaw()', () => {
  beforeEach(globalBeforeEach);

  it('should import a curl request to a new workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'curl', 'complex-input.sh');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const scanResult = await importUtil.scanResources({
      content,
    });

    expect(scanResult.type.id).toBe('curl');
    expect(scanResult.errors.length).toBe(0);

    await importUtil.importResourcesToProject({
      projectId: DEFAULT_PROJECT_ID,
    });

    const workspacesCount = await workspace.count();
    const projectWorkspaces = await workspace.findByParentId(
      DEFAULT_PROJECT_ID
    );
    const curlRequests = await request.findByParentId(projectWorkspaces[0]._id);

    expect(workspacesCount).toBe(1);

    expect(curlRequests[0]).toMatchObject({
      body: {
        'text': '{\"email_id\": \"tem_123\"}',
      },
    });
  });

  it('should import a curl request to an existing workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'curl', 'complex-input.sh');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();

    const scanResult = await importUtil.scanResources({
      content,
    });

    expect(scanResult.type?.id).toBe('curl');
    expect(scanResult.errors.length).toBe(0);

    await importUtil.importResourcesToWorkspace({
      workspaceId: existingWorkspace._id,
    });

    const workspacesCount = await workspace.count();
    expect(workspacesCount).toBe(1);

    const curlRequests = await request.findByParentId(existingWorkspace._id);

    expect(curlRequests[0]).toMatchObject({
      body: {
        'text': '{\"email_id\": \"tem_123\"}',
      },
    });
  });

  it('should import a postman collection to a new workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'postman', 'aws-signature-auth-v2_0-input.json');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const scanResult = await importUtil.scanResources({
      content,
    });

    expect(scanResult.type.id).toBe('postman');
    expect(scanResult.errors.length).toBe(0);

    await importUtil.importResourcesToProject({
      projectId: DEFAULT_PROJECT_ID,
    });

    const workspacesCount = await workspace.count();
    const projectWorkspaces = await workspace.findByParentId(
      DEFAULT_PROJECT_ID
    );

    const requestGroups = await requestGroup.findByParentId(projectWorkspaces[0]._id);
    const requests = await request.findByParentId(requestGroups[0]._id);

    expect(workspacesCount).toBe(1);

    expect(requests[0]).toMatchObject({
      url: 'https://insomnia.rest',
    });
  });

  it('should import a postman collection to an existing workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'postman', 'aws-signature-auth-v2_0-input.json');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();

    const scanResult = await importUtil.scanResources({
      content,
    });

    expect(scanResult.type?.id).toBe('postman');
    expect(scanResult.errors.length).toBe(0);

    await importUtil.importResourcesToWorkspace({
      workspaceId: existingWorkspace._id,
    });

    const workspacesCount = await workspace.count();

    const requestGroups = await requestGroup.findByParentId(existingWorkspace._id);
    const requests = await request.findByParentId(requestGroups[0]._id);

    expect(workspacesCount).toBe(1);

    expect(requests[0]).toMatchObject({
      url: 'https://insomnia.rest',
    });
  });

  it('should import an openapi collection to an existing workspace with scope design', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'openapi', 'endpoint-security-input.yaml');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create({ scope: 'design' });

    const scanResult = await importUtil.scanResources({
      content,
    });

    expect(scanResult.type?.id).toBe('openapi3');
    expect(scanResult.errors.length).toBe(0);

    await importUtil.importResourcesToWorkspace({
      workspaceId: existingWorkspace._id,
    });

    const workspacesCount = await workspace.count();

    expect(workspacesCount).toBe(1);

    const requests = await request.findByParentId(existingWorkspace._id);
    expect(requests.length).toBe(12);
  });

});

describe('syncToWorkspaceRaw()', () => {
  beforeEach(globalBeforeEach);
  const fixtures = ['basic-import.json', 'placeholders-import.json'];

  test.each(fixtures)('should syncronize insomnia collection to an existing workspace (%s)', async (fixture) => {
    // arrange
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'insomnia', fixture);
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();
    const existingBaseEnvironment = await environment.create({ parentId: existingWorkspace._id, name: 'Base Environment' });
    //TODO: add sub environment
    const existsRequestGroup = await requestGroup.create({ parentId: existingWorkspace._id, name: 'Request Group 1' });
    const request1 = await request.create({ parentId: existsRequestGroup._id, name: 'Request 1', url: 'https://insomnia.rest/api/tests/1' });
    const request2 = await request.create({ parentId: existsRequestGroup._id, name: 'Request 2', url: 'https://insomnia.rest/api/tests/2' });

    expect((await workspace.all()).length).toBe(1);
    expect((await environment.all()).length).toBe(1);
    expect((await requestGroup.all()).length).toBe(1);
    expect((await request.all()).length).toBe(2);

    // act
    const scanResult = await importUtil.scanResources({
      content,
    });

    expect(scanResult.type?.id).toBe('insomnia-4');
    expect(scanResult.errors.length).toBe(0);

    await importUtil.syncResourcesToWorkspace({
      workspaceId: existingWorkspace._id,
    });

    // assert
    const workspacesCount = await workspace.count();
    expect(workspacesCount).toBe(1);

    const environments = await environment.all();
    const requestGroups = await requestGroup.all();
    const requests = await request.all();

    // expected environments
    expect(environments.length).toBe(2);
    [existingBaseEnvironment._id, existingBaseEnvironment._id].every(expectedid =>
      expect(environments.find(environment => environment._id === expectedid)));

    // expected request groups
    expect(requestGroups.length).toBe(1);
    expect(requestGroups[0].parentId).toBe(existingWorkspace._id);

    // expected requests with specific parents
    expect(requests.length).toBe(3);
    const requestParentIds = requests.map(r => r.parentId).filter((v, i, a) => a.indexOf(v) === i);
    expect(requestParentIds.length).toBe(2);
    expect(requestParentIds).toContain(existsRequestGroup._id);
    expect(requestParentIds).toContain(existingWorkspace._id);

    // all requests should be pointed to expected urls
    [
      { id: 'req_imported_1', url: 'https://insomnia.rest/api/tests/0' },
      { id: request1._id, url: request1.url },
      { id: request2._id, url: request2.url },
    ].forEach(expected => {
      expect(requests.find(request => request._id === expected.id)).toMatchObject({
        url: expected.url,
      });
    });
  });

  test.each(fixtures)('should syncronize insomnia collection to empty workspace (%s)', async (fixture) => {
    // arrange
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'insomnia', fixture);
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();
    const existingBaseEnvironment = await environment.create({ parentId: existingWorkspace._id, name: 'Base Environment' });

    expect((await workspace.all()).length).toBe(1);
    expect((await environment.all()).length).toBe(1);
    expect((await requestGroup.all()).length).toBe(0);
    expect((await request.all()).length).toBe(0);

    // act
    const scanResult = await importUtil.scanResources({
      content,
    });

    expect(scanResult.type?.id).toBe('insomnia-4');
    expect(scanResult.errors.length).toBe(0);

    await importUtil.syncResourcesToWorkspace({
      workspaceId: existingWorkspace._id,
    });

    // assert
    const workspacesCount = await workspace.count();
    expect(workspacesCount).toBe(1);

    const environments = await environment.all();
    const requestGroups = await requestGroup.all();
    const requests = await request.all();

    // expected environments
    expect(environments.length).toBe(2);
    [existingBaseEnvironment._id, existingBaseEnvironment._id].every(expectedid =>
      expect(environments.find(environment => environment._id === expectedid)));

    // no request groups should be created 
    expect(requestGroups.length).toBe(0);

    // expected one specific request
    expect(requests.length).toBe(1);
    expect(requests[0].parentId).toBe(existingWorkspace._id);
    expect(requests[0]).toMatchObject({
      url: 'https://insomnia.rest/api/tests/0',
    });
  });

  test.each(fixtures)('should not syncronize insomnia collection to workspace not exists (%s)', async (fixture) => {
    // arrange
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'insomnia', fixture);
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();
    await environment.create({ parentId: existingWorkspace._id, name: 'Base Environment' });

    expect((await workspace.all()).length).toBe(1);
    expect((await environment.all()).length).toBe(1);

    // act & assert
    const scanResult = await importUtil.scanResources({
      content,
    });

    expect(scanResult.type?.id).toBe('insomnia-4');
    expect(scanResult.errors.length).toBe(0);

    expect(async () => {
      await importUtil.syncResourcesToWorkspace({
        workspaceId: existingWorkspace._id + '_not_exists',
      });
    }).rejects
      .toThrow("Could not find workspace");
  });

  test.each(fixtures)('should not syncronize insomnia collection to workspace without base environment (%s)', async (fixture) => {
    // arrange
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'insomnia', fixture);
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();

    expect((await workspace.all()).length).toBe(1);
    expect((await environment.all()).length).toBe(0);

    // act & assert
    const scanResult = await importUtil.scanResources({
      content,
    });

    expect(scanResult.type?.id).toBe('insomnia-4');
    expect(scanResult.errors.length).toBe(0);

    expect(async () => {
      await importUtil.syncResourcesToWorkspace({
        workspaceId: existingWorkspace._id,
      });
    }).rejects
      .toThrow("Could not find base environment");
  });
});
