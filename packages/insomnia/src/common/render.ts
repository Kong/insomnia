import clone from 'clone';
import orderedJSON from 'json-order';

import * as models from '../models';
import {
  type Environment,
  type UserUploadEnvironment,
  vaultEnvironmentPath,
  vaultEnvironmentRuntimePath,
} from '../models/environment';
import type { GrpcRequest, GrpcRequestBody } from '../models/grpc-request';
import { isProject } from '../models/project';
import { PATH_PARAMETER_REGEX, type Request } from '../models/request';
import { isRequestGroup, type RequestGroup } from '../models/request-group';
import type { SocketIORequest } from '../models/socket-io-request';
import type { WebSocketRequest } from '../models/websocket-request';
import { isWorkspace, type Workspace } from '../models/workspace';
import { getOrInheritAuthentication, getOrInheritHeaders } from '../network/network';
import * as templating from '../templating';
import { RenderError } from '../templating/render-error';
import type {
  BaseRenderContext,
  BaseRenderContextOptions,
  RenderContextAncestor,
  RenderContextOptions,
  RenderedRequest,
  RenderInputType,
} from '../templating/types';
import * as templatingUtils from '../templating/utils';
import { maskOrDecryptVaultDataIfNecessary } from '../templating/utils';
import { setDefaultProtocol } from '../utils/url/protocol';
import { CONTENT_TYPE_GRAPHQL, JSON_ORDER_SEPARATOR } from './constants';
import { database as db } from './database';

