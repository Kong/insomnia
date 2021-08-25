import clone from 'clone';
import { setDefaultProtocol } from 'insomnia-url';
import orderedJSON from 'json-order';

import * as models from '../models';
import type { CookieJar } from '../models/cookie-jar';
import type { Environment } from '../models/environment';
import type { GrpcRequest, GrpcRequestBody } from '../models/grpc-request';
import { isProject, Project } from '../models/project';
import type { Request } from '../models/request';
import { isRequestGroup, RequestGroup } from '../models/request-group';
import { isWorkspace, Workspace } from '../models/workspace';
import * as templating from '../templating';
import * as templatingUtils from '../templating/utils';
import { CONTENT_TYPE_GRAPHQL, JSON_ORDER_SEPARATOR } from './constants';
import { database as db } from './database';

export const KEEP_ON_ERROR = 'keep';
export const THROW_ON_ERROR = 'throw';
export type RenderPurpose = 'send' | 'general' | 'no-render';
export const RENDER_PURPOSE_SEND: RenderPurpose = 'send';
export const RENDER_PURPOSE_GENERAL: RenderPurpose = 'general';
export const RENDER_PURPOSE_NO_RENDER: RenderPurpose = 'no-render';

/** Key/value pairs to be provided to the render context */
export type ExtraRenderInfo = {
  name: string;
  value: any;
}[];

export type RenderedRequest = Request & {
  cookies: {
    name: string;
    value: string;
    disabled?: boolean;
  }[];
  cookieJar: CookieJar;
};

export type RenderedGrpcRequest = GrpcRequest;

export type RenderedGrpcRequestBody = GrpcRequestBody;

export interface RenderContextAndKeys {
  context: Record<string, any>;
  keys: {
    name: string;
    value: any;
  }[]
}

export type HandleGetRenderContext = () => Promise<RenderContextAndKeys>;

export type HandleRender = <T>(object: T, contextCacheKey?: string | null) => Promise<T>;

