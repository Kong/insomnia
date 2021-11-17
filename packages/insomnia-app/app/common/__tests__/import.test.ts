import fs from 'fs';
import path from 'path';

import { globalBeforeEach } from '../../__jest__/before-each';
import { apiSpec, request, requestGroup, workspace } from '../../models';
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
    const rawFixture = fs.readFileSync(fixturePath, 'utf8').toString();

    const importConfig: importUtil.ImportRawConfig = {
      getWorkspaceId: () => null,
      getProjectId: async () => DEFAULT_PROJECT_ID,
      getWorkspaceScope: () => 'design',
    };

    const { source, error } = await importUtil.importRaw(
      rawFixture,
      importConfig
    );

    const workspacesCount = await workspace.count();
    const projectWorkspaces = await workspace.findByParentId(
      DEFAULT_PROJECT_ID
    );

    const curlRequests = await request.findByParentId(projectWorkspaces[0]._id);

    expect(source).toBe('curl');
    expect(error).toBe(null);

    expect(workspacesCount).toBe(1);

    expect(curlRequests[0]).toMatchObject({
      body: {
        'text': '{\"email_id\": \"tem_123\"}',
      },
    });
  });

  it('should import a curl request to an existing workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'curl', 'complex-input.sh');
    const rawFixture = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();

    const importConfig: importUtil.ImportRawConfig = {
      getWorkspaceId: () => existingWorkspace._id,
      getProjectId: async () => DEFAULT_PROJECT_ID,
      getWorkspaceScope: () => 'design',
    };

    const { source, error } = await importUtil.importRaw(
      rawFixture,
      importConfig
    );

    const workspacesCount = await workspace.count();

    const curlRequests = await request.findByParentId(existingWorkspace._id);

    expect(source).toBe('curl');
    expect(error).toBe(null);

    expect(workspacesCount).toBe(1);

    expect(curlRequests[0]).toMatchObject({
      body: {
        'text': '{\"email_id\": \"tem_123\"}',
      },
    });
  });

  it('should import a postman collection to a new workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'postman', 'aws-signature-auth-v2_0-input.json');
    const rawFixture = fs.readFileSync(fixturePath, 'utf8').toString();

    const importConfig: importUtil.ImportRawConfig = {
      getWorkspaceId: () => null,
      getProjectId: async () => DEFAULT_PROJECT_ID,
      getWorkspaceScope: () => 'design',
    };

    const { source, error } = await importUtil.importRaw(
      rawFixture,
      importConfig
    );

    const workspacesCount = await workspace.count();
    const projectWorkspaces = await workspace.findByParentId(
      DEFAULT_PROJECT_ID
    );

    const requestGroups = await requestGroup.findByParentId(projectWorkspaces[0]._id);
    const requests = await request.findByParentId(requestGroups[0]._id);

    expect(source).toBe('postman');
    expect(error).toBe(null);

    expect(workspacesCount).toBe(1);

    expect(requests[0]).toMatchObject({
      url: 'https://insomnia.rest',
    });
  });

  it('should import a postman collection to an existing workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'postman', 'aws-signature-auth-v2_0-input.json');
    const rawFixture = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();

    const importConfig: importUtil.ImportRawConfig = {
      getWorkspaceId: () => existingWorkspace._id,
      getProjectId: async () => DEFAULT_PROJECT_ID,
      getWorkspaceScope: () => 'design',
    };

    const { source, error } = await importUtil.importRaw(
      rawFixture,
      importConfig
    );

    const workspacesCount = await workspace.count();

    const requestGroups = await requestGroup.findByParentId(existingWorkspace._id);
    const requests = await request.findByParentId(requestGroups[0]._id);

    expect(source).toBe('postman');
    expect(error).toBe(null);

    expect(workspacesCount).toBe(1);

    expect(requests[0]).toMatchObject({
      url: 'https://insomnia.rest',
    });
  });

  it('should import an openapi collection to an existing workspace with scope design', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'openapi', 'endpoint-security-input.yaml');
    const rawFixture = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create({ scope: 'design' });

    const importConfig: importUtil.ImportRawConfig = {
      getWorkspaceId: () => existingWorkspace._id,
      getProjectId: async () => DEFAULT_PROJECT_ID,
      getWorkspaceScope: () => 'design',
    };

    const { source, error } = await importUtil.importRaw(
      rawFixture,
      importConfig
    );

    expect(source).toBe('openapi3');
    expect(error).toBe(null);

    const workspacesCount = await workspace.count();

    expect(workspacesCount).toBe(1);

    const requests = await request.findByParentId(existingWorkspace._id);
    expect(requests.length).toBe(12);

    const createdApiSpec = await apiSpec.getByParentId(existingWorkspace._id);

    expect(createdApiSpec?.contents).toContain('openapi: \'3.0.2\'');
  });
});