export async function buildRenderContext({
  ancestors,
  rootEnvironment,
  subEnvironment,
  rootGlobalEnvironment,
  subGlobalEnvironment,
  userUploadEnvironment,
  transientVariables,
  baseContext,
}: {
  ancestors?: RenderContextAncestor[];
  rootEnvironment?: Environment;
  subEnvironment?: Environment;
  rootGlobalEnvironment?: Environment | null;
  subGlobalEnvironment?: Environment | null;
  userUploadEnvironment?: UserUploadEnvironment;
  transientVariables?: Environment;
  baseContext: BaseRenderContext;
}): Promise<BaseRenderContext> {
  const envObjects: Record<string, any>[] = [];

  if (rootGlobalEnvironment) {
    const ordered = orderedJSON.order(
      rootGlobalEnvironment.data,
      rootGlobalEnvironment.dataPropertyOrder,
      JSON_ORDER_SEPARATOR,
    );
    envObjects.push(ordered);
  }

  if (subGlobalEnvironment) {
    const ordered = orderedJSON.order(
      subGlobalEnvironment.data,
      subGlobalEnvironment.dataPropertyOrder,
      JSON_ORDER_SEPARATOR,
    );
    envObjects.push(ordered);
  }

  // Get root environment keys in correct order
  // Then get sub environment keys in correct order
  // Then get ancestor (folder) environment keys in correct order
  if (rootEnvironment) {
    const ordered = orderedJSON.order(rootEnvironment.data, rootEnvironment.dataPropertyOrder, JSON_ORDER_SEPARATOR);
    envObjects.push(ordered);
  }

  if (subEnvironment) {
    const ordered = orderedJSON.order(subEnvironment.data, subEnvironment.dataPropertyOrder, JSON_ORDER_SEPARATOR);
    envObjects.push(ordered);
  }

  for (const doc of (ancestors || []).reverse()) {
    const ancestor: any = doc;
    const { environment, environmentPropertyOrder } = ancestor;

    if (typeof environment === 'object' && environment !== null) {
      const ordered = orderedJSON.order(environment, environmentPropertyOrder, JSON_ORDER_SEPARATOR);
      envObjects.push(ordered);
    }
  }

  // user upload env in collection runner has highest priority except local variables
  if (userUploadEnvironment) {
    const ordered = orderedJSON.order(
      userUploadEnvironment.data,
      userUploadEnvironment.dataPropertyOrder,
      JSON_ORDER_SEPARATOR,
    );
    envObjects.push(ordered);
  }

  // script local variables (insomnia.variable.set) has highest priority
  if (transientVariables) {
    const ordered = orderedJSON.order(
      transientVariables.data,
      transientVariables.dataPropertyOrder,
      JSON_ORDER_SEPARATOR,
    );
    envObjects.push(ordered);
  }

  // At this point, environments is a list of environments ordered
  // from top-most parent to bottom-most child, and they keys in each environment
  // ordered by its property map.
  // Do an Object.assign, but render each property as it overwrites. This
  // way we can keep same-name variables from the parent context.
  const renderContext = baseContext;

  // Made the rendering into a recursive function to handle nested Objects
  async function renderSubContext(subObject: Record<string, any>, subContext: BaseRenderContext) {
    const keys = _getOrderedEnvironmentKeys(subObject);

    for (const key of keys) {
      /*
       * If we're overwriting a string, try to render it first using the same key from the base
       * environment to support same-variable recursion. This allows for the following scenario:
       *
       * base:  { base_url: 'google.com' }
       * obj:   { base_url: '{{ base_url }}/foo' }
       * final: { base_url: 'google.com/foo' }
       *
       * A regular Object.assign would yield { base_url: '{{ base_url }}/foo' } and the
       * original base_url of google.com would be lost.
       */
      if (Object.prototype.toString.call(subObject[key]) === '[object String]') {
        const isSelfRecursive = subObject[key].match(`{{ ?${key}[ |][^}]*}}`);

        if (isSelfRecursive) {
          // If we're overwriting a variable that contains itself, make sure we
          // render it first
          subContext[key] = await render(
            subObject[key],
            subContext, // Only render with key being overwritten
            null,
            'keep',
            'Environment',
          );
        } else {
          // Otherwise it's just a regular replacement
          subContext[key] = subObject[key];
        }
      } else if (Object.prototype.toString.call(subContext[key]) === '[object Object]') {
        // Context is of Type object, Call this function recursively to handle nested objects.
        subContext[key] = await renderSubContext(subObject[key], subContext[key]);
      } else {
        // For all other Types, add the Object to the Context.
        subContext[key] = subObject[key];
      }
    }

    return subContext;
  }
  let finalRenderContext = { ...renderContext };

  for (const envObject of envObjects) {
    // For every environment render the Objects
    finalRenderContext = await renderSubContext(envObject, finalRenderContext);
  }

  const vaultEnvironmentData = await maskOrDecryptVaultDataIfNecessary(
    finalRenderContext[vaultEnvironmentPath],
    renderContext?.getPurpose(),
  );
  if (vaultEnvironmentData) {
    // avoid add undefined data to render context
    finalRenderContext[vaultEnvironmentPath] = vaultEnvironmentData;
  }
  // Merge all vault environments under vaultEnvironmentPath to vaultEnvironmentRuntimePath which is more human readable.
  // This will also keep all legacy environment variables defined under the vaultEnvironmentRuntimePath.
  if (finalRenderContext[vaultEnvironmentPath]) {
    if (
      finalRenderContext[vaultEnvironmentRuntimePath] &&
      typeof finalRenderContext[vaultEnvironmentRuntimePath] !== 'object'
    ) {
      const errorMsg = `${vaultEnvironmentRuntimePath} is a reserved key for insomnia vault, please rename your environment with vault as key.`;
      const newError = new RenderError(errorMsg);
      newError.type = 'render';
      newError.message = errorMsg;
      throw newError;
    }
    finalRenderContext[vaultEnvironmentRuntimePath] = {
      ...finalRenderContext[vaultEnvironmentPath],
      ...finalRenderContext[vaultEnvironmentRuntimePath],
    };
    delete finalRenderContext[vaultEnvironmentPath];
  }

  const keys = _getOrderedEnvironmentKeys(finalRenderContext);

  // Render recursive references and tags.
  const skipNextTime: Record<string, boolean> = {};

  for (let i = 0; i < 3; i++) {
    for (const key of keys) {
      // Skip rendering keys that stayed the same multiple times. This is here because
      // a render failure will leave the tag as-is and thus the next iteration of the
      // loop will try to re-render it again. We don't want to keep erroring on these
      // because renders are expensive and potentially not idempotent.
      if (skipNextTime[key]) {
        continue;
      }

      const renderResult = await render(finalRenderContext[key], finalRenderContext, null, 'keep', 'Environment');

      // Result didn't change, so skip
      if (renderResult === finalRenderContext[key]) {
        skipNextTime[key] = true;
        continue;
      }

      finalRenderContext[key] = renderResult;
    }
  }

  return finalRenderContext;
}
const renderInThisProcess = async (input: RenderInputType) => {
  return templating.render(input.input, {
    context: input.context,
    path: input.path,
    ignoreUndefinedEnvVariable: input.ignoreUndefinedEnvVariable,
  });
};
/**
 * Recursively render any JS object and return a new one
 * @param {*} obj - object to render
 * @param {object} context - context to render against
 * @param blacklistPathRegex - don't render these paths
 * @param errorMode - how to handle errors
 * @param name - name to include in error message
 * @return {Promise.<*>}
 */
