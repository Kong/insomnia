import type {
  CaCertificate,
  ClientCertificate,
  Cookie,
  CookieJar,
  Environment,
  MockRoute,
  MockServer,
  Project,
  Request,
  RequestAuthentication,
  RequestGroup,
  RequestHeader,
  RequestParameter,
  RequestTestResult,
  ResponseTimelineEntry,
  Settings,
  SocketIORequest,
  UserUploadEnvironment,
  WebSocketRequest,
  Workspace,
} from 'insomnia-data';
import { EnvironmentType, models, services } from 'insomnia-data';
import { invariant, serializeNDJSON } from 'insomnia-data/common';
import orderedJSON from 'json-order';

import {
  appendTimelineLines,
  appendToTimelineOnError,
  applyRequestHooks,
  applyResponseHooks,
  executeCurlRequest,
  getAuthHeader,
  getTimelinePath,
  runScript,
} from '~/network/network-adapter';
import { getKVPairFromData } from '~/utils/environment-utils';

import type { ExecutionOption, RequestContext } from '../../../insomnia-scripting-environment/src/objects';
import { SINGLE_VALUE_HEADERS } from '../common/common-headers';
import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '../common/constants';
import { database as db } from '../common/database';
import { generateId, getContentTypeHeader, getLocationHeader, getSetCookieHeaders } from '../common/misc';
import { getRenderedRequestAndContext } from '../common/render';
import { ascendingFirstIndexStringSort } from '../common/sorting';
import type { HeaderResult, ResponsePatch } from '../main/network/libcurl-promise';
import { RenderError } from '../templating/render-error';
import type { RenderedRequest, RenderPurpose } from '../templating/types';
import { maskOrDecryptVaultDataIfNecessary } from '../templating/utils';
import { buildQueryStringFromParams, joinUrlAndQueryString, smartEncodeUrl } from '../utils/url/querystring';
import { QUERY_PARAMS } from './api-key/constants';
import { getAuthObjectOrNull, isAuthEnabled } from './authentication';
import { filterClientCertificates } from './certificate';
import type { TransformedExecuteScriptContext } from './concurrency';
import { addSetCookiesToToughCookieJar } from './set-cookie-util';

const { isRequest } = models.request;
const { isRequestGroup } = models.requestGroup;

export interface SendActionRuntime {
  appendTimeline: (timelinePath: string, logs: string[]) => Promise<void>;
}

export const getOrInheritAuthentication = ({
  request,
  requestGroups,
}: {
  request: Request | WebSocketRequest | SocketIORequest;
  requestGroups: RequestGroup[];
}): RequestAuthentication | {} => {
  const hasValidAuth = getAuthObjectOrNull(request.authentication) && isAuthEnabled(request.authentication);
  if (hasValidAuth) {
    return request.authentication;
  }
  const hasParentFolders = requestGroups.length > 0;
  const closestParentFolderWithAuth = [...requestGroups]
    .reverse()
    .find(({ authentication }) => getAuthObjectOrNull(authentication) && isAuthEnabled(authentication));
  const closestAuth = getAuthObjectOrNull(closestParentFolderWithAuth?.authentication);
  const shouldCheckFolderAuth = hasParentFolders && closestAuth;
  if (shouldCheckFolderAuth) {
    // override auth with closest parent folder that has one set
    return closestAuth;
  }
  // if no auth is specified on request or folders, default to none
  return { type: 'none' };
};
export function getOrInheritHeaders({
  request,
  requestGroups,
}: {
  request: Pick<Request, 'headers'>;
  requestGroups: Pick<RequestGroup, 'headers'>[];
}): RequestHeader[] {
  const httpHeaders = new Map<string, string>();
  const originalCaseMap = new Map<string, string>();
  // parent folders, then child folders, then request
  const headerContexts = [...requestGroups.reverse(), request];
  const headers = headerContexts.flatMap(({ headers }) => headers || []);
  headers.forEach(({ name, value, disabled }) => {
    if (disabled || !name.trim()) {
      return;
    }
    const normalizedCase = name.toLowerCase();
    // preserves the casing of the last header with the same name
    originalCaseMap.set(normalizedCase, name);
    const isStrictValueHeader = SINGLE_VALUE_HEADERS.includes(normalizedCase);
    if (isStrictValueHeader) {
      httpHeaders.set(normalizedCase, value);
      return;
    }
    // appending will join matching header values with a comma
    if (httpHeaders.has(normalizedCase)) {
      httpHeaders.set(normalizedCase, `${httpHeaders.get(normalizedCase)}, ${value}`);
      return;
    }
    httpHeaders.set(normalizedCase, value);
  });
  return Array.from(httpHeaders.entries())
    .sort(ascendingFirstIndexStringSort)
    .map(([name, value]) => ({ name: originalCaseMap.get(name)!, value }));
}
// (only used for getOAuth2 token) Intended to gather all required database objects and initialize ids
export const fetchRequestGroupData = async (requestGroupId: string) => {
  const requestGroup = await services.requestGroup.getById(requestGroupId);
  invariant(requestGroup, 'failed to find requestGroup ' + requestGroupId);
  const ancestors = await db.withAncestors<RequestGroup | Workspace | MockRoute | MockServer>(requestGroup, [
    models.requestGroup.type,
    models.workspace.type,
    models.mockRoute.type,
    models.mockServer.type,
  ]);
  const workspaceDoc = ancestors.find(models.workspace.isWorkspace);
  invariant(workspaceDoc?._id, 'failed to find workspace');
  const workspaceId = workspaceDoc._id;

  const workspace = await services.workspace.getById(workspaceId);
  invariant(workspace, 'failed to find workspace');
  const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspace._id);
  // NOTE: parent folders wont be checked in here since we only use it for oauth2 requests right now, so they are discarded in that code path
  // fallback to base environment
  const activeEnvironmentId = workspaceMeta.activeEnvironmentId;
  const activeEnvironment = activeEnvironmentId && (await services.environment.getById(activeEnvironmentId));
  const environment = activeEnvironment || (await services.environment.getOrCreateForParentId(workspace._id));
  invariant(environment, 'failed to find environment ' + activeEnvironmentId);

  const settings = await services.settings.get();
  invariant(settings, 'failed to create settings');
  const clientCertificates = await services.clientCertificate.findByParentId(workspaceId);
  const caCert = await services.caCertificate.getByParentId(workspaceId);
  const responseId = generateId('res');
  const timelinePath = await getTimelinePath(responseId);
  return { environment, settings, clientCertificates, caCert, activeEnvironmentId, timelinePath, responseId };
};

