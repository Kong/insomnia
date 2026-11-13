import type { Environment } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchRequestData, tryToExecuteAfterResponseScript, tryToExecutePreRequestScript } from '~/network/network';
import { getRuntime } from '~/runtimes';

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }));

let originalNetworkRuntime: ReturnType<typeof getRuntime>['network'];
let executedScripts: string[];

/** Stands in for the script sandbox: records the script it is handed and echoes the context back. */
const installRecordingScriptRuntime = () => {
  const runtime = getRuntime();
  originalNetworkRuntime = runtime.network;
  (runtime as { network: unknown }).network = {
    ...runtime.network,
    runScript: async ({ script, context }: { script: string; context: Record<string, any> }) => {
      executedScripts.push(script);
      return { ...context, logs: [] };
    },
  };
};

const markersInOrder = (script: string) => Array.from(script.matchAll(/MARK_([A-Z_]+)/g)).map(match => match[1]);

const setUpHierarchy = async (scripts: {
  workspace?: string;
  outerFolder?: string;
  innerFolder?: string;
  request?: string;
  kind: 'preRequestScript' | 'afterResponseScript';
}) => {
  const { kind } = scripts;
  const workspace = await services.workspace.create({
    scope: models.workspace.WorkspaceScopeKeys.collection,
    ...(scripts.workspace && { [kind]: scripts.workspace }),
  });
  await services.environment.getOrCreateForParentId(workspace._id);
  const outerFolder = await services.requestGroup.create({
    name: 'outer',
    parentId: workspace._id,
    metaSortKey: 0,
    ...(scripts.outerFolder && { [kind]: scripts.outerFolder }),
  });
  const innerFolder = await services.requestGroup.create({
    name: 'inner',
    parentId: outerFolder._id,
    metaSortKey: 0,
    ...(scripts.innerFolder && { [kind]: scripts.innerFolder }),
  });
  const request = await services.request.create({
    name: 'request',
    parentId: innerFolder._id,
    ...(scripts.request && { [kind]: scripts.request }),
  });
  return { workspace, request };
};

const newTransientVariables = () => ({ name: 'transientVariables', data: {}, dataPropertyOrder: null }) as Environment;

const runPreRequest = async (requestId: string) =>
  tryToExecutePreRequestScript(await fetchRequestData(requestId), newTransientVariables());

const runAfterResponse = async (requestId: string) => {
  const requestData = await fetchRequestData(requestId);
  const response = {
    _id: 'res_test',
    parentId: requestId,
    timelinePath: requestData.timelinePath,
    statusMessage: 'OK',
    statusCode: 200,
    cookies: [],
    timeline: [],
    headers: [],
  };
  return tryToExecuteAfterResponseScript({
    ...requestData,
    response: response as never,
    transientVariables: newTransientVariables(),
    parentFolders: [],
    runtime: { appendTimeline: async () => {}, appendTimelineOnError: async () => {} },
  });
};

describe('collection-level script execution order', () => {
  beforeEach(() => {
    executedScripts = [];
    installRecordingScriptRuntime();
  });

  afterEach(() => {
    (getRuntime() as { network: unknown }).network = originalNetworkRuntime;
  });

  it('runs pre-request scripts collection first, then folders furthest to nearest, then the request', async () => {
    const { request } = await setUpHierarchy({
      kind: 'preRequestScript',
      workspace: '/* MARK_COLLECTION */',
      outerFolder: '/* MARK_OUTER_FOLDER */',
      innerFolder: '/* MARK_INNER_FOLDER */',
      request: '/* MARK_REQUEST */',
    });

    const result = await runPreRequest(request._id);

    expect(result).not.toHaveProperty('error');
    expect(executedScripts).toHaveLength(1);
    expect(markersInOrder(executedScripts[0])).toEqual([
      'COLLECTION',
      'OUTER_FOLDER',
      'INNER_FOLDER',
      'REQUEST',
    ]);
  });

  it('runs after-response scripts collection first, then folders furthest to nearest, then the request', async () => {
    const { request } = await setUpHierarchy({
      kind: 'afterResponseScript',
      workspace: '/* MARK_COLLECTION */',
      outerFolder: '/* MARK_OUTER_FOLDER */',
      innerFolder: '/* MARK_INNER_FOLDER */',
      request: '/* MARK_REQUEST */',
    });

    const result = await runAfterResponse(request._id);

    expect(result).not.toHaveProperty('error');
    expect(executedScripts).toHaveLength(1);
    expect(markersInOrder(executedScripts[0])).toEqual([
      'COLLECTION',
      'OUTER_FOLDER',
      'INNER_FOLDER',
      'REQUEST',
    ]);
  });

  it('skips levels without a script', async () => {
    const { request } = await setUpHierarchy({
      kind: 'preRequestScript',
      workspace: '/* MARK_COLLECTION */',
      request: '/* MARK_REQUEST */',
    });

    await runPreRequest(request._id);

    expect(markersInOrder(executedScripts[0])).toEqual(['COLLECTION', 'REQUEST']);
  });

  it('runs a collection-level pre-request script even when no folder or request has one', async () => {
    const { request } = await setUpHierarchy({ kind: 'preRequestScript', workspace: '/* MARK_COLLECTION */' });

    await runPreRequest(request._id);

    expect(markersInOrder(executedScripts[0])).toEqual(['COLLECTION']);
  });

  it('runs a collection-level after-response script even when no folder or request has one', async () => {
    const { request } = await setUpHierarchy({ kind: 'afterResponseScript', workspace: '/* MARK_COLLECTION */' });

    await runAfterResponse(request._id);

    expect(markersInOrder(executedScripts[0])).toEqual(['COLLECTION']);
  });

  it('does not run the sandbox when no level defines a script', async () => {
    const { request } = await setUpHierarchy({ kind: 'preRequestScript' });

    expect(await runPreRequest(request._id)).not.toHaveProperty('error');
    expect(await runAfterResponse(request._id)).not.toHaveProperty('error');
    expect(executedScripts).toEqual([]);
  });

  it('does not mix up pre-request and after-response scripts', async () => {
    const { request } = await setUpHierarchy({ kind: 'preRequestScript', workspace: '/* MARK_COLLECTION_PRE */' });

    await runAfterResponse(request._id);

    expect(executedScripts).toEqual([]);
  });

  it('runs workspace scripts for a request that is a direct child of the collection', async () => {
    const workspace = await services.workspace.create({
      scope: models.workspace.WorkspaceScopeKeys.collection,
      preRequestScript: '/* MARK_COLLECTION */',
    });
    await services.environment.getOrCreateForParentId(workspace._id);
    const request = await services.request.create({
      name: 'request',
      parentId: workspace._id,
      preRequestScript: '/* MARK_REQUEST */',
    });

    await runPreRequest(request._id);

    expect(markersInOrder(executedScripts[0])).toEqual(['COLLECTION', 'REQUEST']);
  });
});
