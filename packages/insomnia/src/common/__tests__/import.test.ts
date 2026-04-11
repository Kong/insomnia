import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { EnvironmentKvPairDataType, EnvironmentType, services } from '~/insomnia-data';

import * as importUtil from '../import';
import { INSOMNIA_SCHEMA_VERSION } from '../insomnia-schema-migrations/schema-version';
import { tryImportV5Data } from '../insomnia-v5';
import { generateId } from '../misc';

describe('pathPatternMatches', () => {
  it('should match exact paths', () => {
    expect(importUtil.pathPatternMatches('/users', '/users')).toBe(true);
    expect(importUtil.pathPatternMatches('/users/list', '/users/list')).toBe(true);
  });

  it('should not match different paths', () => {
    expect(importUtil.pathPatternMatches('/users', '/user')).toBe(false);
    expect(importUtil.pathPatternMatches('/users', '/users/123')).toBe(false);
    expect(importUtil.pathPatternMatches('/users/list', '/users')).toBe(false);
  });

  it('should match paths with path parameters', () => {
    expect(importUtil.pathPatternMatches('/users/:id', '/users/123')).toBe(true);
    expect(importUtil.pathPatternMatches('/users/:userId/orders/:orderId', '/users/abc/orders/xyz')).toBe(true);
    expect(importUtil.pathPatternMatches('/api/:version/resource', '/api/v1/resource')).toBe(true);
  });

  it('should not match when path param is empty', () => {
    expect(importUtil.pathPatternMatches('/users/:id', '/users/')).toBe(false);
    expect(importUtil.pathPatternMatches('/users/:id', '/users')).toBe(false);
  });

  it('should be case insensitive for static segments', () => {
    expect(importUtil.pathPatternMatches('/Users', '/users')).toBe(true);
    expect(importUtil.pathPatternMatches('/USERS/LIST', '/users/list')).toBe(true);
    expect(importUtil.pathPatternMatches('/api/v1', '/API/V1')).toBe(true);
  });

  it('should handle empty pattern', () => {
    expect(importUtil.pathPatternMatches('', '/users')).toBe(false);
  });

  it('should reject patterns over 200 characters', () => {
    const longPattern = '/' + 'a'.repeat(200);
    expect(importUtil.pathPatternMatches(longPattern, '/aaaa')).toBe(false);
  });

  it('should match paths with different segment counts (prefix matching)', () => {
    expect(importUtil.pathPatternMatches('/basic', '/v1/basic')).toBe(true);
    expect(importUtil.pathPatternMatches('/users', '/api/v1/users')).toBe(true);
    expect(importUtil.pathPatternMatches('/key/header', '/v1/key/header')).toBe(true);
  });

  it('should handle leading slashes consistently', () => {
    expect(importUtil.pathPatternMatches('users', 'users')).toBe(true);
    expect(importUtil.pathPatternMatches('users', '/users')).toBe(true);
    expect(importUtil.pathPatternMatches('/users', 'users')).toBe(true);
  });
});