export async function render<T>(
  obj: T,
  context: BaseRenderContext,
  blacklistPathRegex: RegExp | null = null,
  errorMode: 'keep' | 'throw' = 'throw',
  name = '',
  ignoreUndefinedEnvVariable = false,
) {
  // Make a deep copy so no one gets mad :)
  const newObj = clone(obj);

  const undefinedEnvironmentVariables: string[] = [];

  async function next<T>(input: T, path: string, first = false) {
    if (blacklistPathRegex && path.match(blacklistPathRegex)) {
      return input;
    }

    const asStr = Object.prototype.toString.call(input);

    // Leave these types alone
    if (
      asStr === '[object Date]' ||
      asStr === '[object RegExp]' ||
      asStr === '[object Error]' ||
      asStr === '[object Boolean]' ||
      asStr === '[object Number]' ||
      asStr === '[object Null]' ||
      asStr === '[object Undefined]'
    ) {
      // Do nothing to these types
    } else if (typeof input === 'string') {
      const hasNunjucksInterpolationSymbols = input.includes('{{') && input.includes('}}');
      const hasNunjucksCustomTagSymbols = input.includes('{%') && input.includes('%}');
      const hasNunjucksCommentSymbols = input.includes('{#') && input.includes('#}');

      if (!hasNunjucksInterpolationSymbols && !hasNunjucksCustomTagSymbols && !hasNunjucksCommentSymbols) {
        return input;
      }

      if (input === '') {
        return input;
      }

      try {
        // Some plugins may, at the moment, require unique and intrusive access. Templates exposed by these
        // plugins will not function correctly when rendering in a separate process or thread. The user can
        // explicitly configure rendering to happen on the same thread/process as the rest of the app, in
        // which case it's okay to render locally.

        const settings = await models.settings.get();
        const pluginsAreRestrictedToRunInWorker = settings?.pluginsAllowElevatedAccess === false;
        const currentProcessIsRendererAndPluginsAreRestricted =
          process.type === 'renderer' && pluginsAreRestrictedToRunInWorker;
        const renderFork = currentProcessIsRendererAndPluginsAreRestricted
          ? (await import('../ui/worker/templating-handler')).renderInWorker
          : renderInThisProcess;

        // @ts-expect-error -- TSCONVERSION
        input = await renderFork({ input, context, path, ignoreUndefinedEnvVariable });

        // If the variable outputs a tag, render it again. This is a common use
        // case for environment variables:
        //   {{ foo }} => {% uuid 'v4' %} => dd265685-16a3-4d76-a59c-e8264c16835a
        // @ts-expect-error -- TSCONVERSION
        if (input.includes('{%')) {
          // @ts-expect-error -- TSCONVERSION
          input = await renderFork({ input, context, path, ignoreUndefinedEnvVariable });
        }
      } catch (err) {
        console.log(`Failed to render element ${path}`, input);
        if (errorMode !== 'keep') {
          if (err?.extraInfo?.subType === 'environmentVariable') {
            undefinedEnvironmentVariables.push(...err.extraInfo.undefinedEnvironmentVariables);
          } else {
            throw err;
          }
        }
      }
    } else if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i++) {
        input[i] = await next(input[i], `${path}[${i}]`);
      }
    } else if (typeof input === 'object' && input !== null) {
      // Don't even try rendering disabled objects
      // Note, this logic probably shouldn't be here, but w/e for now
      // @ts-expect-error -- TSCONVERSION
      if (input.disabled) {
        return input;
      }

      const keys = Object.keys(input);

      for (const key of keys) {
        if (first && key.indexOf('_') === 0) {
          // @ts-expect-error -- mapping unsoundness
          input[key] = await next(input[key], path);
        } else {
          const pathPrefix = path ? path + '.' : '';
          // @ts-expect-error -- mapping unsoundness
          input[key] = await next(input[key], `${pathPrefix}${key}`);
        }
      }
    }

    return input;
  }

  const renderResult = await next<T>(newObj, name, true);
  if (undefinedEnvironmentVariables.length > 0) {
    const error = new RenderError(
      `Failed to render environment variables: ${undefinedEnvironmentVariables.join(', ')}`,
    );
    error.type = 'render';
    error.extraInfo = {
      subType: 'environmentVariable',
      undefinedEnvironmentVariables,
    };
    throw error;
  }

  return renderResult;
}