// Intended to gather all required database objects and initialize ids
export const fetchRequestData = async (
  requestId: string,
  // Override the active environment id to use for the request
  overrideEnvironmentId?: string,
) => {
  const request = await services.request.getById(requestId);
  invariant(request, 'failed to find request ' + requestId);
  const ancestors = await db.withAncestors<Request | RequestGroup | Workspace | Project | MockRoute | MockServer>(
    request,
    [
      models.request.type,
      models.requestGroup.type,
      models.workspace.type,
      models.project.type,
      models.mockRoute.type,
      models.mockServer.type,
    ],
  );

  const workspaceDoc = ancestors.find(models.workspace.isWorkspace);
  invariant(workspaceDoc?._id, 'failed to find workspace');
  const workspaceId = workspaceDoc._id;

  const workspace = await services.workspace.getById(workspaceId);
  invariant(workspace, 'failed to find workspace');
  const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspaceId);

  const activeEnvironmentId = overrideEnvironmentId ?? workspaceMeta.activeEnvironmentId;
  const activeEnvironment = activeEnvironmentId && (await services.environment.getById(activeEnvironmentId));

  const baseEnvironment = await services.environment.getOrCreateForParentId(workspaceId);
  // no active environment in workspaceMeta, fallback to workspace root environment as active environment
  const environment = activeEnvironment || baseEnvironment;
  invariant(environment, 'failed to find environment ' + activeEnvironmentId);

  const cookieJar = await services.cookieJar.getOrCreateForParentId(workspaceId);

  let activeGlobalEnvironment: Environment | undefined;
  let activeGlobalBaseEnvironment: Environment | undefined;
  if (workspaceMeta?.activeGlobalEnvironmentId) {
    activeGlobalEnvironment =
      (await services.environment.getById(workspaceMeta.activeGlobalEnvironmentId)) || undefined;
    const activeGlobalEnvironmentParentId = activeGlobalEnvironment?.parentId || '';
    if (activeGlobalEnvironmentParentId.startsWith('wrk_')) {
      // activeGlobalEnvironment is a base global environment
      activeGlobalBaseEnvironment = activeGlobalEnvironment;
    } else if (activeGlobalEnvironmentParentId.startsWith('env_')) {
      // activeGlobalEnvironment is a sub global environment
      activeGlobalBaseEnvironment = (await services.environment.getById(activeGlobalEnvironmentParentId)) || undefined;
    }
  }

  const settings = await services.settings.get();
  invariant(settings, 'failed to create settings');
  const clientCertificates = await services.clientCertificate.findByParentId(workspaceId);
  const caCert = await services.caCertificate.getByParentId(workspaceId);

  const responseId = generateId('res');
  const timelinePath = await getTimelinePath(responseId);

  return {
    request,
    environment,
    baseEnvironment,
    activeGlobalEnvironment,
    activeGlobalBaseEnvironment,
    activeEnvironmentId: environment._id,
    settings,
    clientCertificates,
    caCert,
    cookieJar,
    workspace,
    timelinePath,
    responseId,
    ancestors,
  };
};