export async function buildRenderContext(
  {
    ancestors,
    rootEnvironment,
    subEnvironment,
    baseContext = {},
  }: {
    ancestors?: RenderContextAncestor[];
    rootEnvironment?: Environment;
    subEnvironment?: Environment;
    baseContext?: Record<string, any>;
  },
) {
  const envObjects: Record<string, any>[] = [];

  // Get root environment keys in correct order
  // Then get sub environment keys in correct order
  // Then get ancestor (folder) environment keys in correct order
  if (rootEnvironment) {
    const ordered = orderedJSON.order(
      rootEnvironment.data,
      rootEnvironment.dataPropertyOrder,
      JSON_ORDER_SEPARATOR,
    );
    envObjects.push(ordered);
  }

  if (subEnvironment) {
    const ordered = orderedJSON.order(
      subEnvironment.data,
      subEnvironment.dataPropertyOrder,
      JSON_ORDER_SEPARATOR,
    );
    envObjects.push(ordered);
  }

  for (const doc of (ancestors || []).reverse()) {
    const ancestor: any = doc;
    const { environment, environmentPropertyOrder } = ancestor;

    if (typeof environment === 'object' && environment !== null) {
      const ordered = orderedJSON.order(
        environment,
        environmentPropertyOrder,
        JSON_ORDER_SEPARATOR,
      );
      envObjects.push(ordered);
    }
  }

  // At this point, environments is a list of environments ordered
  // from top-most parent to bottom-most child, and they keys in each environment
  // ordered by its property map.
  // Do an Object.assign, but render each property as it overwrites. This
  // way we can keep same-name variables from the parent context.
  let renderContext = baseContext;

  // Made the rendering into a recursive function to handle nested Objects
  async function renderSubContext(
    subObject: Record<string, any>,
    subContext: Record<string, any>,
  ) {
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
            KEEP_ON_ERROR,
            'Environment',
          );
        } else {
          // Otherwise it's just a regular replacement
          subContext[key] = subObject[key];
        }
      } else if (Object.prototype.toString.call(subContext[key]) === '[object Object]') {
        // Context is of Type object, Call this function recursively to handle nested objects.
        subContext[key] = renderSubContext(subObject[key], subContext[key]);
      } else {
        // For all other Types, add the Object to the Context.
        subContext[key] = subObject[key];
      }
    }

    return subContext;
  }

  for (const envObject of envObjects) {
    // For every environment render the Objects
    renderContext = await renderSubContext(envObject, renderContext);
  }

  // Render the context with itself to fill in the rest.
  const finalRenderContext = renderContext;

  const keys = _getOrderedEnvironmentKeys(finalRenderContext);

  // Render recursive references and tags.
  const skipNextTime = {};

  for (let i = 0; i < 3; i++) {
    for (const key of keys) {
      // Skip rendering keys that stayed the same multiple times. This is here because
      // a render failure will leave the tag as-is and thus the next iteration of the
      // loop will try to re-render it again. We don't want to keep erroring on these
      // because renders are expensive and potentially not idempotent.
      if (skipNextTime[key]) {
        continue;
      }

      const renderResult = await render(
        finalRenderContext[key],
        finalRenderContext,
        null,
        KEEP_ON_ERROR,
        'Environment',
      );

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
  context: Record<string, any> = {},
  blacklistPathRegex: RegExp | null = null,
  errorMode: string = THROW_ON_ERROR,
  name = '',
) {
  // Make a deep copy so no one gets mad :)
  const newObj = clone(obj);

  async function next<T>(x: T, path: string, first = false) {
    if (blacklistPathRegex && path.match(blacklistPathRegex)) {
      return x;
    }

    const asStr = Object.prototype.toString.call(x);

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
    } else if (typeof x === 'string') {
      try {
        // @ts-expect-error -- TSCONVERSION
        x = await templating.render(x, { context, path });

        // If the variable outputs a tag, render it again. This is a common use
        // case for environment variables:
        //   {{ foo }} => {% uuid 'v4' %} => dd265685-16a3-4d76-a59c-e8264c16835a
        // @ts-expect-error -- TSCONVERSION
        if (x.includes('{%')) {
          // @ts-expect-error -- TSCONVERSION
          x = await templating.render(x, { context, path });
        }
      } catch (err) {
        if (errorMode !== KEEP_ON_ERROR) {
          throw err;
        }
      }
    } else if (Array.isArray(x)) {
      for (let i = 0; i < x.length; i++) {
        x[i] = await next(x[i], `${path}[${i}]`);
      }
    } else if (typeof x === 'object' && x !== null) {
      // Don't even try rendering disabled objects
      // Note, this logic probably shouldn't be here, but w/e for now
      // @ts-expect-error -- TSCONVERSION
      if (x.disabled) {
        return x;
      }

      const keys = Object.keys(x);

      for (const key of keys) {
        if (first && key.indexOf('_') === 0) {
          x[key] = await next(x[key], path);
        } else {
          const pathPrefix = path ? path + '.' : '';
          x[key] = await next(x[key], `${pathPrefix}${key}`);
        }
      }
    }

    return x;
  }

  return next<T>(newObj, name, true);
}

interface RenderRequest<T extends Request | GrpcRequest> {
  request: T;
}

interface BaseRenderContextOptions {
  environmentId?: string;
  purpose?: RenderPurpose;
  extraInfo?: ExtraRenderInfo;
}