export async function getRenderContext({
  request,
  environment,
  baseEnvironment,
  userUploadEnvironment,
  transientVariables,
  ancestors: _ancestors,
  purpose,
  extraInfo,
}: RenderContextOptions): Promise<BaseRenderContext> {
  const ancestors = _ancestors || (await getRenderContextAncestors(request));

  const project = ancestors.find(isProject);
  const workspace = ancestors.find(isWorkspace);
  if (!workspace) {
    throw new Error('Failed to render. Could not find workspace');
  }

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspace._id);

  let rootGlobalEnvironment: Environment | null = null;
  let subGlobalEnvironment: Environment | null = null;

  if (workspaceMeta?.activeGlobalEnvironmentId) {
    const activeGlobalEnvironment = await models.environment.getById(workspaceMeta.activeGlobalEnvironmentId);

    if (activeGlobalEnvironment) {
      if (activeGlobalEnvironment?.parentId.startsWith('wrk_')) {
        rootGlobalEnvironment = activeGlobalEnvironment;
      } else {
        subGlobalEnvironment = activeGlobalEnvironment;

        const baseGlobalEnvironment = await models.environment.getById(activeGlobalEnvironment.parentId);

        if (baseGlobalEnvironment) {
          rootGlobalEnvironment = baseGlobalEnvironment;
        }
      }
    }
  }

  const rootEnvironment =
    baseEnvironment || (await models.environment.getOrCreateForParentId(workspace ? workspace._id : 'n/a'));
  const subEnvironmentId = environment ? (typeof environment === 'string' ? environment : environment._id) : 'n/a';
  const subEnvironment = environment
    ? typeof environment === 'string'
      ? await models.environment.getById(environment)
      : environment
    : await models.environment.getById('n/a');

  const keySource: Record<string, string> = {};
  // Function that gets Keys and stores their Source location
  function getKeySource(subObject: string | Record<string, any>, inKey: string, inSource: string) {
    // Add key to map if it's not root
    if (inKey) {
      keySource[templatingUtils.normalizeToDotAndBracketNotation(inKey)] = inSource;
    }

    // Recurse down for Objects and Arrays
    const typeStr = Object.prototype.toString.call(subObject);

    if (typeStr === '[object Object]') {
      for (const key of Object.keys(subObject)) {
        // @ts-expect-error -- mapping unsoundness
        getKeySource(subObject[key], templatingUtils.forceBracketNotation(inKey, key), inSource);
      }
    } else if (typeStr === '[object Array]' && Array.isArray(subObject)) {
      for (const [i, element] of subObject.entries()) {
        getKeySource(element, templatingUtils.forceBracketNotation(inKey, i), inSource);
      }
    }
  }

  const inKey = templating.NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME;

  if (rootGlobalEnvironment) {
    getKeySource(rootGlobalEnvironment.data || {}, inKey, 'rootGlobal');
  }

  if (subGlobalEnvironment) {
    getKeySource(subGlobalEnvironment.data || {}, inKey, 'subGlobal');
  }

  // Get Keys from root environment
  getKeySource((rootEnvironment || {}).data, inKey, 'root');

  // Get Keys from sub environment
  if (subEnvironment) {
    getKeySource(subEnvironment.data || {}, inKey, subEnvironment.name || '');
  }

  // Get Keys from ancestors (e.g. Folders)
  if (ancestors) {
    for (const ancestor of ancestors) {
      if (isRequestGroup(ancestor) && 'environment' in ancestor && 'name' in ancestor) {
        getKeySource(ancestor.environment || {}, inKey, ancestor.name || '');
      }
    }
  }

  // Get Keys from user upload environment
  if (userUploadEnvironment) {
    getKeySource(userUploadEnvironment.data || {}, inKey, userUploadEnvironment.name || 'uploadData');
  }

  if (transientVariables) {
    getKeySource(transientVariables.data || {}, inKey, transientVariables.name || 'scriptLocalVariables');
  }

  const settings = await models.settings.get();

  // Add meta data helper function
  const baseContext: BaseRenderContext = {
    getMeta: () => ({
      requestId: request?._id,
      workspaceId: workspace?._id,
    }),
    getKeysContext: () => ({
      keyContext: keySource,
    }),
    getPurpose: () => purpose,
    getExtraInfo: () => extraInfo,
    getEnvironmentId: () => subEnvironmentId,
    getGlobalEnvironmentId: () => subGlobalEnvironment?._id || rootGlobalEnvironment?._id,
    // It is possible for a project to not exist because this code path can be reached via Inso which has no concept of a project.
    getProjectId: () => project?._id,
    getSettings: () => ({ dataFolders: settings.dataFolders }),
  };

  // Generate the context we need to render
  return buildRenderContext({
    ancestors,
    rootGlobalEnvironment,
    subGlobalEnvironment,
    rootEnvironment,
    subEnvironment: subEnvironment || undefined,
    userUploadEnvironment,
    transientVariables,
    baseContext,
  });
}

