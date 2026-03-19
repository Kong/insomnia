import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { environment, project, request, requestGroup, workspace } from '../../models';
import { EnvironmentKvPairDataType } from '../../models/environment';
import * as importUtil from '../import';
import { generateId } from '../misc';

function pathPatternMatches(pattern: string, concretePath: string): boolean {
  if (!pattern || pattern.length > 200) {
    return false;
  }
  if (pattern === concretePath) {
    return true;
  }
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = concretePath.split('/').filter(Boolean);
  if (patternSegments.length > pathSegments.length) {
    return false;
  }
  const offset = pathSegments.length - patternSegments.length;
  const pathSuffix = pathSegments.slice(offset);
  return patternSegments.every((segment, i) => {
    if (segment.startsWith(':')) {
      return pathSuffix[i].length > 0;
    }
    return segment.toLowerCase() === pathSuffix[i].toLowerCase();
  });
}

describe('pathPatternMatches', () => {
  it('should match exact paths', () => {
    expect(pathPatternMatches('/users', '/users')).toBe(true);
    expect(pathPatternMatches('/users/list', '/users/list')).toBe(true);
  });

  it('should not match different paths', () => {
    expect(pathPatternMatches('/users', '/user')).toBe(false);
    expect(pathPatternMatches('/users', '/users/123')).toBe(false);
    expect(pathPatternMatches('/users/list', '/users')).toBe(false);
  });

  it('should match paths with path parameters', () => {
    expect(pathPatternMatches('/users/:id', '/users/123')).toBe(true);
    expect(pathPatternMatches('/users/:userId/orders/:orderId', '/users/abc/orders/xyz')).toBe(true);
    expect(pathPatternMatches('/api/:version/resource', '/api/v1/resource')).toBe(true);
  });

  it('should not match when path param is empty', () => {
    expect(pathPatternMatches('/users/:id', '/users/')).toBe(false);
    expect(pathPatternMatches('/users/:id', '/users')).toBe(false);
  });

  it('should be case insensitive for static segments', () => {
    expect(pathPatternMatches('/Users', '/users')).toBe(true);
    expect(pathPatternMatches('/USERS/LIST', '/users/list')).toBe(true);
    expect(pathPatternMatches('/api/v1', '/API/V1')).toBe(true);
  });

  it('should handle empty pattern', () => {
    expect(pathPatternMatches('', '/users')).toBe(false);
  });

  it('should reject patterns over 200 characters', () => {
    const longPattern = '/' + 'a'.repeat(200);
    expect(pathPatternMatches(longPattern, '/aaaa')).toBe(false);
  });

  it('should match paths with different segment counts (prefix matching)', () => {
    expect(pathPatternMatches('/basic', '/v1/basic')).toBe(true);
    expect(pathPatternMatches('/users', '/api/v1/users')).toBe(true);
    expect(pathPatternMatches('/key/header', '/v1/key/header')).toBe(true);
  });

  it('should handle leading slashes consistently', () => {
    expect(pathPatternMatches('users', 'users')).toBe(true);
    expect(pathPatternMatches('users', '/users')).toBe(true);
    expect(pathPatternMatches('/users', 'users')).toBe(true);
  });
});

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

  it('should find existing request by method and url matching OpenAPI path params', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'openapi', 'endpoint-security-input.yaml');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const projectToImportTo = await project.create();

    const scanResult = await importUtil.scanResources([
      {
        contentStr: content,
      },
    ]);

    expect(scanResult[0].type?.id).toBe('openapi3');
    expect(scanResult[0].errors.length).toBe(0);

    await importUtil.importResourcesToProject({
      projectId: projectToImportTo._id,
    });

    const workspaces = await workspace.findByParentId(projectToImportTo._id);
    expect(workspaces).toHaveLength(1);
    const requests = await request.findByParentId(workspaces[0]._id);
    expect(requests.length).toBeGreaterThan(0);

    const result = await importUtil.findExistingRequestByMethodAndUrl(
      projectToImportTo._id,
      'GET',
      'https://api.server.test/v1/key/header',
    );
    expect(result).toBeDefined();
    expect(result?.request.url).toContain('/key/header');
  });

  it('should find existing request by method and url with path parameters', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'openapi', 'endpoint-security-input.yaml');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const projectToImportTo = await project.create();

    await importUtil.scanResources([{ contentStr: content }]);
    await importUtil.importResourcesToProject({ projectId: projectToImportTo._id });

    const workspaces = await workspace.findByParentId(projectToImportTo._id);
    const requests = await request.findByParentId(workspaces[0]._id);

    const result = await importUtil.findExistingRequestByMethodAndUrl(
      projectToImportTo._id,
      'GET',
      'https://api.server.test/v1/basic',
    );
    expect(result).toBeDefined();
    expect(result?.request.method).toBe('GET');
  });

  it('should return undefined when no matching request found', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'openapi', 'endpoint-security-input.yaml');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const projectToImportTo = await project.create();

    await importUtil.scanResources([{ contentStr: content }]);
    await importUtil.importResourcesToProject({ projectId: projectToImportTo._id });

    const result = await importUtil.findExistingRequestByMethodAndUrl(
      projectToImportTo._id,
      'POST',
      'https://api.server.test/v1/none',
    );
    expect(result).toBeUndefined();
  });

  it('should resolve operationId to method and name', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'openapi', 'smoke-test-with-operationIds.yaml');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    await importUtil.scanResources([{ contentStr: content }]);

    const result = importUtil.resolveOperationId('echoId');
    expect(result).toBeDefined();
    expect(result?.method).toBe('get');
    expect(result?.name).toBe('Echo id');
  });

  it('should resolve operationId with path parameters in path', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'openapi', 'smoke-test-with-operationIds.yaml');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    await importUtil.scanResources([{ contentStr: content }]);

    const result = importUtil.resolveOperationId('delayByDuration');
    expect(result).toBeDefined();
    expect(result?.method).toBe('get');
    expect(result?.name).toBe('Delay by seconds');
  });

  it('should return undefined for non-existent operationId', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'openapi', 'smoke-test-with-operationIds.yaml');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    await importUtil.scanResources([{ contentStr: content }]);

    const result = importUtil.resolveOperationId('nonExistentOpId');
    expect(result).toBeUndefined();
  });
});