interface RenderContextOptions extends BaseRenderContextOptions, Partial<RenderRequest<Request | GrpcRequest>> {
  ancestors?: RenderContextAncestor[];
}
export async function getRenderContext(
  {
    request,
    environmentId,
    ancestors: _ancestors,
    purpose,
    extraInfo,
  }: RenderContextOptions,
): Promise<Record<string, any>> {
  const ancestors = _ancestors || await getRenderContextAncestors(request);

  const project = ancestors.find(isProject);
  const workspace = ancestors.find(isWorkspace);

  if (!workspace) {
    throw new Error('Failed to render. Could not find workspace');
  }

  const rootEnvironment = await models.environment.getOrCreateForParentId(
    workspace ? workspace._id : 'n/a',
  );
  const subEnvironment = await models.environment.getById(environmentId || 'n/a');
  const keySource = {};

  // Function that gets Keys and stores their Source location
  function getKeySource(subObject, inKey, inSource) {
    // Add key to map if it's not root
    if (inKey) {
      keySource[templatingUtils.normalizeToDotAndBracketNotation(inKey)] = inSource;
    }

    // Recurse down for Objects and Arrays
    const typeStr = Object.prototype.toString.call(subObject);

    if (typeStr === '[object Object]') {
      for (const key of Object.keys(subObject)) {
        getKeySource(subObject[key], templatingUtils.forceBracketNotation(inKey, key), inSource);
      }
    } else if (typeStr === '[object Array]') {
      for (let i = 0; i < subObject.length; i++) {
        getKeySource(subObject[i], templatingUtils.forceBracketNotation(inKey, i), inSource);
      }
    }
  }

  const inKey = templating.NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME;
  // Get Keys from root environment
  getKeySource((rootEnvironment || {}).data, inKey, 'root');

  // Get Keys from sub environment
  if (subEnvironment) {
    getKeySource(subEnvironment.data || {}, inKey, subEnvironment.name || '');
  }

  // Get Keys from ancestors (e.g. Folders)
  if (ancestors) {
    for (let idx = 0; idx < ancestors.length; idx++) {
      const ancestor: any = ancestors[idx] || {};

      if (
        isRequestGroup(ancestor) &&
        ancestor.hasOwnProperty('environment') &&
        ancestor.hasOwnProperty('name')
      ) {
        getKeySource(ancestor.environment || {}, inKey, ancestor.name || '');
      }
    }
  }

  // Add meta data helper function
  const baseContext: Record<string, any> = {};

  baseContext.getMeta = () => ({
    requestId: request ? request._id : null,
    workspaceId: workspace ? workspace._id : 'n/a',
  });

  baseContext.getKeysContext = () => ({
    keyContext: keySource,
  });

  baseContext.getPurpose = () => purpose;

  baseContext.getExtraInfo = (key: string) => {
    if (!Array.isArray(extraInfo)) {
      return null;
    }

    const p = extraInfo.find(v => v.name === key);
    return p ? p.value : null;
  };

  baseContext.getEnvironmentId = () => environmentId;

  // It is possible for a project to not exist because this code path can be reached via Inso/insomnia-send-request which has no concept of a project.
  baseContext.getProjectId = () => project?._id;

  // Generate the context we need to render
  return buildRenderContext({ ancestors, rootEnvironment, subEnvironment: subEnvironment || undefined, baseContext });
}

interface RenderGrpcRequestOptions extends BaseRenderContextOptions, RenderRequest<GrpcRequest> {
  skipBody?: boolean;
}
export async function getRenderedGrpcRequest(
  {
    purpose,
    extraInfo,
    request,
    environmentId,
    skipBody,
  }: RenderGrpcRequestOptions,
) {
  const renderContext = await getRenderContext({ request, environmentId, purpose, extraInfo });
  const description = request.description;
  // Render description separately because it's lower priority
  request.description = '';
  // Ignore body by default and only include if specified to
  const ignorePathRegex = skipBody ? /^body.*/ : null;
  // Render all request properties
  const renderedRequest: RenderedGrpcRequest = await render(
    request,
    renderContext,
    ignorePathRegex,
  );
  renderedRequest.description = await render(description, renderContext, null, KEEP_ON_ERROR);
  return renderedRequest;
}