export const fetchMcpRequestData = async (mcpRequestId: string) => {
  const mcpRequest = await services.mcpRequest.getById(mcpRequestId);
  invariant(mcpRequest, 'failed to find MCP request ' + mcpRequestId);

  const workspace = await services.workspace.getById(mcpRequest.parentId);
  invariant(workspace, 'failed to find workspace');
  const workspaceId = workspace._id;
  const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspaceId);
  const activeEnvironmentId = workspaceMeta.activeEnvironmentId;
  const activeEnvironment = activeEnvironmentId && (await services.environment.getById(activeEnvironmentId));
  const baseEnvironment = await services.environment.getOrCreateForParentId(workspaceId);
  // no active environment in workspaceMeta, fallback to workspace root environment as active environment
  const environment = activeEnvironment || baseEnvironment;
  invariant(environment, 'failed to find environment ' + activeEnvironmentId);

  const settings = await services.settings.get();
  invariant(settings, 'failed to create settings');

  const responseId = generateId('res');
  const timelinePath = await getTimelinePath(responseId);

  return {
    environment,
    settings,
    clientCertificates: [] as ClientCertificate[],
    caCert: undefined,
    activeEnvironmentId,
    timelinePath,
    responseId,
  };
};

export const tryToExecutePreRequestScript = async (
  {
    request,
    environment,
    baseEnvironment,
    activeGlobalEnvironment,
    activeGlobalBaseEnvironment,
    cookieJar,
    settings,
    clientCertificates,
    timelinePath,
    responseId,
    ancestors,
  }: Awaited<ReturnType<typeof fetchRequestData>>,
  transientVariables: Environment,
  userUploadEnvironment?: UserUploadEnvironment,
  iteration?: number,
  iterationCount?: number,
  runtime?: SendActionRuntime,
) => {
  const requestGroups = ancestors.filter(doc => isRequest(doc) || isRequestGroup(doc)) as RequestGroup[];
  const folderScripts = requestGroups
    .reverse()
    .filter(group => group?.preRequestScript)
    .map(
      (group, i) => `const fn${i} = async ()=>{
        ${group.preRequestScript}
      }
      await fn${i}();
  `,
    );
  const originalRequestGroups = requestGroups.filter(group => isRequestGroup(group));
  const parentFolders = originalRequestGroups.map(group => ({
    id: group._id,
    name: group.name,
    environment: group.environment,
  }));

  if (folderScripts.length === 0) {
    return {
      request,
      environment,
      baseEnvironment,
      clientCertificates,
      settings,
      cookieJar,
      globals: activeGlobalEnvironment,
      baseGlobals: activeGlobalBaseEnvironment,
      userUploadEnvironment,
      requestTestResults: new Array<RequestTestResult>(),
      transientVariables,
      logs: '',
      parentFolders,
    };
  }
  const joinedScript = [...folderScripts].join('\n');

  const mutatedContext = await tryToExecuteScript({
    script: joinedScript,
    request,
    environment,
    timelinePath,
    responseId,
    baseEnvironment,
    clientCertificates,
    cookieJar,
    globals: activeGlobalEnvironment,
    baseGlobals: activeGlobalBaseEnvironment,
    userUploadEnvironment,
    iteration,
    iterationCount,
    ancestors,
    eventName: 'prerequest',
    settings,
    transientVariables,
    runtime,
    parentFolders,
  });
  if (!mutatedContext || 'error' in mutatedContext) {
    return {
      error: `Execute pre-request script failed: ${mutatedContext?.error}`,
      request,
      environment,
      baseEnvironment,
      clientCertificates,
      settings,
      cookieJar,
      globals: activeGlobalEnvironment,
      baseGlobals: activeGlobalBaseEnvironment,
      requestTestResults: new Array<RequestTestResult>(),
      parentFolders,
    };
  }
  await savePatchesMadeByScript({
    mutatedContext,
    environment,
    baseEnvironment,
    activeGlobalEnvironment,
    activeGlobalBaseEnvironment,
    originalRequestGroups,
  });

  const preTestResults: RequestTestResult[] = (mutatedContext.requestTestResults || []).map(result => ({
    ...result,
    category: 'pre-request',
  }));
  return {
    request: mutatedContext.request,
    environment: mutatedContext.environment,
    baseEnvironment: mutatedContext.baseEnvironment || baseEnvironment,
    clientCertificates: mutatedContext.clientCertificates || clientCertificates,
    settings: mutatedContext.settings || settings,
    globals: mutatedContext.globals,
    baseGlobals: mutatedContext.baseGlobals,
    cookieJar: mutatedContext.cookieJar,
    requestTestResults: preTestResults,
    userUploadEnvironment: mutatedContext.userUploadEnvironment,
    execution: mutatedContext.execution,
    transientVariables: mutatedContext.transientVariables,
    parentFolders: mutatedContext.parentFolders,
  };
};