describe('mcpUrlToInsomniaV5Yaml', () => {
  it('should produce YAML matching the MCP client export shape (schema_version, mcpRequest)', () => {
    const yaml = importUtil.mcpUrlToInsomniaV5Yaml('https://example.com/mcp?x=1#y');
    const doc = parse(yaml) as Record<string, unknown>;
    expect(doc).toMatchObject({
      type: 'mcpClient.insomnia/5.0',
      schema_version: INSOMNIA_SCHEMA_VERSION,
      name: 'Imported MCP Client',
      mcpRequest: {
        name: 'Imported MCP Client',
        url: 'https://example.com/mcp?x=1#y',
        transportType: 'streamable-http',
      },
    });
  });

  it.each([
    ['https://example.com'],
    ['https://example.com/mcp'],
    ['https://example.com/mcp?param=value'],
    ['https://example.com/mcp#fragment'],
    ['http://examples.com/mcp'],
  ])('should embed the MCP URL %s in mcpRequest.url', url => {
    const doc = parse(importUtil.mcpUrlToInsomniaV5Yaml(url)) as { mcpRequest: { url: string } };
    expect(doc.mcpRequest.url).toBe(url);
  });

  it('should throw an error if the MCP URL is not a valid HTTP URL', () => {
    expect(() => importUtil.mcpUrlToInsomniaV5Yaml('ftp://example.com')).toThrow(
      'MCP server URL must use http or https',
    );
    expect(() => importUtil.mcpUrlToInsomniaV5Yaml('not-a-url')).toThrow('Invalid URL: not-a-url');
  });

  it('escape sequences in the MCP URL are unmodified', () => {
    const cases = ['https://example.com/foo\\nbar', 'https://example.com/foo\\tbar'] as const;
    for (const input of cases) {
      const yaml = importUtil.mcpUrlToInsomniaV5Yaml(input);
      const doc = parse(yaml) as { mcpRequest: { url: string } };
      expect(doc.mcpRequest.url).toBe(input);
    }
  });

  it('should be accepted by the v5 importer', () => {
    const yaml = importUtil.mcpUrlToInsomniaV5Yaml('https://example.com/mcp');
    const { data, error } = tryImportV5Data(yaml);
    expect(error).toBeUndefined();
    expect(data.length).toBeGreaterThan(0);
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

    const projectToImportTo = await services.project.create();

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

    const workspacesCount = await services.workspace.count();
    const projectWorkspaces = await services.workspace.findByParentId(projectToImportTo._id);
    const curlRequests = await services.request.findByParentId(projectWorkspaces[0]._id);

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

    const existingWorkspace = await services.workspace.create();

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

    const curlRequests = await services.request.findByParentId(existingWorkspace._id);

    expect(curlRequests[0]).toMatchObject({
      body: {
        text: '{\"email_id\": \"tem_123\"}',
      },
    });
  });

  it('should import a postman collection to a new workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'postman', 'aws-signature-auth-v2_0-input.json');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();
    const projectToImportTo = await services.project.create();
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

    const projectWorkspaces = await services.workspace.findByParentId(projectToImportTo._id);

    const requestGroups = await services.requestGroup.findByParentId(projectWorkspaces[0]._id);
    const requests = await services.request.findByParentId(requestGroups[0]._id);

    expect(requests[0]).toMatchObject({
      url: 'https://insomnia.rest',
    });
  });

  it('should import a postman collection to an existing workspace', async () => {
    const fixturePath = path.join(__dirname, '..', '__fixtures__', 'postman', 'aws-signature-auth-v2_0-input.json');
    const content = fs.readFileSync(fixturePath, 'utf8').toString();

    const existingWorkspace = await services.workspace.create();

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

    const requestGroups = await services.requestGroup.findByParentId(existingWorkspace._id);
    const requests = await services.request.findByParentId(requestGroups[0]._id);

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

    const projectToImportTo = await services.project.create();
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

    const projectWorkspaces = await services.workspace.findByParentId(projectId);
    const importedWorkspaceId = projectWorkspaces[0]._id;
    const requestBaseEnvironment = await services.environment.getByParentId(importedWorkspaceId);

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

    const existingWorkspace = await services.workspace.create();
    const workspaceId = existingWorkspace._id;
    const baseEnvironment = await services.environment.getOrCreateForParentId(workspaceId);
    await services.environment.update(baseEnvironment, {
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

    const updatedBaseEnvironment = await services.environment.getByParentId(workspaceId);

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

    const existingWorkspace = await services.workspace.create();
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
    const baseEnvironment = await services.environment.getOrCreateForParentId(workspaceId);
    await services.environment.update(baseEnvironment, {
      data: {
        from: 'baseEnv',
      },
      environmentType: EnvironmentType.KVPAIR,
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

    const updatedBaseEnvironment = await services.environment.getByParentId(workspaceId);

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

    const existingWorkspace = await services.workspace.create();
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
    const baseEnvironment = await services.environment.getOrCreateForParentId(workspaceId);
    await services.environment.update(baseEnvironment, {
      data: {
        from: 'baseEnv',
      },
      environmentType: EnvironmentType.KVPAIR,
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

    const updatedBaseEnvironment = await services.environment.getByParentId(workspaceId);

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

  it('concurrent scanResources calls should not duplicate the resource cache', async () => {
    const proj = await services.project.create();
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        importUtil.scanResources([{ contentStr: `curl -X POST https://${i}.test -d "n=${i}"` }]),
      ),
    );

    const workspaces = await importUtil.importResourcesToProject({ projectId: proj._id });
    expect(workspaces).toHaveLength(1);

    const reqs = await services.request.findByParentId(workspaces[0]._id);
    expect(reqs).toHaveLength(1);
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