type RenderGrpcRequestMessageOptions = BaseRenderContextOptions & RenderRequest<GrpcRequest>;
export async function getRenderedGrpcRequestMessage(
  {
    environmentId,
    request,
    extraInfo,
    purpose,
  }: RenderGrpcRequestMessageOptions,
) {
  const renderContext = await getRenderContext({ request, environmentId, purpose, extraInfo });
  // Render request body
  const renderedBody: RenderedGrpcRequestBody = await render(request.body, renderContext);
  return renderedBody;
}

type RenderRequestOptions = BaseRenderContextOptions & RenderRequest<Request>;
export async function getRenderedRequestAndContext(
  {
    request,
    environmentId,
    extraInfo,
    purpose,
  }: RenderRequestOptions,
) {
  const ancestors = await getRenderContextAncestors(request);
  const workspace = ancestors.find(isWorkspace);
  const parentId = workspace ? workspace._id : 'n/a';
  const cookieJar = await models.cookieJar.getOrCreateForParentId(parentId);
  const renderContext = await getRenderContext({ request, environmentId, ancestors, purpose, extraInfo });

  // HACK: Switch '#}' to '# }' to prevent Nunjucks from barfing
  // https://github.com/kong/insomnia/issues/895
  try {
    if (request.body.text && request.body.mimeType === CONTENT_TYPE_GRAPHQL) {
      const o = JSON.parse(request.body.text);
      o.query = o.query.replace(/#}/g, '# }');
      request.body.text = JSON.stringify(o);
    }
  } catch (err) { }

  // Render description separately because it's lower priority
  const description = request.description;
  request.description = '';
  // Render all request properties
  const renderResult = await render(
    {
      _request: request,
      _cookieJar: cookieJar,
    },
    renderContext,
    request.settingDisableRenderRequestBody ? /^body.*/ : null,
  );
  const renderedRequest = renderResult._request;
  const renderedCookieJar = renderResult._cookieJar;
  renderedRequest.description = await render(description, renderContext, null, KEEP_ON_ERROR);
  // Remove disabled params
  renderedRequest.parameters = renderedRequest.parameters.filter(p => !p.disabled);
  // Remove disabled headers
  renderedRequest.headers = renderedRequest.headers.filter(p => !p.disabled);

  // Remove disabled body params
  if (renderedRequest.body && Array.isArray(renderedRequest.body.params)) {
    renderedRequest.body.params = renderedRequest.body.params.filter(p => !p.disabled);
  }

  // Remove disabled authentication
  if (renderedRequest.authentication && renderedRequest.authentication.disabled) {
    renderedRequest.authentication = {};
  }

  // Default the proto if it doesn't exist
  renderedRequest.url = setDefaultProtocol(renderedRequest.url);
  return {
    context: renderContext,
    request: {
      // Add the yummy cookies
      cookieJar: renderedCookieJar,
      cookies: [],
      isPrivate: false,
      // NOTE: Flow doesn't like Object.assign, so we have to do each property manually
      // for now to convert Request to RenderedRequest.
      _id: renderedRequest._id,
      authentication: renderedRequest.authentication,
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
function _nunjucksSortValue(v) {
  return v?.match?.(/({{|{%)/) ? 2 : 1;
}

function _getOrderedEnvironmentKeys(finalRenderContext: Record<string, any>): string[] {
  return Object.keys(finalRenderContext).sort((k1, k2) => {
    const k1Sort = _nunjucksSortValue(finalRenderContext[k1]);

    const k2Sort = _nunjucksSortValue(finalRenderContext[k2]);

    return k1Sort - k2Sort;
  });
}

type RenderContextAncestor = Request | GrpcRequest | RequestGroup | Workspace | Project;
export async function getRenderContextAncestors(base?: Request | GrpcRequest | Workspace): Promise<RenderContextAncestor[]> {
  return await db.withAncestors<RenderContextAncestor>(base || null, [
    models.request.type,
    models.grpcRequest.type,
    models.requestGroup.type,
    models.workspace.type,
    models.project.type,
  ]);
}