// savePatchesMadeByScript persists entities
// The rule for the global environment:
//  - If no global environment is selected, no operation
//  - If one global environment is selected, it persists content to the selected global environment (base or sub).
export async function savePatchesMadeByScript(patches: {
  mutatedContext: TransformedExecuteScriptContext;
  environment: Environment;
  baseEnvironment: Environment;
  activeGlobalEnvironment: Environment | undefined;
  activeGlobalBaseEnvironment: Environment | undefined;
  originalRequestGroups: RequestGroup[];
  responseCookies?: Cookie[];
}) {
  const {
    mutatedContext,
    environment,
    baseEnvironment,
    activeGlobalEnvironment,
    activeGlobalBaseEnvironment,
    originalRequestGroups,
    responseCookies,
  } = patches;
  if (!mutatedContext) {
    return;
  }

  // persist updated cookieJar if needed
  if (mutatedContext.cookieJar) {
    // merge cookies from response to the cookiejar, or cookies from response will not be persisted
    await services.cookieJar.update(mutatedContext.cookieJar, {
      cookies: [...(responseCookies || []), ...mutatedContext.cookieJar.cookies],
    });
  }
  // when base environment is activated, `mutatedContext.environment` points to it
  const isActiveEnvironmentBase = mutatedContext.environment?._id === baseEnvironment._id;
  const hasEnvironmentAndIsNotBase = mutatedContext.environment && !isActiveEnvironmentBase;
  const hasGlobalEnvironmentAndIsNotBase =
    mutatedContext.globals && mutatedContext.globals?._id !== activeGlobalBaseEnvironment?._id;
  const updateEnvironment = async (originEnvironment: Environment, mutatedContextEnvironment: Environment) => {
    const { environmentType } = originEnvironment;
    const { data, dataPropertyOrder } = mutatedContextEnvironment;
    await services.environment.update(originEnvironment, {
      data,
      dataPropertyOrder,
      // also update kvPairData when environment type is table view(kv pair)
      ...(environmentType === EnvironmentType.KVPAIR && {
        kvPairData: getKVPairFromData(data, dataPropertyOrder),
      }),
    });
  };

  if (hasEnvironmentAndIsNotBase) {
    await updateEnvironment(environment, mutatedContext.environment);
  }
  if (mutatedContext.baseEnvironment) {
    await updateEnvironment(baseEnvironment, mutatedContext.baseEnvironment);
  }

  if (activeGlobalEnvironment && hasGlobalEnvironmentAndIsNotBase) {
    invariant(mutatedContext.globals, 'globals must be defined when there is selected one');
    await updateEnvironment(activeGlobalEnvironment, mutatedContext.globals);
  }

  if (activeGlobalBaseEnvironment) {
    invariant(mutatedContext.baseGlobals, 'baseGlobals must be defined when there is active global base environment');
    await updateEnvironment(activeGlobalBaseEnvironment, mutatedContext.baseGlobals);
  }

  mutatedContext.parentFolders.forEach(mutatedFolder => {
    const originalFolder = originalRequestGroups.find(originalFolder => originalFolder._id === mutatedFolder.id);
    if (originalFolder) {
      services.requestGroup.update(originalFolder, {
        environment: mutatedFolder.environment,
        // also update kvPairData when folder environment type is table view(kv pair)
        ...(originalFolder.environmentType === EnvironmentType.KVPAIR && {
          kvPairData: getKVPairFromData(mutatedFolder.environment, originalFolder.environmentPropertyOrder),
        }),
      });
    }
  });
}

