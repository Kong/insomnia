
import { faker } from '@faker-js/faker';

import type { GitEntityTypeFiles, GitEntityTypeNames } from '../../../models/git-entity-type-files';
import type { GitFileLevelSettings } from '../../../models/git-file-level-settings';
import type { GitLongValues } from '../../../models/git-long-values';
import type { GitMovedRequest } from '../../../models/git-moved-request';
import { COLLECTION_TEMPLATE } from './entity-type-collection-template';

const FILE_TIMES = { created: 1000, modified: 1000 };

export function planEntityTypeFiles(): GitEntityTypeFiles {
  const names: GitEntityTypeNames = {
    folder: faker.string.alpha(10),
    request: faker.string.alpha(10),
    webSocket: faker.string.alpha(10),
    socketIo: faker.string.alpha(10),
    grpc: faker.string.alpha(10),
    mockRoute: `/${faker.string.alpha(10)}`,
    mcp: faker.string.alpha(10),
  };
  const ids = {
    workspace: faker.string.alphanumeric({ length: 16, casing: 'lower' }),
    folder: `fld_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    request: `req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    webSocket: `ws-req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    socketIo: `socketio-req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    grpc: `greq_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    environment: `env_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    cookieJar: `jar_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    mockWorkspace: `wrk_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    mockServer: `mock-server_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    mockRoute: `mock-route_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    mcpWorkspace: `wrk_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    mcp: `mcp-req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
  };
  const workspaceNames = { collection: faker.string.alpha(10), mock: faker.string.alpha(10), mcp: faker.string.alpha(10) };
  const header = (changed: boolean) => (changed ? [{ name: 'X-Added', value: 'added' }] : undefined);
  const collectionIds = [`wrk_${ids.workspace}`, ids.folder, ids.request, ids.webSocket, ids.socketIo, ids.grpc, ids.cookieJar, ids.environment];
  const renderCollectionTemplate = (changed: boolean) => {
    let content = COLLECTION_TEMPLATE(changed).replaceAll('__WS_NAME__', workspaceNames.collection);
    for (const [key, value] of Object.entries(names)) {
      content = content.replaceAll(`__NAME_${key}__`, value);
    }
    collectionIds.forEach((id, index) => {
      content = content.replaceAll(`__ID_${index}__`, id);
    });
    return content;
  };
  const build = (changed: boolean) => ({
    collection: renderCollectionTemplate(changed),
    mock: JSON.stringify(
      {
        type: 'mock.insomnia.rest/5.0',
        schema_version: '5.1',
        name: workspaceNames.mock,
        meta: { id: ids.mockWorkspace, ...FILE_TIMES },
        server: {
          meta: { id: ids.mockServer, ...FILE_TIMES },
          url: 'https://mock.example.com',
          useInsomniaCloud: false,
        },
        routes: [
          {
            name: names.mockRoute,
            method: 'GET',
            statusCode: 200,
            mimeType: 'application/json',
            meta: { id: ids.mockRoute, ...FILE_TIMES },
            headers: header(changed),
          },
        ],
      },
      null,
      2,
    ),
    mcp: JSON.stringify(
      {
        type: 'mcpClient.insomnia/5.0',
        name: workspaceNames.mcp,
        meta: { id: ids.mcpWorkspace, ...FILE_TIMES },
        mcpRequest: {
          name: names.mcp,
          url: 'npx server',
          transportType: 'stdio',
          meta: { id: ids.mcp, ...FILE_TIMES },
          headers: header(changed),
        },
      },
      null,
      2,
    ),
  });
  return { names, build };
}

export function planFileLevelSettings(): GitFileLevelSettings {
  const names = { workspace: faker.string.alpha(10), previousWorkspace: faker.string.alpha(11), mockServerUrl: `https://${faker.string.alpha(8)}.example.com`, mockWorkspace: faker.string.alpha(10) };
  const ids = {
    specWorkspace: `wrk_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    spec: `spc_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    suite: `uts_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    certificate: `crt_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    mockWorkspace: `wrk_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    mockServer: `mock-server_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
  };
  const build = (changed: boolean) => ({
    spec: JSON.stringify(
      {
        type: 'spec.insomnia.rest/5.0',
        schema_version: '5.1',
        name: changed ? names.workspace : names.previousWorkspace,
        meta: { id: ids.specWorkspace, ...FILE_TIMES },
        spec: {
          meta: { id: ids.spec, ...FILE_TIMES },
          contents: { openapi: '3.0.0', info: { title: changed ? 'New title' : 'Old title', version: '1.0.0' }, paths: {} },
        },
        testSuites: changed ? [{ name: 'Suite', meta: { id: ids.suite, ...FILE_TIMES }, tests: [] }] : undefined,
        certificates: changed ? [{ path: '/tmp/ca.pem', meta: { id: ids.certificate, ...FILE_TIMES } }] : undefined,
      },
      null,
      2,
    ),
    mock: JSON.stringify(
      {
        type: 'mock.insomnia.rest/5.0',
        schema_version: '5.1',
        name: names.mockWorkspace,
        meta: { id: ids.mockWorkspace, ...FILE_TIMES },
        server: {
          meta: { id: ids.mockServer, ...FILE_TIMES },
          url: changed ? names.mockServerUrl : 'https://old.example.com',
          useInsomniaCloud: false,
        },
      },
      null,
      2,
    ),
  });

  return { names, build };
}

