import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { environment, project, request, requestGroup, workspace } from '../../models';
import { EnvironmentKvPairDataType } from '../../models/environment';
import * as importUtil from '../import';
import { generateId } from '../misc';

/*
@vitest-environment jsdom
*/

describe('isApiSpecImport()', () => {
  it.each(['swagger2', 'openapi3'])('should return true if spec id is %o', (id: string) => {
    expect(importUtil.isApiSpecImport({ id })).toBe(true);
  });

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
  it('should import a curl request to a new workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'curl', 'complex-input.sh');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const projectToImportTo = await project.create();

    const scanResult = await importUtil.scanResources([
      {
        contentStr: content,
      },
    ]);

    expect(scanResult[0].type?.id).toBe('curl');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToProject({
      projectId: projectToImportTo._id,
    });

    const workspacesCount = await workspace.count();
    const projectWorkspaces = await workspace.findByParentId(projectToImportTo._id);
    const curlRequests = await request.findByParentId(projectWorkspaces[0]._id);

    expect(workspacesCount).toBe(1);

    expect(curlRequests[0]).toMatchObject({
      body: {
        text: '{\"email_id\": \"tem_123\"}',
      },
    });
  });

  it('should import a curl request to an existing workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'curl', 'complex-input.sh');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();

    const scanResult = await importUtil.scanResources([
      {
        contentStr: content,
      },
    ]);

    expect(scanResult[0].type?.id).toBe('curl');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToWorkspace({
      workspaceId: existingWorkspace._id,
    });

    const curlRequests = await request.findByParentId(existingWorkspace._id);

    expect(curlRequests[0]).toMatchObject({
      body: {
        text: '{\"email_id\": \"tem_123\"}',
      },
    });
  });

  it('should import a postman collection to a new workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'postman', 'aws-signature-auth-v2_0-input.json');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();
    const projectToImportTo = await project.create();
    const scanResult = await importUtil.scanResources([
      {
        contentStr: content,
      },
    ]);

    expect(scanResult[0].type?.id).toBe('postman');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToProject({
      projectId: projectToImportTo._id,
    });

    const projectWorkspaces = await workspace.findByParentId(projectToImportTo._id);

    const requestGroups = await requestGroup.findByParentId(projectWorkspaces[0]._id);
    const requests = await request.findByParentId(requestGroups[0]._id);

    expect(requests[0]).toMatchObject({
      url: 'https://insomnia.rest',
    });
  });

  it('should import a postman collection to an existing workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'postman', 'aws-signature-auth-v2_0-input.json');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();

    const scanResult = await importUtil.scanResources([
      {
        contentStr: content,
      },
    ]);

    expect(scanResult[0].type?.id).toBe('postman');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToWorkspace({
      workspaceId: existingWorkspace._id,
    });

    const requestGroups = await requestGroup.findByParentId(existingWorkspace._id);
    const requests = await request.findByParentId(requestGroups[0]._id);

    expect(requests[0]).toMatchObject({
      url: 'https://insomnia.rest',
    });
  });

  it('should import an openapi collection to an existing workspace with scope design', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'openapi', 'endpoint-security-input.yaml');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();
    const disableLogs = console.log;
    console.log = () => {};
    const scanResult = await importUtil.scanResources([
      {
        contentStr: content,
      },
    ]);
    console.log = disableLogs;
    expect(scanResult[0].type?.id).toBe('openapi3');
    expect(scanResult[0].errors.length).toBe(0);
  });

  it('should import a postman collection variable to a collection base environment', async () => {
    const fixturePath = path.join(
      __dirname,
      '..',
      '__fixtures__',
      'postman',
      'collection-with-variable-v2_1-input.json',
    );
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const projectToImportTo = await project.create();
    const projectId = projectToImportTo._id;

    const scanResult = await importUtil.scanResources([
      {
        contentStr: content,
      },
    ]);

    expect(scanResult[0].type?.id).toBe('postman');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToProject({
      projectId: projectToImportTo._id,
    });

    const projectWorkspaces = await workspace.findByParentId(projectId);
    const importedWorkspaceId = projectWorkspaces[0]._id;
    const requestBaseEnvironment = await environment.getByParentId(importedWorkspaceId);

    expect(requestBaseEnvironment).toBeDefined();

    expect(requestBaseEnvironment!.data).toMatchObject({
      from: 'variable',
      foo: 'bar',
    });
  });

  it('should merge the json base environment from a postman collection variable when imported inside a workspace', async () => {
    const fixturePath = path.join(
      __dirname,
      '..',
      '__fixtures__',
      'postman',
      'collection-with-variable-v2_1-input.json',
    );
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();
    const workspaceId = existingWorkspace._id;
    const baseEnvironment = await environment.getOrCreateForParentId(workspaceId);
    await environment.update(baseEnvironment, {
      data: {
        existingVar: 'exists',
      },
    });

    const scanResult = await importUtil.scanResources([
      {
        contentStr: content,
      },
    ]);

    expect(scanResult[0].type?.id).toBe('postman');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToWorkspace({
      workspaceId: existingWorkspace._id,
    });

    const updatedBaseEnvironment = await environment.getByParentId(workspaceId);

    expect(updatedBaseEnvironment?.data).toMatchObject({
      existingVar: 'exists',
      from: 'variable',
      foo: 'bar',
    });
  });

  it('should override kv base environment from a postman collection variable when imported inside a workspace', async () => {
    const fixturePath = path.join(
      __dirname,
      '..',
      '__fixtures__',
      'postman',
      'collection-with-variable-v2_1-input.json',
    );
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();
    const workspaceId = existingWorkspace._id;
    const baseEnvironmentPair = [
      {
        id: generateId('envPair'),
        name: 'from',
        value: 'baseEnv',
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
      {
        id: generateId('envPair'),
        name: 'disabledItemKey',
        value: 'disabledItemValue',
        type: EnvironmentKvPairDataType.STRING,
        enabled: false,
      },
    ];
    const baseEnvironment = await environment.getOrCreateForParentId(workspaceId);
    await environment.update(baseEnvironment, {
      data: {
        from: 'baseEnv',
      },
      environmentType: environment.EnvironmentType.KVPAIR,
      kvPairData: baseEnvironmentPair,
    });

    const scanResult = await importUtil.scanResources([
      {
        contentStr: content,
      },
    ]);

    expect(scanResult[0].type?.id).toBe('postman');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToWorkspace({
      workspaceId: existingWorkspace._id,
    });

    const updatedBaseEnvironment = await environment.getByParentId(workspaceId);

    expect(updatedBaseEnvironment?.data).toMatchObject({
      from: 'variable',
      foo: 'bar',
    });
    const newKvPairData = updatedBaseEnvironment?.kvPairData || [];
    expect(newKvPairData.length).toBe(3);
    expect(newKvPairData.filter(pair => pair.enabled).length).toBe(2);
    expect(newKvPairData.find(pair => pair.name === 'from')?.value).toBe('variable');
    expect(newKvPairData.find(pair => pair.name === 'foo')?.value).toBe('bar');
  });

  it('should merge and discard same name variable in kv base environment from a postman collection variable when imported inside a workspace', async () => {
    const fixturePath = path.join(
      __dirname,
      '..',
      '__fixtures__',
      'postman',
      'collection-with-variable-v2_1-input.json',
    );
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await workspace.create();
    const workspaceId = existingWorkspace._id;
    const baseEnvironmentPair = [
      {
        id: generateId('envPair'),
        name: 'from',
        value: 'disabledValue',
        type: EnvironmentKvPairDataType.STRING,
        enabled: false,
      },
      {
        id: generateId('envPair'),
        name: 'from',
        value: 'baseEnv',
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
      {
        id: generateId('envPair'),
        name: 'disabledItemKey',
        value: 'disabledItemValue',
        type: EnvironmentKvPairDataType.STRING,
        enabled: false,
      },
    ];
    const baseEnvironment = await environment.getOrCreateForParentId(workspaceId);
    await environment.update(baseEnvironment, {
      data: {
        from: 'baseEnv',
      },
      environmentType: environment.EnvironmentType.KVPAIR,
      kvPairData: baseEnvironmentPair,
    });

    const scanResult = await importUtil.scanResources([
      {
        contentStr: content,
      },
    ]);

    expect(scanResult[0].type?.id).toBe('postman');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToWorkspace({
      workspaceId: existingWorkspace._id,
      overrideBaseEnvironmentData: false,
    });

    const updatedBaseEnvironment = await environment.getByParentId(workspaceId);

    expect(updatedBaseEnvironment?.data).toMatchObject({
      from: 'baseEnv',
      foo: 'bar',
    });
    const newKvPairData = updatedBaseEnvironment?.kvPairData || [];
    expect(newKvPairData.length).toBe(4);
    expect(newKvPairData.filter(pair => pair.enabled).length).toBe(2);
    expect(newKvPairData.filter(pair => !pair.enabled).length).toBe(2);
    expect(newKvPairData.find(pair => pair.name === 'from' && pair.enabled)?.value).toBe('baseEnv');
    expect(newKvPairData.find(pair => pair.name === 'foo')?.value).toBe('bar');
  });
});