const tryToExecuteScript = async (context: RequestAndContextAndOptionalResponse) => {
  const {
    script,
    request,
    environment,
    timelinePath,
    baseEnvironment,
    clientCertificates,
    cookieJar,
    response,
    globals,
    baseGlobals,
    userUploadEnvironment,
    iteration,
    iterationCount,
    ancestors,
    eventName,
    execution,
    transientVariables,
    runtime,
    parentFolders,
    settings,
  } = context;
  invariant(script, 'script must be provided');

  // location is the complete path of a request, including project, collection and folder(if have).
  const requestLocation = ancestors
    .filter(
      doc =>
        isRequest(doc) || isRequestGroup(doc) || models.workspace.isWorkspace(doc) || models.project.isProject(doc),
    )
    .reverse()
    .map(doc => doc.name);
  let vault;
  if (globals && models.environment.vaultEnvironmentPath in globals.data && settings.enableVaultInScripts) {
    // decrypt and set vault in insomnia sdk if necessary
    globals.data[models.environment.vaultEnvironmentPath] = await maskOrDecryptVaultDataIfNecessary(
      globals.data[models.environment.vaultEnvironmentPath],
      'script',
    );
    vault = globals.data[models.environment.vaultEnvironmentPath];
  }

  try {
    const output = await runScript({
      script,
      context: {
        request,
        timelinePath,
        timeout: settings.timeout,
        // if the selected environment points to the base environment
        // script operations on the environment will be applied on the base environment
        environment: {
          id: environment._id,
          name: environment.name,
          data: environment.data || {},
        },
        baseEnvironment: {
          id: baseEnvironment._id,
          name: baseEnvironment.name,
          data: baseEnvironment.data || {},
        },
        clientCertificates,
        settings,
        cookieJar,
        requestInfo: {
          eventName: eventName === 'prerequest' ? 'prerequest' : 'test',
          iterationCount,
          iteration,
        },
        response,
        vault,
        globals: globals && {
          id: globals._id,
          name: globals.name,
          data: globals.data || {},
        },
        baseGlobals: baseGlobals && {
          id: baseGlobals._id,
          name: baseGlobals.name,
          data: baseGlobals.data || {},
        },
        iterationData: userUploadEnvironment
          ? {
              name: userUploadEnvironment.name,
              data: userUploadEnvironment.data || {},
            }
          : undefined,
        execution: {
          ...execution, // keep some existing properties in the after-response script from the pre-request script
          location: requestLocation,
        },
        transientVariables,
        logs: [],
        parentFolders,
      },
    });
    if ('error' in output) {
      return { error: `Script executor returns error: ${output.error}` };
    }

    const envPropertyOrder = orderedJSON.parse(
      JSON.stringify(output.environment.data),
      JSON_ORDER_PREFIX,
      JSON_ORDER_SEPARATOR,
    );
    environment.data = output.environment.data;
    environment.dataPropertyOrder = envPropertyOrder.map;

    const baseEnvPropertyOrder = orderedJSON.parse(
      JSON.stringify(output.baseEnvironment.data),
      JSON_ORDER_PREFIX,
      JSON_ORDER_SEPARATOR,
    );
    baseEnvironment.data = output.baseEnvironment.data;
    baseEnvironment.dataPropertyOrder = baseEnvPropertyOrder.map;

    if (globals) {
      const globalEnvPropertyOrder = orderedJSON.parse(
        JSON.stringify(output.globals?.data || {}),
        JSON_ORDER_PREFIX,
        JSON_ORDER_SEPARATOR,
      );
      globals.data = output.globals?.data || {};
      globals.dataPropertyOrder = globalEnvPropertyOrder.map;
    }

    if (baseGlobals) {
      const globalBaseEnvPropertyOrder = orderedJSON.parse(
        JSON.stringify(output.baseGlobals?.data || {}),
        JSON_ORDER_PREFIX,
        JSON_ORDER_SEPARATOR,
      );
      baseGlobals.data = output.baseGlobals?.data || {};
      baseGlobals.dataPropertyOrder = globalBaseEnvPropertyOrder.map;
    }

    if (userUploadEnvironment) {
      const userUploadEnvPropertyOrder = orderedJSON.parse(
        JSON.stringify(output?.iterationData?.data || []),
        JSON_ORDER_PREFIX,
        JSON_ORDER_SEPARATOR,
      );
      userUploadEnvironment.data = output?.iterationData?.data || [];
      userUploadEnvironment.dataPropertyOrder = userUploadEnvPropertyOrder.map;
    }

    if (runtime) {
      await runtime.appendTimeline(timelinePath, output.logs);
    }

    if (output?.transientVariables !== undefined) {
      const variablesPropertyOrder = orderedJSON.parse(
        JSON.stringify(output?.transientVariables?.data || {}),
        JSON_ORDER_PREFIX,
        JSON_ORDER_SEPARATOR,
      );
      transientVariables.data = output?.transientVariables?.data || {};
      transientVariables.dataPropertyOrder = variablesPropertyOrder.map;
    }

    return {
      request: output.request,
      environment,
      baseEnvironment,
      settings: output.settings,
      clientCertificates: output.clientCertificates,
      cookieJar: output.cookieJar,
      globals,
      baseGlobals,
      userUploadEnvironment,
      requestTestResults: output.requestTestResults,
      execution: output.execution,
      transientVariables,
      parentFolders: output.parentFolders,
    };
  } catch (err) {
    await appendToTimelineOnError(
      timelinePath,
      serializeNDJSON([{ value: err.message, name: 'Text', timestamp: Date.now() }]),
    );
    // stack trace is ignored as it is always from preload
    const errMessage = err.message ? err.message : err;
    return { error: errMessage };
  }
};