export function planMovedRequest(): GitMovedRequest {
  const ids = { workspace: `wrk_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, folder: `fld_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, request: `req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, environment: `env_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}` };
  const names = { workspace: faker.string.alpha(10), folder: faker.string.alpha(10), request: faker.string.alpha(10) };
  const build = (moved: boolean) => {
    const request = {
      name: names.request,
      url: moved ? 'https://example.com/moved-and-edited' : 'https://example.com/original',
      method: 'GET',
      meta: { id: ids.request, ...FILE_TIMES, isPrivate: false },
      settings: { renderRequestBody: true, encodeUrl: true, followRedirects: 'global', cookies: { send: true, store: true }, rebuildPath: true },
    };
    const folder = { name: names.folder, meta: { id: ids.folder, ...FILE_TIMES }, children: moved ? [request] : undefined };
    return JSON.stringify(
      {
        type: 'collection.insomnia.rest/5.0',
        schema_version: '5.1',
        name: names.workspace,
        meta: { id: ids.workspace, ...FILE_TIMES },
        collection: moved ? [folder] : [folder, request],
        environments: { name: 'Base Environment', meta: { id: ids.environment, ...FILE_TIMES, isPrivate: false } },
      },
      null,
      2,
    );
  };

  return { requestId: ids.request, requestName: names.request, folderName: names.folder, build };
}

export function planLongValues(): GitLongValues {
  const ids = { workspace: `wrk_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, longRequest: `req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, shortRequest: `req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, spec: `spc_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}` };
  const names = { workspace: faker.string.alpha(10), longRequest: faker.string.alpha(10), shortRequest: faker.string.alpha(10) };
  const totalLines = 40;
  const longText = (changed: boolean) =>
    Array.from({ length: totalLines }, (_, index) => (index === 20 && changed ? 'changed line' : `line ${index}`)).join('\n');
  const specPaths = (changed: boolean) =>
    Object.fromEntries(
      Array.from({ length: totalLines }, (_, index) => [`/path-${index}`, { get: { summary: index === 20 && changed ? 'changed summary' : `summary ${index}` } }]),
    );
  const build = (changed: boolean) =>
    JSON.stringify(
      {
        type: 'spec.insomnia.rest/5.0',
        schema_version: '5.1',
        name: names.workspace,
        meta: { id: ids.workspace, ...FILE_TIMES },
        collection: [
          {
            name: names.longRequest,
            url: 'https://example.com/long',
            method: 'POST',
            meta: { id: ids.longRequest, ...FILE_TIMES },
            body: { mimeType: 'text/plain', text: longText(changed) },
            scripts: { preRequest: longText(changed) },
          },
          {
            name: names.shortRequest,
            url: 'https://example.com/short',
            method: 'POST',
            meta: { id: ids.shortRequest, ...FILE_TIMES },
            body: { mimeType: 'text/plain', text: changed ? 'short new' : 'short old' },
          },
        ],
        spec: { meta: { id: ids.spec, ...FILE_TIMES }, contents: { openapi: '3.0.0', info: { title: 'T' }, paths: specPaths(changed) } },
      },
      null,
      2,
    );

  return { longRequest: names.longRequest, shortRequest: names.shortRequest, workspace: names.workspace, totalLines, build };
}


const SEED_REQUEST_SETTINGS = { renderRequestBody: true, encodeUrl: true, followRedirects: 'global', cookies: { send: true, store: true }, rebuildPath: true };

export function buildSeedRequest(id: string, name: string, url: string, extra: Record<string, unknown> = {}) {
  return { name, url, method: 'GET', meta: { id, created: 1000, modified: 1000, isPrivate: false }, settings: SEED_REQUEST_SETTINGS, ...extra };
}

export function buildSeedFolder(id: string, name: string, children?: unknown[]) {
  return { name, meta: { id, created: 1000, modified: 1000 }, children };
}

export function buildSeedCollectionFile(workspace: { id: string; name: string; environmentId: string }, collection: unknown[]) {
  return JSON.stringify(
    {
      type: 'collection.insomnia.rest/5.0',
      schema_version: '5.1',
      name: workspace.name,
      meta: { id: workspace.id, created: 1000, modified: 1000 },
      collection,
      environments: { name: 'Base Environment', meta: { id: workspace.environmentId, created: 1000, modified: 1000, isPrivate: false } },
    },
    null,
    2,
  );
}

export function planSeedWorkspace() {
  return {
    id: `wrk_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
    name: faker.string.alpha(10),
    environmentId: `env_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`,
  };
}

export function planSeedId(prefix: 'fld' | 'req') {
  return `${prefix}_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`;
}