export async function getRenderedGrpcRequest({
  purpose,
  extraInfo,
  request,
  environment,
  skipBody,
}: BaseRenderContextOptions & { request: GrpcRequest; skipBody?: boolean }) {
  const renderContext = await getRenderContext({ request, environment, purpose, extraInfo });
  const description = request.description;
  // Render description separately because it's lower priority
  request.description = '';
  // Ignore body by default and only include if specified to
  const ignorePathRegex = skipBody ? /^body.*/ : null;
  // Render all request properties
  const renderedRequest: GrpcRequest = await render(request, renderContext, ignorePathRegex);
  renderedRequest.description = await render(description, renderContext, null, 'keep');
  return renderedRequest;
}

export async function getRenderedGrpcRequestMessage({
  environment,
  request,
  extraInfo,
  purpose,
}: BaseRenderContextOptions & { request: GrpcRequest }) {
  const renderContext = await getRenderContext({ request, environment, purpose, extraInfo });
  // Render request body
  const renderedBody: GrpcRequestBody = await render(request.body, renderContext);
  return renderedBody;
}

export async function getRenderedRequestAndContext({
  request,
  environment,
  baseEnvironment,
  userUploadEnvironment,
  transientVariables,
  extraInfo,
  purpose,
  ignoreUndefinedEnvVariable,
}: BaseRenderContextOptions & { request: Request }): Promise<{
  request: RenderedRequest;
  context: Record<string, any>;
}> {
  const ancestors = await getRenderContextAncestors(request);
  const workspace = ancestors.find(isWorkspace);
  const requestGroups = ancestors.filter(isRequestGroup);

  const parentId = workspace ? workspace._id : 'n/a';
  const cookieJar = await models.cookieJar.getOrCreateForParentId(parentId);
  const renderContext = await getRenderContext({
    request,
    environment,
    ancestors,
    purpose,
    extraInfo,
    baseEnvironment,
    userUploadEnvironment,
    transientVariables,
  });

  // HACK: Switch '#}' to '# }' to prevent Nunjucks from barfing
  // https://github.com/kong/insomnia/issues/895
  try {
    if (request.body.text && request.body.mimeType === CONTENT_TYPE_GRAPHQL) {
      const o = JSON.parse(request.body.text);
      o.query = o.query.replace(/#}/g, '# }');
      request.body.text = JSON.stringify(o);
    }
  } catch (err) {}

  // Render description separately because it's lower priority
  const description = request.description;
  request.description = '';

  request.headers = getOrInheritHeaders({ request, requestGroups });
  request.authentication = getOrInheritAuthentication({ request, requestGroups });
  // Render all request properties
  const renderResult = await render(
    {
      _request: request,
      _cookieJar: cookieJar,
    },
    renderContext,
    request.settingDisableRenderRequestBody ? /^body.*/ : null,
    'throw',
    '',
    ignoreUndefinedEnvVariable,
  );

  const renderedRequest = renderResult._request;
  const renderedCookieJar = renderResult._cookieJar;
  renderedRequest.description = await render(description, renderContext, null, 'keep');
  const userAgentHeaders = request.headers.filter(h => h.name.toLowerCase() === 'user-agent');
  const noUserAgents = userAgentHeaders.length === 0;
  const allUserAgentHeadersDisabled = userAgentHeaders.every(h => h.disabled === true);
  const suppressUserAgent = noUserAgents || allUserAgentHeadersDisabled;
  // Remove disabled params
  renderedRequest.parameters = renderedRequest.parameters.filter(p => !p.disabled);
  // Remove disabled headers
  renderedRequest.headers = renderedRequest.headers.filter(p => !p.disabled);

  // Remove disabled body params
  if (renderedRequest.body && Array.isArray(renderedRequest.body.params)) {
    renderedRequest.body.params = renderedRequest.body.params.filter(p => !p.disabled);
  }

  // Remove disabled authentication
  if (
    renderedRequest.authentication &&
    'disabled' in renderedRequest.authentication &&
    renderedRequest.authentication.disabled
  ) {
    renderedRequest.authentication = {};
  }

  // Default the proto if it doesn't exist
  renderedRequest.url = setDefaultProtocol(renderedRequest.url);

  // Render path parameters
  if (renderedRequest.pathParameters) {
    // Replace path parameters in URL with their rendered values
    // Path parameters are path segments that start with a colon, e.g. :id
    renderedRequest.url = renderedRequest.url.replace(PATH_PARAMETER_REGEX, match => {
      const paramName = match.replace('\/:', '');
      const param = renderedRequest.pathParameters?.find(p => p.name === paramName);

      if (param && param.value) {
        // The parameter value needs to be URL encoded
        return `/${encodeURIComponent(param.value)}`;
      }

      return match;
    });
  }

  return {
    context: renderContext,
    request: {
      suppressUserAgent,
      cookieJar: renderedCookieJar,
      cookies: [],
      isPrivate: false,
      _id: renderedRequest._id,
      authentication: renderedRequest.authentication,
      pathParameters: renderedRequest.pathParameters,
      body: renderedRequest.body,
      created: renderedRequest.created,
      modified: renderedRequest.modified,
      description: renderedRequest.description,
      headers: renderedRequest.headers,
      metaSortKey: renderedRequest.metaSortKey,
      method: renderedRequest.method,
      name: renderedRequest.name,
      parameters: renderedRequest.parameters,
      parentId: renderedRequest.parentId,
      settingDisableRenderRequestBody: renderedRequest.settingDisableRenderRequestBody,
      settingEncodeUrl: renderedRequest.settingEncodeUrl,
      settingSendCookies: renderedRequest.settingSendCookies,
      settingStoreCookies: renderedRequest.settingStoreCookies,
      settingRebuildPath: renderedRequest.settingRebuildPath,
      settingFollowRedirects: renderedRequest.settingFollowRedirects,
      type: renderedRequest.type,
      url: renderedRequest.url,
      preRequestScript: renderedRequest.preRequestScript,
      afterResponseScript: renderedRequest.afterResponseScript,
    },
  };
}

/**
 * Sort the keys that may have Nunjucks last, so that other keys get
 * defined first. Very important if env variables defined in same obj
 * (eg. {"foo": "{{ bar }}", "bar": "Hello World!"})
 *
 * @param v
 * @returns {number}
 */
function _nunjucksSortValue(v: string) {
  return v?.match?.(/({{|{%)/) ? 2 : 1;
}

function _getOrderedEnvironmentKeys(finalRenderContext: Record<string, any>): string[] {
  return Object.keys(finalRenderContext).sort((k1, k2) => {
    const k1Sort = _nunjucksSortValue(finalRenderContext[k1]);

    const k2Sort = _nunjucksSortValue(finalRenderContext[k2]);

    return k1Sort - k2Sort;
  });
}

export async function getRenderContextAncestors(
  base?: Request | GrpcRequest | WebSocketRequest | SocketIORequest | RequestGroup | Workspace,
): Promise<RenderContextAncestor[]> {
  return await db.withAncestors<RenderContextAncestor>(base, [
    models.request.type,
    models.grpcRequest.type,
    models.webSocketRequest.type,
    models.requestGroup.type,
    models.workspace.type,
    models.project.type,
    models.mockRoute.type,
    models.mockServer.type,
  ]);
}