interface RequestContextForScript {
  request: Request;
  environment: Environment;
  timelinePath: string;
  responseId: string;
  baseEnvironment: Environment;
  clientCertificates: ClientCertificate[];
  cookieJar: CookieJar;
  ancestors: (Request | RequestGroup | Workspace | Project | MockRoute | MockServer)[];
  // there could be no global and no global base environment
  globals?: Environment;
  baseGlobals?: Environment;
  settings: Settings;
  execution?: ExecutionOption;
  transientVariables: Environment;
  parentFolders: { id: string; name: string; environment: Record<string, any> }[];
}

type RequestAndContextAndResponse = RequestContextForScript & {
  response: sendCurlAndWriteTimelineError | sendCurlAndWriteTimelineResponse;
  iteration?: number;
  iterationCount?: number;
  runtime: SendActionRuntime;
};

type RequestAndContextAndOptionalResponse = RequestContextForScript & {
  script: string;
  response?: sendCurlAndWriteTimelineError | sendCurlAndWriteTimelineResponse;
  userUploadEnvironment?: UserUploadEnvironment;
  iteration?: number;
  iterationCount?: number;
  eventName?: RequestContext['requestInfo']['eventName'];
  runtime?: SendActionRuntime;
  parentFolders: { id: string; name: string; environment: Record<string, any> }[];
};

export async function tryToExecuteAfterResponseScript(context: RequestAndContextAndResponse) {
  const requestGroups = context.ancestors.filter(doc => isRequest(doc) || isRequestGroup(doc)) as RequestGroup[];
  const folderScripts = requestGroups
    .reverse()
    .filter(group => group?.afterResponseScript)
    .map(
      (group, i) => `const fn${i} = async ()=>{
        ${group.afterResponseScript}
      }
      await fn${i}();
  `,
    );
  const originalRequestGroups = requestGroups.filter(group => isRequestGroup(group));

  if (folderScripts.length === 0) {
    return {
      ...context,
      requestTestResults: new Array<RequestTestResult>(),
    };
  }
  const joinedScript = [...folderScripts].join('\n');
  const postMutatedContext = await tryToExecuteScript({ script: joinedScript, ...context, eventName: 'test' });
  if (!postMutatedContext || 'error' in postMutatedContext) {
    return {
      error: `Execute after-response script failed: ${postMutatedContext?.error}`,
      ...context,
    };
  }

  // cookies from response should also be persisted
  const respondedWithoutError = context.response && !('error' in context.response);
  if (respondedWithoutError) {
    const resp = context.response as sendCurlAndWriteTimelineResponse;
    await savePatchesMadeByScript({
      mutatedContext: postMutatedContext,
      environment: context.environment,
      baseEnvironment: context.baseEnvironment,
      activeGlobalEnvironment: context.globals,
      activeGlobalBaseEnvironment: context.baseGlobals,
      originalRequestGroups: originalRequestGroups,
      responseCookies: resp.cookies,
    });
  } else {
    await savePatchesMadeByScript({
      mutatedContext: postMutatedContext,
      environment: context.environment,
      baseEnvironment: context.baseEnvironment,
      activeGlobalEnvironment: context.globals,
      activeGlobalBaseEnvironment: context.baseGlobals,
      originalRequestGroups: originalRequestGroups,
    });
  }

  const postTestResults: RequestTestResult[] = (postMutatedContext?.requestTestResults || []).map(result => ({
    ...result,
    category: 'after-response',
  }));

  return { ...postMutatedContext, requestTestResults: postTestResults };
}

export const tryToInterpolateRequest = async ({
  request,
  environment,
  purpose,
  extraInfo,
  baseEnvironment,
  userUploadEnvironment,
  transientVariables,
  ignoreUndefinedEnvVariable,
}: {
  request: Request;
  environment: string | Environment;
  purpose?: RenderPurpose;
  extraInfo?: { requestChain: string[] };
  baseEnvironment?: Environment;
  userUploadEnvironment?: UserUploadEnvironment;
  transientVariables?: Environment;
  ignoreUndefinedEnvVariable?: boolean;
}) => {
  try {
    return await getRenderedRequestAndContext({
      request: request,
      environment,
      baseEnvironment,
      userUploadEnvironment,
      transientVariables,
      purpose,
      extraInfo,
      ignoreUndefinedEnvVariable,
    });
  } catch (err) {
    if (err instanceof RenderError) {
      throw err;
    }
    throw new Error(`Failed to render request: ${request._id}`);
  }
};

export const tryToTransformRequestWithPlugins = async (renderResult: {
  request: RenderedRequest;
  context: Record<string, any>;
}) => {
  const { request, context } = renderResult;
  try {
    return await applyRequestHooks(request, context);
  } catch {
    throw new Error(`Failed to transform request with plugins: ${request._id}`);
  }
};

export interface sendCurlAndWriteTimelineError {
  _id: string;
  parentId: string;
  timelinePath: string;
  statusMessage: string;
  // additional
  url: string;
  error: string;
  elapsedTime: number;
  bytesRead: number;
}

export interface sendCurlAndWriteTimelineResponse extends ResponsePatch {
  _id: string;
  parentId: string;
  timelinePath: string;
  statusMessage: string;
  cookies: Cookie[];
  timeline: string[];
  bytesRead?: number;
}

export async function sendCurlAndWriteTimeline(
  renderedRequest: RenderedRequest,
  clientCertificates: ClientCertificate[],
  caCert: CaCertificate | undefined,
  settings: Settings,
  timelinePath: string,
  responseId: string,
  runtime: SendActionRuntime = defaultSendActionRuntime,
): Promise<sendCurlAndWriteTimelineError | sendCurlAndWriteTimelineResponse> {
  const requestId = renderedRequest._id;
  const timeline: ResponseTimelineEntry[] = [];
  const authentication = renderedRequest.authentication as RequestAuthentication;

  const { finalUrl, socketPath } = transformUrl(
    renderedRequest.url,
    renderedRequest.parameters,
    authentication,
    renderedRequest.settingEncodeUrl,
  );
  timeline.push(
    { value: `Preparing request to ${finalUrl}`, name: 'Text', timestamp: Date.now() },
    { value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() },
    {
      value: `${renderedRequest.settingEncodeUrl ? 'Enable' : 'Disable'} automatic URL encoding`,
      name: 'Text',
      timestamp: Date.now(),
    },
  );

  if (!renderedRequest.settingSendCookies) {
    timeline.push({ value: 'Disable cookie sending due to user setting', name: 'Text', timestamp: Date.now() });
  }
  const authHeader = await getAuthHeader(renderedRequest, finalUrl);
  const requestOptions = {
    requestId,
    req: renderedRequest,
    finalUrl,
    socketPath,
    settings,
    certificates: filterClientCertificates(clientCertificates, renderedRequest.url, 'https:'),
    caCertficatePath: caCert?.disabled === false ? caCert.path : null,
    authHeader,
  };

  const output = await executeCurlRequest(requestOptions);

  if ('error' in output) {
    if (runtime) {
      await runtime.appendTimeline(timelinePath, serializeNDJSON(timeline).split('\n'));
    }

    return {
      _id: responseId,
      parentId: requestId,
      url: requestOptions.finalUrl,
      error: output.error,
      elapsedTime: 0, // 0 because this path is hit during plugin calls
      bytesRead: 0,
      statusMessage: output.statusMessage,
      timelinePath,
      timeline: serializeNDJSON(timeline).split('\n'),
    };
  }
  const { patch, debugTimeline, headerResults, responseBodyPath } = output;
  // todo: move to main process
  debugTimeline.forEach(entry => timeline.push(entry));
  // transform output
  const { cookies, rejectedCookies, totalSetCookies } = await extractCookies(
    headerResults,
    renderedRequest.cookieJar,
    finalUrl,
    renderedRequest.settingStoreCookies,
  );
  rejectedCookies.forEach(errorMessage =>
    timeline.push({ value: `Rejected cookie: ${errorMessage}`, name: 'Text', timestamp: Date.now() }),
  );
  if (totalSetCookies) {
    await services.cookieJar.update(renderedRequest.cookieJar, { cookies });
    timeline.push({ value: `Saved ${totalSetCookies} cookies`, name: 'Text', timestamp: Date.now() });
  }
  const lastRedirect = headerResults[headerResults.length - 1];

  if (runtime) {
    await runtime.appendTimeline(timelinePath, serializeNDJSON(timeline).split('\n'));
  }

  return {
    _id: responseId,
    parentId: renderedRequest._id,
    timelinePath,
    bodyPath: responseBodyPath,
    contentType: getContentTypeHeader(lastRedirect.headers)?.value || '',
    headers: lastRedirect.headers,
    httpVersion: lastRedirect.version,
    statusCode: lastRedirect.code,
    statusMessage: lastRedirect.reason,
    cookies,
    timeline: serializeNDJSON(timeline).split('\n'),
    ...patch,
  };
}

// Apply plugins to response
export const responseTransform = async (
  patch: ResponsePatch,
  environmentId: string | null,
  renderedRequest: RenderedRequest,
  context: Record<string, any>,
) => {
  const response: ResponsePatch = {
    ...patch,
    // important for filter by responses
    environmentId,
    globalEnvironmentId: context?.getGlobalEnvironmentId?.() || null,
    bodyCompression: null,
    settingSendCookies: renderedRequest.settingSendCookies,
    settingStoreCookies: renderedRequest.settingStoreCookies,
  };

  if (response.error) {
    console.log(`[network] Response failed req=${patch.parentId} err=${response.error || 'n/a'}`);
    return response;
  }
  console.log(`[network] Response succeeded req=${patch.parentId} status=${response.statusCode || '?'}`);
  try {
    return await applyResponseHooks(response, renderedRequest, context);
  } catch (err) {
    console.log('[plugin] Response hook failed', err, response);
    return {
      url: renderedRequest.url,
      error: `[plugin] Response hook failed err=${err instanceof Error ? err.message : String(err)}`,
      elapsedTime: 0, // 0 because this path is hit during plugin calls
      statusMessage: 'Error',
      settingSendCookies: renderedRequest.settingSendCookies,
      settingStoreCookies: renderedRequest.settingStoreCookies,
    };
  }
};
export function getAuthQueryParams(authentication: RequestAuthentication) {
  if (authentication.disabled) {
    return;
  }

  if (authentication.type === 'apikey' && authentication.addTo === QUERY_PARAMS) {
    const { key, value } = authentication;
    return {
      name: key,
      value: value,
    } as RequestParameter;
  }

  return;
}
export const transformUrl = (
  url: string,
  params: RequestParameter[],
  authentication: RequestAuthentication,
  shouldEncode: boolean,
) => {
  const authQueryParam = getAuthQueryParams(authentication);
  const customUrl = joinUrlAndQueryString(
    url,
    buildQueryStringFromParams(authQueryParam ? params.concat([authQueryParam]) : params, true, {
      strictNullHandling: true,
    }),
  );
  const isUnixSocket = customUrl.match(/https?:\/\/unix:\//);
  if (!isUnixSocket) {
    return { finalUrl: smartEncodeUrl(customUrl, shouldEncode, { strictNullHandling: true }) };
  }
  // URL prep will convert "unix:/path" hostname to "unix/path"
  const match = smartEncodeUrl(customUrl, shouldEncode, { strictNullHandling: true }).match(
    /(https?:)\/\/unix:?(\/[^:]+):\/(.+)/,
  );
  const protocol = (match && match[1]) || '';
  const socketPath = (match && match[2]) || '';
  const socketUrl = (match && match[3]) || '';
  return { finalUrl: `${protocol}//${socketUrl}`, socketPath };
};

const extractCookies = async (
  headerResults: HeaderResult[],
  cookieJar: any,
  finalUrl: string,
  settingStoreCookies: boolean,
) => {
  // add set-cookie headers to file(cookiejar) and database
  if (settingStoreCookies) {
    // supports many set-cookies over many redirects
    const redirects: string[][] = headerResults.map(({ headers }: any) => getSetCookiesFromResponseHeaders(headers));
    const setCookieStrings: string[] = redirects.flat();
    const totalSetCookies = setCookieStrings.length;
    if (totalSetCookies) {
      const currentUrl = getCurrentUrl({ headerResults, finalUrl });
      const { cookies, rejectedCookies } = await addSetCookiesToToughCookieJar({
        setCookieStrings,
        currentUrl,
        cookieJar,
      });
      const hasCookiesToPersist = totalSetCookies > rejectedCookies.length;
      if (hasCookiesToPersist) {
        return { cookies, rejectedCookies, totalSetCookies };
      }
    }
  }
  return { cookies: [], rejectedCookies: [], totalSetCookies: 0 };
};

export const getSetCookiesFromResponseHeaders = (headers: any[]) => getSetCookieHeaders(headers).map(h => h.value);

export const getCurrentUrl = ({ headerResults, finalUrl }: { headerResults: any; finalUrl: string }): string => {
  if (!headerResults || !headerResults.length) {
    return finalUrl;
  }
  const lastRedirect = headerResults[headerResults.length - 1];
  const location = getLocationHeader(lastRedirect.headers);
  if (!location || !location.value) {
    return finalUrl;
  }
  try {
    return new URL(location.value, finalUrl).toString();
  } catch {
    return finalUrl;
  }
};

export const defaultSendActionRuntime: SendActionRuntime = {
  appendTimeline: appendTimelineLines,
};
